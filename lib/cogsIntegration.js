// lib/cogsIntegration.js
import prisma from '@/lib/prisma';

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
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (product && product.cost) {
        const itemCOGS = item.quantity * product.cost;
        totalCOGS += itemCOGS;
        
        cogsItems.push({
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          cost: product.cost,
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
export async function getCOGSTransactionStats(tenantId, startDate, endDate) {
  if (!tenantId) {
    throw new Error('tenantId is required when fetching COGS stats');
  }

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

  if (!cogsAccounts.length) {
    return {
      totalAmount: 0,
      lineCount: 0,
      transactionCount: 0,
      accounts: [],
      breakdownBySource: [],
      topTransactions: []
    };
  }

  const accountIds = cogsAccounts.map((account) => account.id);

  const cogsLines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: accountIds },
      transaction: {
        tenantId,
        status: 'posted',
        date: {
          gte: startDate,
          lte: endDate
        },
        sourceType: {
          in: ['Sale', 'Invoice']
        }
      }
    },
    include: {
      account: {
        select: {
          accountName: true,
          accountCode: true,
          name: true
        }
      },
      transaction: {
        select: {
          id: true,
          date: true,
          sourceType: true,
          sourceId: true,
          description: true,
          reference: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  const breakdownBySource = {};
  const transactionAggregates = new Map();

  let totalAmount = 0;

  cogsLines.forEach((line) => {
    const debit = Number(line.debitAmount || 0);
    const credit = Number(line.creditAmount || 0);
    const lineAmount = debit - credit;

    totalAmount += lineAmount;

    const sourceType = line.transaction?.sourceType || 'Unknown';
    if (!breakdownBySource[sourceType]) {
      breakdownBySource[sourceType] = {
        sourceType,
        amount: 0,
        count: 0
      };
    }
    breakdownBySource[sourceType].amount += lineAmount;
    breakdownBySource[sourceType].count += 1;

    const transactionId = line.transaction?.id;
    if (transactionId) {
      if (!transactionAggregates.has(transactionId)) {
        transactionAggregates.set(transactionId, {
          transactionId,
          date: line.transaction?.date,
          sourceType: line.transaction?.sourceType,
          sourceId: line.transaction?.sourceId,
          reference: line.transaction?.reference,
          description: line.transaction?.description,
          amount: 0
        });
      }
      const aggregate = transactionAggregates.get(transactionId);
      aggregate.amount += lineAmount;
    }
  });

  const breakdownBySourceArr = Object.values(breakdownBySource).sort(
    (a, b) => b.amount - a.amount
  );

  const topTransactions = Array.from(transactionAggregates.values())
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10)
    .map((tx) => ({
      ...tx,
      date: tx.date ? tx.date.toISOString().split('T')[0] : null
    }));

  return {
    totalAmount,
    lineCount: cogsLines.length,
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
