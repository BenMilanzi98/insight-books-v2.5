// lib/cogsIntegration.js
import prisma from '@/lib/prisma';
import { assertPeriodOpen } from './accountingPeriodService';
import { validateTransactionBalance } from '@/lib/accountingValidation';
import { generateReferenceNumber } from '@/lib/journalService';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { getStandardAccounts } from '@/lib/transactionJournalHelpers';
import { findAccountsPayableGlAccount } from '@/lib/coaPostingCodes.js';
import { ensureChartOfAccountsForTenant } from '@/lib/chartOfAccountsInitialization.js';
import { resolveOrEnsureInventoryGlAccount } from '@/lib/inventoryGlAccount.js';

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

  let costofgoodssold = await tx.account.findFirst({
    where: { tenantId, accountCode: '5100', accountType: 'Expense', isActive: true },
  });
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

  const accounts = await getOrCreateCOGSAccounts(tenantId);
  
  // Calculate total purchase amount
  const totalAmount = items.reduce((sum, item) => {
    return sum + (item.quantity * item.cost);
  }, 0);

  if (totalAmount <= 0) {
    throw new Error('Purchase amount must be greater than zero');
  }

  // Create transaction with journal entries
  const transaction = await prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tenantId, new Date(), tx);
    // Create main transaction record
    const transactionRecord = await tx.transaction.create({
      data: {
        date: new Date(),
        description: `Purchase from ${supplierName} - ${reference}`,
        reference: reference,
        status: 'posted',
        tenantId: tenantId
      }
    });

    // Create journal entries
    const journalEntries = [];

    // Debit Inventory
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: accounts.inventory.id,
          description: `Inventory purchase from ${supplierName}`,
          debit: totalAmount,
          credit: 0
        }
      })
    );

    // Credit Accounts Payable
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: accounts.accountspayable.id,
          description: `Accounts payable to ${supplierName}`,
          debit: 0,
          credit: totalAmount
        }
      })
    );

    await Promise.all(journalEntries);

    // Update inventory levels and costs
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId }
      });

      if (product) {
        // Update stock level
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockLevel: {
              increment: item.quantity
            },
            cost: item.cost // Update cost price
          }
        });

        // Create inventory transaction record
        await tx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            type: 'purchase',
            quantity: item.quantity,
            notes: `Purchase from ${supplierName} - ${reference}`,
            userId: userId,
            tenantId: tenantId
          }
        });
      }
    }

    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'PURCHASE_RECORDED',
        entityType: 'TRANSACTION',
        entityId: transactionRecord.id,
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

    return transactionRecord;
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
              typeof fifoCogs === 'object' && fifoCogs?.toNumber
                ? fifoCogs.toNumber()
                : Number(fifoCogs);
            if (cogsAmount > 0) {
              totalCOGS += cogsAmount;
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
            productCost = Number(customData.productCostAtSale);
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
        const qty = Number(item.quantity) || 0;
        const itemCOGS = qty * productCost;
        totalCOGS += itemCOGS;

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

  // Post to general ledger: Transaction + TransactionLine (same as POS createSaleJournalEntries)
  const transactionRecord = await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findFirst({
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

    await assertPeriodOpen(tenantId, sale.historicalDate || sale.saleDate || new Date(), tx);

    const accounts = await getStandardAccounts(tenantId, tx);
    if (!accounts.cogs?.id || !accounts.inventory?.id) {
      throw new Error(
        'COGS or Inventory GL account is missing. Ensure Chart of Accounts includes COGS (e.g. 5100) and Inventory (1300).'
      );
    }

    const entryDate = sale.historicalDate || sale.saleDate || new Date();
    const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
    const saleLabel = sale.saleNumber || saleId;

    const cogsLines = [
      {
        lineNumber: 1,
        accountId: accounts.cogs.id,
        debitAmount: totalCOGS,
        creditAmount: 0,
        description: `COGS for sale ${saleLabel}`,
      },
      {
        lineNumber: 2,
        accountId: accounts.inventory.id,
        debitAmount: 0,
        creditAmount: totalCOGS,
        description: `Inventory reduction for sale ${saleLabel}`,
      },
    ];

    const cogsBalanceValidation = validateTransactionBalance(cogsLines);
    if (!cogsBalanceValidation.isValid) {
      throw new Error(`COGS transaction validation failed: ${cogsBalanceValidation.error}`);
    }

    const glTransaction = await tx.transaction.create({
      data: {
        tenantId,
        date: entryDate,
        reference: referenceNumber,
        description: `Sale ${saleLabel} - COGS Recognition`,
        entryType: 'Regular',
        status: 'posted',
        sourceType: 'Sale',
        sourceId: saleId,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        ...(sale.branchId ? { branchId: sale.branchId } : {}),
        lines: { create: cogsLines },
      },
      include: { lines: true },
    });

    for (const line of glTransaction.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        line.debitAmount,
        line.creditAmount,
        tx
      );
    }

    await tx.auditLog.create({
      data: {
        action: 'COGS_RECORDED',
        entityType: 'TRANSACTION',
        entityId: glTransaction.id,
        userId,
        tenantId,
        details: JSON.stringify({
          saleId,
          totalCOGS,
          itemCount: cogsItems.length,
          items: cogsItems,
        }),
      },
    });

    return glTransaction;
  });

  return transactionRecord;
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
  
  // Determine which asset account to credit based on payment method
  const assetAccount = paymentMethod.toLowerCase().includes('bank') 
    ? accounts.bankaccount 
    : accounts.cash;

  // Create transaction with journal entries
  const transaction = await prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tenantId, new Date(), tx);
    // Create main transaction record
    const transactionRecord = await tx.transaction.create({
      data: {
        date: new Date(),
        description: `Payment to ${supplierName} - ${reference}`,
        reference: reference,
        status: 'posted',
        tenantId: tenantId
      }
    });

    // Create journal entries
    const journalEntries = [];

    // Debit Accounts Payable
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: accounts.accountspayable.id,
          description: `Payment to ${supplierName}`,
          debit: amount,
          credit: 0
        }
      })
    );

    // Credit Cash/Bank
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: assetAccount.id,
          description: `Payment to ${supplierName}`,
          debit: 0,
          credit: amount
        }
      })
    );

    await Promise.all(journalEntries);

    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'SUPPLIER_PAYMENT_RECORDED',
        entityType: 'TRANSACTION',
        entityId: transactionRecord.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          supplierName,
          amount,
          paymentMethod,
          reference
        })
      }
    });

    return transactionRecord;
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
  const n = (v) => (v == null ? 0 : (typeof v === 'object' && v?.toNumber ? v.toNumber() : Number(v)) || 0);
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
  const saleWhere = {
    tenantId,
    status: 'completed',
    saleDate: {
      gte: startDate,
      lte: endDate
    }
  };

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
    const cogsAmount = Number(consumption.cogsAmount || 0);
    
    if (consumption.saleItemId) {
      if (!fifoBySaleItem[consumption.saleItemId]) {
        fifoBySaleItem[consumption.saleItemId] = 0;
      }
      fifoBySaleItem[consumption.saleItemId] += cogsAmount;
    }
    
    if (consumption.saleId) {
      if (!fifoBySale[consumption.saleId]) {
        fifoBySale[consumption.saleId] = 0;
      }
      fifoBySale[consumption.saleId] += cogsAmount;
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

      const quantity = Number(item.quantity || 0);
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
        itemCOGS = typeof v === 'object' && v?.toNumber ? v.toNumber() : Number(v);
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
          productCost = Number(customData.productCostAtSale);
          cogsSource = 'productCostAtSale';
        } else {
          productCost = productCostFromProduct(item.product);
          cogsSource = 'productCostCurrent';
        }
        if (productCost > 0 && quantity > 0) itemCOGS = quantity * productCost;
      }

      if (itemCOGS > 0) saleCOGS += itemCOGS;
    }

    if (saleCOGS > 0) {
      totalAmount += saleCOGS;

      const sourceType = 'Sale';
      if (!breakdownBySource[sourceType]) {
        breakdownBySource[sourceType] = {
          sourceType,
          amount: 0,
          count: 0
        };
      }
      breakdownBySource[sourceType].amount += saleCOGS;
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

  // Invoices: same statuses as revenue (Paid, Completed) so COGS matches P&L
  const invoiceWhere = {
    tenantId,
    status: { in: ['posted', 'Paid', 'Completed'] },
    issueDate: { gte: startDate, lte: endDate },
    voidedAt: null,
    refundedAt: null
  };
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
        const quantity = Number(item.quantity || 0);
        if (productCost > 0 && quantity > 0) {
          invoiceCOGS += quantity * productCost;
        }
      }

      if (invoiceCOGS > 0) {
        totalAmount += invoiceCOGS;

        const sourceType = 'Invoice';
        if (!breakdownBySource[sourceType]) {
          breakdownBySource[sourceType] = {
            sourceType,
            amount: 0,
            count: 0
          };
        }
        breakdownBySource[sourceType].amount += invoiceCOGS;
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
