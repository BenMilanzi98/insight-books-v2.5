// lib/cogsIntegration.js
import prisma from '@/lib/prisma';
import { assertPeriodOpen } from './accountingPeriodService';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { generateReferenceNumber } from '@/lib/journalService';
import { postGlEntry } from '@/lib/accountingEngine/postGlEntry.js';
import { getStandardAccounts } from '@/lib/transactionJournalHelpers';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes.js';
import { ensureChartOfAccountsForTenant } from '@/lib/chartOfAccountsInitialization.js';
import { resolveOrEnsureInventoryGlAccount } from '@/lib/inventoryGlAccount.js';
import { resolveCogsPostingLeafGlAccount } from '@/lib/cogsGlAccount.js';
import {
  validInvoiceReportWhere,
  validSaleReportWhere,
} from '@/lib/reportingSourceRules.js';
import { parseInclusiveApiYmdRange } from '@/lib/dateUtils';
import { addMoney, multiplyMoney, parseMoney } from '@/lib/money';

/**
 * COGS Integration Service
 * Handles automatic Cost of Goods Sold (COGS) journal entries
 * (three-stage flow: Purchase → Sale → Supplier Payment).
 * System rule: Shipping costs are NEVER part of COGS — product cost only (FIFO/cost at sale).
 */

/**
 * Resolve SYSTEM-aligned GL accounts for purchase/payment/COGS flows.
 * Never creates duplicate roots (1000/2000/5000) or mis-coded rows (e.g. 1200 as "Inventory").
 */
async function getOrCreateCOGSAccounts(tenantId, tx = prisma) {
  try {
    await ensureChartOfAccountsForTenant(tenantId, tx, { preferSystemCoaDefinition: true });
  } catch (_) {
    /* bootstrap may still resolve from existing rows */
  }

  const inventory = await resolveOrEnsureInventoryGlAccount(tenantId, tx);
  const accountspayable = await findAccountsPayableGlAccount(tenantId, tx);

  let costofgoodssold = await resolveCogsPostingLeafGlAccount(tenantId, tx);
  if (!costofgoodssold) {
    costofgoodssold = await tx.account.findFirst({
      where: { tenantId, accountCode: '5100', accountType: 'Expense', isActive: true },
    });
  }
  if (!costofgoodssold) {
    costofgoodssold = await tx.account.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [{ code: '5100' }, { accountCode: '5100' }],
      },
    });
  }

  const cash = await tx.account.findFirst({
    where: { tenantId, accountCode: '1110', accountType: 'Asset', isActive: true },
  });

  const group1130 = await tx.account.findFirst({
    where: { tenantId, accountCode: '1130', accountType: 'Asset', isActive: true },
    select: { id: true },
  });
  let bankaccount = null;
  if (group1130?.id) {
    bankaccount = await tx.account.findFirst({
      where: {
        tenantId,
        parentAccountId: group1130.id,
        isActive: true,
        accountType: 'Asset',
        NOT: { accountSubtype: 'Group' },
      },
      orderBy: { accountCode: 'asc' },
    });
  }
  if (!bankaccount) {
    bankaccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountCode: { startsWith: '1130-' },
        isActive: true,
        accountType: 'Asset',
      },
      orderBy: { accountCode: 'asc' },
    });
  }
  if (!bankaccount) bankaccount = cash;

  return {
    inventory,
    accountspayable,
    costofgoodssold,
    cash,
    bankaccount,
  };
}

/** GL COGS account id for aggregating TransactionLine debits (matches /expenses + POS). */
export async function resolveCogsGlAccountId(tenantId, tx = prisma) {
  const accs = await getOrCreateCOGSAccounts(tenantId, tx);
  if (accs.costofgoodssold?.id) return accs.costofgoodssold.id;
  const std = await getStandardAccounts(tenantId, tx);
  return std.cogs?.id ?? null;
}

