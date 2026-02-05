// lib/cogsIntegration.js
import prisma from '@/lib/prisma';
import { assertPeriodOpen } from './accountingPeriodService';

/**
 * COGS Integration Service
 * Handles automatic Cost of Goods Sold (COGS) journal entries
 * following the three-stage accounting flow:
 * 1. Purchase from Supplier (Debit Inventory, Credit Accounts Payable)
 * 2. Sale of Goods (Debit COGS, Credit Inventory)
 * 3. Supplier Payment (Debit Accounts Payable, Credit Cash/Bank)
 */

/**
 * Get or create required accounts for COGS integration
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Account objects
 */
async function getOrCreateCOGSAccounts(tenantId) {
  const accounts = {};
  
  // Define required accounts
  const requiredAccounts = [
    { code: '1200', name: 'Inventory', type: 'ASSET' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
    { code: '1000', name: 'Cash', type: 'ASSET' },
    { code: '1100', name: 'Bank Account', type: 'ASSET' }
  ];

  for (const accountData of requiredAccounts) {
    let account = await prisma.account.findFirst({
      where: {
        code: accountData.code,
        tenantId: tenantId
      }
    });

    if (!account) {
      account = await prisma.account.create({
        data: {
          ...accountData,
          tenantId: tenantId,
          balance: 0,
          isActive: true
        }
      });
    }

    accounts[accountData.name.toLowerCase().replace(/\s+/g, '')] = account;
  }

  return accounts;
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

  const accounts = await getOrCreateCOGSAccounts(tenantId);
  
  // Calculate total COGS amount
  let totalCOGS = 0;
  const cogsItems = [];

  for (const item of items) {
    if (item.productId && !item.isCustom) {
      // Try to get stored cost at sale time from customProductData
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
            // Use FIFO COGS if available
            const fifoCogs = customData.fifoCogs.cogsAmount;
            const cogsAmount = typeof fifoCogs === 'object' && fifoCogs?.toNumber 
              ? fifoCogs.toNumber() 
              : Number(fifoCogs);
            if (cogsAmount > 0) {
              totalCOGS += cogsAmount;
              cogsItems.push({
                productId: item.productId,
                productName: item.product?.name || 'Unknown',
                quantity: item.quantity,
                cost: cogsAmount / item.quantity, // Average cost per unit
                cogsAmount: cogsAmount
              });
              continue; // Skip to next item
            }
          }
          // Fallback to stored cost at sale time
          if (customData.productCostAtSale !== undefined) {
            productCost = Number(customData.productCostAtSale);
          }
        }
      }
      
      // If no stored cost, get current product cost
      if (productCost === null) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        });
        productCost = product?.cost ? Number(product.cost) : 0;
      }

      if (productCost > 0) {
        const itemCOGS = item.quantity * productCost;
        totalCOGS += itemCOGS;
        
        cogsItems.push({
          productId: item.productId,
          productName: item.product?.name || 'Unknown',
          quantity: item.quantity,
          cost: productCost,
          cogsAmount: itemCOGS
        });
      }
    }
  }

  if (totalCOGS <= 0) {
    // No COGS to record (all custom items or no cost data)
    return null;
  }

  // Create transaction with journal entries
  const transaction = await prisma.$transaction(async (tx) => {
    await assertPeriodOpen(tenantId, new Date(), tx);
    // Create main transaction record
    const transactionRecord = await tx.transaction.create({
      data: {
        date: new Date(),
        description: `COGS for Sale ${saleId}`,
        reference: `COGS-${saleId}`,
        status: 'posted',
        tenantId: tenantId
      }
    });

    // Create journal entries
    const journalEntries = [];

    // Debit Cost of Goods Sold
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: accounts.costofgoodssold.id,
          description: `COGS for Sale ${saleId}`,
          debit: totalCOGS,
          credit: 0
        }
      })
    );

    // Credit Inventory
    journalEntries.push(
      tx.journalEntry.create({
        data: {
          transactionId: transactionRecord.id,
          accountId: accounts.inventory.id,
          description: `Inventory reduction for Sale ${saleId}`,
          debit: 0,
          credit: totalCOGS
        }
      })
    );

    await Promise.all(journalEntries);

    // Create audit log
    await tx.auditLog.create({
      data: {
        action: 'COGS_RECORDED',
        entityType: 'TRANSACTION',
        entityId: transactionRecord.id,
        userId: userId,
        tenantId: tenantId,
        details: JSON.stringify({
          saleId,
          totalCOGS,
          itemCount: cogsItems.length,
          items: cogsItems
        })
      }
    });

    return transactionRecord;
  });

  return transaction;
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
  const accounts = await getOrCreateCOGSAccounts(tenantId);
  
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

  // Calculate total COGS
  const totalCOGS = cogsTransactions.reduce((sum, transaction) => {
    const cogsLine = transaction.lines.find(
      line => line.accountId === accounts.costofgoodssold.id
    );
    return sum + (cogsLine ? cogsLine.debitAmount : 0);
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

/**
 * Aggregate COGS amounts from posted sales and invoices
 * Uses the transaction lines that hit the tenant's COGS accounts
 */
export async function getCOGSTransactionStats(tenantId, startDate, endDate, branchId = null) {
  if (!tenantId) {
    throw new Error('tenantId is required when fetching COGS stats');
  }

  // Get COGS accounts for reference (but we'll calculate from sales directly)
  const cogsAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { accountCode: '5000' },
        { code: '5000' },
        { accountName: { contains: 'cost of goods', mode: 'insensitive' } },
        { accountName: { contains: 'cogs', mode: 'insensitive' } },
        { name: { contains: 'cost of goods', mode: 'insensitive' } },
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

  // Add branch filtering if provided
  if (branchId) {
    saleWhere.branchId = branchId;
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

  // Get all sale items for these sales with product cost information
  // First check if we have any sales
  if (sales.length === 0) {
    return {
      totalAmount: 0,
      lineCount: 0,
      transactionCount: 0,
      accounts: cogsAccounts,
      breakdownBySource: [],
      topTransactions: []
    };
  }

  const saleItems = await prisma.saleItem.findMany({
    where: {
      saleId: { in: sales.map(s => s.id) },
      isCustom: false, // Exclude custom items
      product: {
        isNot: null
      }
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
      // Skip if product is a service or doesn't exist
      if (!item.product || item.product.isService) {
        continue;
      }
      
      let itemCOGS = 0;
      let cogsSource = 'none';
      
      // Priority 1: Use stored FIFO COGS from customProductData (most accurate)
      if (item.customProductData && typeof item.customProductData === 'object') {
        const fifoCogs = item.customProductData.fifoCogs;
        if (fifoCogs && fifoCogs.cogsAmount !== undefined && fifoCogs.cogsAmount !== null) {
          // Handle both Decimal and number types
          itemCOGS = typeof fifoCogs.cogsAmount === 'object' && fifoCogs.cogsAmount?.toNumber 
            ? fifoCogs.cogsAmount.toNumber() 
            : Number(fifoCogs.cogsAmount);
          if (itemCOGS > 0) {
            cogsSource = 'customProductData';
            console.log(`[FIFO COGS] ✅ Using stored FIFO data for SaleItem ${item.id}: ${itemCOGS} (from batches)`);
          } else {
            console.warn(`[FIFO COGS] ⚠️ Stored FIFO data found but cogsAmount is 0 for SaleItem ${item.id}`);
          }
        } else {
          console.warn(`[FIFO COGS] ⚠️ No FIFO data in customProductData for SaleItem ${item.id}, customProductData:`, JSON.stringify(item.customProductData).substring(0, 200));
        }
      } else {
        console.warn(`[FIFO COGS] ⚠️ No customProductData for SaleItem ${item.id}`);
      }
      
      // Priority 2: Use FIFO consumption records if stored data not available
      if (itemCOGS === 0) {
        // First try by saleItemId
        if (item.id && fifoBySaleItem[item.id]) {
          itemCOGS = fifoBySaleItem[item.id];
          cogsSource = 'fifoConsumption';
        }
      }
      
      // Priority 3: Fall back to product cost at time of sale (stored in customProductData)
      if (itemCOGS === 0) {
        let productCost = 0;
        const quantity = Number(item.quantity || 0);
        
        // Parse customProductData if it's a string
        let customData = item.customProductData;
        if (typeof customData === 'string') {
          try {
            customData = JSON.parse(customData);
          } catch (e) {
            customData = null;
          }
        }
        
        // Try to get product cost at time of sale from customProductData
        if (customData && typeof customData === 'object' && customData.productCostAtSale !== undefined) {
          productCost = Number(customData.productCostAtSale);
          cogsSource = 'productCostAtSale';
          console.log(`[COGS] ✅ Using product cost at sale time for SaleItem ${item.id}: ${productCost}`);
        } else {
          // Last resort: use current product cost (not ideal, but better than 0)
          productCost = item.product.cost ? Number(item.product.cost) : 0;
          cogsSource = 'productCostCurrent';
          console.warn(`[COGS WARNING] ⚠️ Using CURRENT product.cost for SaleItem ${item.id} (cost at sale time not stored)! This COGS will change if product cost changes!`);
        }
        
        if (productCost > 0 && quantity > 0) {
          itemCOGS = quantity * productCost;
        }
      }
      
      // Debug logging - always log to help diagnose issues
      if (itemCOGS > 0) {
        console.log(`[COGS] SaleItem ${item.id}, Product ${item.productId}, Quantity: ${item.quantity}, COGS: ${itemCOGS}, Source: ${cogsSource}`);
        if (cogsSource === 'productCostCurrent') {
          console.warn(`[COGS WARNING] ⚠️ Using current product.cost instead of stored cost! Product: ${item.productId}, Cost: ${item.product.cost}`);
        }
      }
      
      if (itemCOGS > 0) {
        saleCOGS += itemCOGS;
      }
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

  // Also check invoices if needed
  const invoiceWhere = {
    tenantId,
    status: 'posted',
    issueDate: {
      gte: startDate,
      lte: endDate
    }
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
          product: {
            isNot: null
          }
        },
      include: {
        product: {
          select: {
            id: true,
            cost: true,
            name: true
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

    // Calculate COGS for each invoice
    for (const [invoiceId, items] of Object.entries(invoiceItemsByInvoice)) {
      let invoiceCOGS = 0;
      for (const item of items) {
        // Skip if product is a service or doesn't exist
        if (!item.product || item.product.isService) {
          continue;
        }
        
        // Get cost value (handle both Decimal and Float types)
        const productCost = item.product.cost ? Number(item.product.cost) : 0;
        const quantity = Number(item.quantity || 0);
        
        if (productCost > 0 && quantity > 0) {
          const itemCOGS = quantity * productCost;
          invoiceCOGS += itemCOGS;
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