/**
 * Create journal entry for purchase from supplier
 * Debit: Inventory (Asset)
 * Credit: Accounts Payable (Liability)
 * @param {Object} purchaseData - Purchase information
 * @param {string} purchaseData.tenantId - Tenant ID
 * @param {string} purchaseData.userId - User ID
 * @param {Array} purchaseData.items - Array of purchased items
 * @param {string} purchaseData.supplierName - Supplier name
 * @param {string} purchaseData.reference - Purchase reference
 * @returns {Promise<Object>} Created transaction
 */
export async function recordPurchaseFromSupplier(purchaseData) {
  const { tenantId, userId, items, supplierName, reference } = purchaseData;
  
  if (!items || items.length === 0) {
    throw new Error('Purchase items are required');
  }

  if (reference) {
    const existingGr = await prisma.goodsReceipt.findFirst({
      where: {
        tenantId,
        OR: [{ receiptNumber: reference }, { id: reference }],
        inventoryAppliedAt: { not: null },
      },
      select: { id: true },
    });
    if (existingGr) {
      throw new Error(
        'This purchase was already posted via goods receipt. Stock was not updated again.'
      );
    }
  }

  const accounts = await getOrCreateCOGSAccounts(tenantId);

  if (!accounts.inventory?.id || !accounts.accountspayable?.id) {
    throw new Error(
      'Inventory or Accounts Payable GL account is missing. Ensure Chart of Accounts includes Inventory and Accounts Payable.'
    );
  }

  const totalAmount = items.reduce((sum, item) => {
    return addMoney(sum, multiplyMoney(item.cost, item.quantity));
  }, 0);

  if (totalAmount <= 0) {
    throw new Error('Purchase amount must be greater than zero');
  }

  const entryDate = new Date();

  const transaction = await prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tenantId, entryDate, tx);

    const purchaseLines = [
      {
        lineNumber: 1,
        accountId: accounts.inventory.id,
        debitAmount: totalAmount,
        creditAmount: 0,
        description: `Inventory purchase from ${supplierName}`,
      },
      {
        lineNumber: 2,
        accountId: accounts.accountspayable.id,
        debitAmount: 0,
        creditAmount: totalAmount,
        description: `Accounts payable to ${supplierName}`,
      },
    ];

    const balanceValidation = validateTransactionBalance(purchaseLines);
    if (!balanceValidation.isValid) {
      throw new Error(`Purchase transaction validation failed: ${balanceValidation.error}`);
    }

    const { postTaxSettlementAccounting } = await import(
      './accountingV2/adapters/remainingAdapters.js'
    );
    const purchaseOutcome = await postTaxSettlementAccounting({
      db: tx,
      tenantId,
      userId,
      sourceType: 'SupplierPurchase',
      sourceId: reference,
      amount: totalAmount,
      date: entryDate,
      description: `Purchase from ${supplierName} - ${reference}`,
      lines: purchaseLines,
    });
    const glTransaction = {
      id: purchaseOutcome.result?.journalEntryId,
      ...(purchaseOutcome.result || {}),
    };

    // FIFO inbound — do not increment stockLevel separately (createFifoBatch owns qty + value).
    const { createFifoBatch } = await import('@/lib/fifoCosting');
    for (const item of items) {
      const product = await tx.product.findFirst({
        where: { id: item.productId, tenantId },
        select: { id: true, isService: true, branchId: true },
      });
      if (!product || product.isService) continue;

      await createFifoBatch({
        tenantId,
        branchId: product.branchId || null,
        productId: item.productId,
        quantityPurchased: item.quantity,
        unitCost: item.cost,
        purchaseDate: entryDate,
        sourceType: 'SupplierPurchase',
        sourceId: `${reference}:${item.productId}`,
        tx,
      });

      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          type: 'purchase',
          quantity: item.quantity,
          notes: `Purchase from ${supplierName} - ${reference}`,
          userId: userId,
          tenantId: tenantId,
          branchId: product.branchId || null,
        }
      });
    }

    await tx.auditLog.create({
      data: {
        action: 'PURCHASE_RECORDED',
        entityType: 'TRANSACTION',
        entityId: glTransaction.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          supplierName,
          reference,
          totalAmount,
          itemCount: items.length
        })
      }
    });

    return glTransaction;
  });

  return transaction;
}

/**
 * Create journal entry for sale (COGS recognition)
 * Debit: Cost of Goods Sold (Expense)
 * Credit: Inventory (Asset)
 * @param {Object} saleData - Sale information
 * @param {string} saleData.tenantId - Tenant ID
 * @param {string} saleData.userId - User ID
 * @param {string} saleData.saleId - Sale ID
 * @param {Array} saleData.items - Array of sold items
 * @returns {Promise<Object>} Created transaction
 */
export async function recordCOGSOnSale(saleData) {
  const { tenantId, userId, saleId, items } = saleData;

  if (!items || items.length === 0) {
    throw new Error('Sale items are required');
  }

  // Calculate total COGS amount
  let totalCOGS = 0;
  const cogsItems = [];

  for (const item of items) {
    if (item.productId && !item.isCustom) {
      let productCost = null;
      if (item.customProductData) {
        let customData = item.customProductData;
        if (typeof customData === 'string') {
          try {
            customData = JSON.parse(customData);
          } catch (e) {
            customData = null;
          }
        }
        if (customData && typeof customData === 'object') {
          if (customData.fifoCogs && customData.fifoCogs.cogsAmount) {
            const fifoCogs = customData.fifoCogs.cogsAmount;
            const cogsAmount =
              parseMoney(fifoCogs);
            if (cogsAmount > 0) {
              totalCOGS = addMoney(totalCOGS, cogsAmount);
              const qty = Number(item.quantity) || 0;
              cogsItems.push({
                productId: item.productId,
                productName: item.product?.name || 'Unknown',
                quantity: item.quantity,
                cost: qty > 0 ? cogsAmount / qty : 0,
                cogsAmount,
              });
              continue;
            }
          }
          if (customData.productCostAtSale !== undefined) {
            productCost = parseMoney(customData.productCostAtSale);
          }
        }
      }

      if (productCost === null) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
        });
        productCost = product ? productCostFromProduct(product) : 0;
      }

      if (productCost > 0) {
        const qty = parseMoney(item.quantity);
        const itemCOGS = multiplyMoney(productCost, qty);
        totalCOGS = addMoney(totalCOGS, itemCOGS);

        cogsItems.push({
          productId: item.productId,
          productName: item.product?.name || 'Unknown',
          quantity: item.quantity,
          cost: productCost,
          cogsAmount: itemCOGS,
        });
      }
    }
  }

  if (totalCOGS <= 0) {
    return null;
  }

  // Single COGS cutover path (shared with POS createSaleJournalEntries).
  // Idempotent on Sale-COGS + saleId — cannot double-post with the POS bundled path.
  const { postCostOfSalesAccounting } = await import('./accountingV2/adapters/costOfSalesAdapter.js');

  const sale = await prisma.sale.findFirst({
    where: { id: saleId, tenantId },
    select: {
      saleNumber: true,
      saleDate: true,
      historicalDate: true,
      branchId: true,
    },
  });
  if (!sale) {
    throw new Error('Sale not found for this tenant');
  }

  const outcome = await postCostOfSalesAccounting({
    db: prisma,
    tenantId,
    userId,
    documentKind: 'Sale',
    documentId: saleId,
    documentNumber: sale.saleNumber || saleId,
    documentDate: sale.historicalDate || sale.saleDate,
    cogsAmount: totalCOGS,
    branchId: sale.branchId || null,
  });

  if (outcome?.result?.journalEntryId) {
    await prisma.auditLog.create({
      data: {
        action: 'COGS_RECORDED',
        entityType: 'JOURNAL_ENTRY',
        entityId: outcome.result.journalEntryId,
        userId,
        tenantId,
        details: JSON.stringify({
          saleId,
          engine: 'NEW_ENGINE',
          totalCOGS,
          itemCount: cogsItems.length,
        }),
      },
    });
  }

  return outcome.result;
}

/**
 * Create journal entry for supplier payment
 * Debit: Accounts Payable (Liability)
 * Credit: Cash/Bank (Asset)
 * @param {Object} paymentData - Payment information
 * @param {string} paymentData.tenantId - Tenant ID
 * @param {string} paymentData.userId - User ID
 * @param {string} paymentData.supplierName - Supplier name
 * @param {number} paymentData.amount - Payment amount
 * @param {string} paymentData.paymentMethod - Payment method (cash/bank)
 * @param {string} paymentData.reference - Payment reference
 * @returns {Promise<Object>} Created transaction
 */
export async function recordSupplierPayment(paymentData) {
  const { tenantId, userId, supplierName, amount, paymentMethod, reference } = paymentData;
  
  if (amount <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  const accounts = await getOrCreateCOGSAccounts(tenantId);

  if (!accounts.accountspayable?.id) {
    throw new Error(
      'Accounts Payable GL account is missing. Ensure Chart of Accounts includes Accounts Payable.'
    );
  }

  const assetAccount = paymentMethod.toLowerCase().includes('bank')
    ? accounts.bankaccount
    : accounts.cash;

  if (!assetAccount?.id) {
    throw new Error(
      'Cash or Bank GL account is missing. Ensure Chart of Accounts includes a payment asset account.'
    );
  }

  const entryDate = new Date();

  const transaction = await prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tenantId, entryDate, tx);

    const paymentLines = [
      {
        lineNumber: 1,
        accountId: accounts.accountspayable.id,
        debitAmount: amount,
        creditAmount: 0,
        description: `Payment to ${supplierName}`,
      },
      {
        lineNumber: 2,
        accountId: assetAccount.id,
        debitAmount: 0,
        creditAmount: amount,
        description: `Payment to ${supplierName}`,
      },
    ];

    const balanceValidation = validateTransactionBalance(paymentLines);
    if (!balanceValidation.isValid) {
      throw new Error(`Supplier payment validation failed: ${balanceValidation.error}`);
    }

    const { postTaxSettlementAccounting } = await import(
      './accountingV2/adapters/remainingAdapters.js'
    );
    // Reuse metadata-lines engine path (SupplierPayment is a V2 event via supplier payment adapter elsewhere).
    const payOutcome = await postTaxSettlementAccounting({
      db: tx,
      tenantId,
      userId,
      sourceType: 'SupplierPurchase',
      sourceId: `supplier-payment-${reference}`,
      amount,
      date: entryDate,
      description: `Payment to ${supplierName} - ${reference}`,
      lines: paymentLines,
    });
    const glTransaction = {
      id: payOutcome.result?.journalEntryId,
      ...(payOutcome.result || {}),
    };

    await tx.auditLog.create({
      data: {
        action: 'SUPPLIER_PAYMENT_RECORDED',
        entityType: 'JOURNAL_ENTRY',
        entityId: glTransaction.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          supplierName,
          amount,
          paymentMethod,
          reference,
          engine: 'NEW_ENGINE',
        }),
      },
    });

    return glTransaction;
  });

  return transaction;
}

/**
 * Get COGS summary for a specific period
 * @param {string} tenantId - Tenant ID
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Object>} COGS summary
 */
export async function getCOGSSummary(tenantId, startDate, endDate) {
  const cogsAccountId = await resolveCogsGlAccountId(tenantId);

  // Get COGS transactions for the period
  const cogsTransactions = await prisma.transaction.findMany({
    where: {
      tenantId: tenantId,
      description: {
        contains: 'COGS'
      },
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    }
  });

  // Calculate total COGS from GL lines (same account as /expenses COGS rows)
  const totalCOGS = cogsTransactions.reduce((sum, transaction) => {
    if (!cogsAccountId) return sum;
    const cogsLine = transaction.lines.find((line) => line.accountId === cogsAccountId);
    return sum + (cogsLine ? Number(cogsLine.debitAmount || 0) : 0);
  }, 0);

  // Get inventory transactions for the period
  const inventoryTransactions = await prisma.inventoryTransaction.findMany({
    where: {
      tenantId: tenantId,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    include: {
      product: true
    }
  });

  return {
    totalCOGS,
    transactionCount: cogsTransactions.length,
    inventoryTransactions: inventoryTransactions.length,
    period: {
      startDate,
      endDate
    }
  };
}

/** Coerce Prisma Decimal/number to number; prefer cost fields in same order as /stock. */
function productCostFromProduct(product) {
  if (!product) return 0;
  const n = (v) => parseMoney(v);
  return n(product.lastPurchaseCost) || n(product.cost) || n(product.averageCost) || 0;
}

/**
 * Aggregate COGS amounts from posted sales and invoices
 * Uses the same cost source as /stock (cost, averageCost, lastPurchaseCost).
 */
export async function getCOGSTransactionStats(tenantId, startDate, endDate, branchId = null, branchIdsIn = null) {
  if (!tenantId) {
    throw new Error('tenantId is required when fetching COGS stats');
  }

  const { start, end } = parseInclusiveApiYmdRange(startDate, endDate);

  // Get COGS accounts (cost accounts used in expense reports and ledger)
  const cogsAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { accountCode: '5000' },
        { code: '5000' },
        { accountCode: '5100' },
        { code: '5100' },
        { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
        { accountName: { contains: 'cost of sales', mode: 'insensitive' } },
        { accountName: { contains: 'cogs', mode: 'insensitive' } },
        { name: { contains: 'cost of goods', mode: 'insensitive' } },
        { name: { contains: 'cost of sales', mode: 'insensitive' } },
        { name: { contains: 'cogs', mode: 'insensitive' } }
      ]
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      name: true,
      description: true
    }
  });

  // Query sales directly instead of relying on transactions
  const saleWhere = validSaleReportWhere(tenantId, 'saleDate', start, end);

  // Add branch filtering if provided (single branch wins over multi-branch scope)
  if (branchId) {
    saleWhere.branchId = branchId;
  } else if (branchIdsIn && branchIdsIn.length > 0) {
    saleWhere.OR = [{ branchId: null }, { branchId: { in: branchIdsIn } }];
  }

  // Get all completed sales in the date range
  const sales = await prisma.sale.findMany({
    where: saleWhere,
    select: {
      id: true,
      saleNumber: true,
      saleDate: true,
      total: true
    }
  });

  // Get all sale items for these sales with product cost (same fields as /stock)
  const saleItems = sales.length === 0 ? [] : await prisma.saleItem.findMany({
    where: {
      saleId: { in: sales.map(s => s.id) },
      isCustom: false,
      product: { isNot: null }
    },
    select: {
      id: true,
      saleId: true,
      productId: true,
      quantity: true,
      customProductData: true,
      product: {
        select: {
          id: true,
          cost: true,
          averageCost: true,
          lastPurchaseCost: true,
          name: true,
          isService: true
        }
      },
      sale: {
        select: {
          id: true,
          saleNumber: true,
          saleDate: true
        }
      }
    }
  });

  // Calculate COGS from sale items using FIFO data
  const breakdownBySource = {};
  const transactionAggregates = new Map();
  let totalAmount = 0;

  // Get all sale item IDs and sale IDs to query FIFO consumption records
  const saleItemIds = saleItems.map(item => item.id).filter(Boolean);
  const saleIds = sales.map(s => s.id);
  
  // Query FIFO consumption records for these sale items
  // Also query by saleId in case saleItemId wasn't set correctly
  const fifoConsumptions = saleItemIds.length > 0 || saleIds.length > 0 ? await prisma.inventoryBatchConsumption.findMany({
    where: {
      tenantId,
      OR: [
        ...(saleItemIds.length > 0 ? [{ saleItemId: { in: saleItemIds } }] : []),
        ...(saleIds.length > 0 ? [{ saleId: { in: saleIds } }] : [])
      ]
    },
    select: {
      saleItemId: true,
      saleId: true,
      cogsAmount: true
    }
  }) : [];

  // Group FIFO consumptions by saleItemId first, then by saleId
  const fifoBySaleItem = {};
  const fifoBySale = {};
  
  for (const consumption of fifoConsumptions) {
    const cogsAmount = parseMoney(consumption.cogsAmount);
    
    if (consumption.saleItemId) {
      if (!fifoBySaleItem[consumption.saleItemId]) {
        fifoBySaleItem[consumption.saleItemId] = 0;
      }
      fifoBySaleItem[consumption.saleItemId] = addMoney(fifoBySaleItem[consumption.saleItemId], cogsAmount);
    }
    
    if (consumption.saleId) {
      if (!fifoBySale[consumption.saleId]) {
        fifoBySale[consumption.saleId] = 0;
      }
      fifoBySale[consumption.saleId] = addMoney(fifoBySale[consumption.saleId], cogsAmount);
    }
  }

  // Group sale items by sale
  const saleItemsBySale = {};
  for (const item of saleItems) {
    if (!saleItemsBySale[item.saleId]) {
      saleItemsBySale[item.saleId] = [];
    }
    saleItemsBySale[item.saleId].push(item);
  }

  // Calculate COGS for each sale using FIFO data
  for (const [saleId, items] of Object.entries(saleItemsBySale)) {
    let saleCOGS = 0;
    for (const item of items) {
      if (!item.product || item.product.isService) continue;

      const quantity = parseMoney(item.quantity);
      let itemCOGS = 0;
      let cogsSource = 'none';

      // Normalize customProductData (Prisma Json can be string or object)
      let customData = item.customProductData;
      if (typeof customData === 'string') {
        try {
          customData = JSON.parse(customData);
        } catch {
          customData = null;
        }
      }
      if (customData && typeof customData !== 'object') customData = null;

      // Priority 1: Stored FIFO COGS from customProductData
      if (customData?.fifoCogs != null && customData.fifoCogs.cogsAmount != null) {
        const v = customData.fifoCogs.cogsAmount;
        itemCOGS = parseMoney(v);
        if (itemCOGS > 0) cogsSource = 'customProductData';
      }

      // Priority 2: FIFO consumption records
      if (itemCOGS === 0 && item.id && fifoBySaleItem[item.id]) {
        itemCOGS = fifoBySaleItem[item.id];
        cogsSource = 'fifoConsumption';
      }

      // Priority 3: productCostAtSale from customProductData, then product cost (same as /stock)
      if (itemCOGS === 0) {
        let productCost = 0;
        if (customData && customData.productCostAtSale !== undefined) {
          productCost = parseMoney(customData.productCostAtSale);
          cogsSource = 'productCostAtSale';
        } else {
          productCost = productCostFromProduct(item.product);
          cogsSource = 'productCostCurrent';
        }
        if (productCost > 0 && quantity > 0) itemCOGS = multiplyMoney(productCost, quantity);
      }

      if (itemCOGS > 0) saleCOGS = addMoney(saleCOGS, itemCOGS);
    }

    if (saleCOGS > 0) {
      totalAmount = addMoney(totalAmount, saleCOGS);

      const sourceType = 'Sale';
      if (!breakdownBySource[sourceType]) {
        breakdownBySource[sourceType] = {
          sourceType,
          amount: 0,
          count: 0
        };
      }
      breakdownBySource[sourceType].amount = addMoney(breakdownBySource[sourceType].amount, saleCOGS);
      breakdownBySource[sourceType].count += 1;

      const sale = sales.find(s => s.id === saleId);
      transactionAggregates.set(saleId, {
        transactionId: saleId,
        date: sale?.saleDate || new Date(),
        sourceType: 'Sale',
        sourceId: saleId,
        reference: sale?.saleNumber || saleId,
        description: `Sale ${sale?.saleNumber || saleId}`,
        amount: saleCOGS
      });
    }
  }

  // Invoices: same valid source documents as revenue so COGS matches P&L.
  const invoiceWhere = validInvoiceReportWhere(tenantId, 'issueDate', start, end);
  if (branchId) {
    invoiceWhere.branchId = branchId;
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    select: {
      id: true,
      invoiceNumber: true,
      issueDate: true
    }
  });

  if (invoices.length > 0) {
    const invoiceItems = await prisma.invoiceItem.findMany({
      where: {
        invoiceId: { in: invoices.map(i => i.id) },
        product: { isNot: null }
      },
      include: {
        product: {
          select: {
            id: true,
            cost: true,
            averageCost: true,
            lastPurchaseCost: true,
            name: true,
            isService: true
          }
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            issueDate: true
          }
        }
      }
    });

    // Group invoice items by invoice
    const invoiceItemsByInvoice = {};
    for (const item of invoiceItems) {
      if (!invoiceItemsByInvoice[item.invoiceId]) {
        invoiceItemsByInvoice[item.invoiceId] = [];
      }
      invoiceItemsByInvoice[item.invoiceId].push(item);
    }

    // Calculate COGS for each invoice (same cost source as /stock)
    for (const [invoiceId, items] of Object.entries(invoiceItemsByInvoice)) {
      let invoiceCOGS = 0;
      for (const item of items) {
        if (!item.product || item.product.isService) continue;
        const productCost = productCostFromProduct(item.product);
        const quantity = parseMoney(item.quantity);
        if (productCost > 0 && quantity > 0) {
          invoiceCOGS = addMoney(invoiceCOGS, multiplyMoney(productCost, quantity));
        }
      }

      if (invoiceCOGS > 0) {
        totalAmount = addMoney(totalAmount, invoiceCOGS);

        const sourceType = 'Invoice';
        if (!breakdownBySource[sourceType]) {
          breakdownBySource[sourceType] = {
            sourceType,
            amount: 0,
            count: 0
          };
        }
        breakdownBySource[sourceType].amount = addMoney(breakdownBySource[sourceType].amount, invoiceCOGS);
        breakdownBySource[sourceType].count += 1;

        const invoice = invoices.find(i => i.id === invoiceId);
        transactionAggregates.set(invoiceId, {
          transactionId: invoiceId,
          date: invoice?.issueDate || new Date(),
          sourceType: 'Invoice',
          sourceId: invoiceId,
          reference: invoice?.invoiceNumber || invoiceId,
          description: `Invoice ${invoice?.invoiceNumber || invoiceId}`,
          amount: invoiceCOGS
        });
      }
    }
  }

  const breakdownBySourceArr = Object.values(breakdownBySource).sort(
    (a, b) => b.amount - a.amount
  );

  const topTransactions = Array.from(transactionAggregates.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((tx) => ({
      ...tx,
      date: tx.date ? (tx.date instanceof Date ? tx.date.toISOString().split('T')[0] : tx.date) : null
    }));

  return {
    totalAmount,
    lineCount: saleItems.length,
    transactionCount: transactionAggregates.size,
    accounts: cogsAccounts,
    breakdownBySource: breakdownBySourceArr,
    topTransactions
  };
}

/**
 * Validate COGS integration setup
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Validation result
 */
export async function validateCOGSSetup(tenantId) {
  const accounts = await getOrCreateCOGSAccounts(tenantId);
  
  const requiredAccounts = [
    'inventory',
    'accountspayable', 
    'costofgoodssold',
    'cash',
    'bankaccount'
  ];

  const missingAccounts = requiredAccounts.filter(
    accountName => !accounts[accountName]
  );

  return {
    isValid: missingAccounts.length === 0,
    missingAccounts,
    accounts: accounts
  };
}
