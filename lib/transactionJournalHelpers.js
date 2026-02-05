import prisma from './prisma';
import { generateReferenceNumber } from './journalService';
import { validateTransactionBalance, validateTransaction } from './accountingValidation';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';
import { assertPeriodOpen } from './accountingPeriodService';
import { getTaxType, autoPostTaxEntry } from './taxCalculationService';

// NOTE: This file now uses Transaction model instead of JournalEntry
// Transaction model supports double-entry bookkeeping with TransactionLine

/**
 * Helper to find or create accounts by code or name
 */
async function findOrCreateAccount(tenantId, accountCode, accountName, accountType, normalBalance, tx = prisma) {
  try {
    // First try to find by exact code
    let account = accountCode ? await tx.account.findFirst({
      where: {
        tenantId,
        accountCode,
        accountType,
        isActive: true,
      },
    }) : null;

    // If not found by code, try to find by name (contains match)
    if (!account) {
      account = await tx.account.findFirst({
        where: {
          tenantId,
          accountName: { contains: accountName, mode: 'insensitive' },
          accountType,
          isActive: true,
        },
      });
    }

    // If still not found, try flexible name matching (e.g., "Cash" matches "Cash on Hand")
    if (!account) {
      const nameWords = accountName.toLowerCase().split(/\s+/).filter(w => w.length > 2); // Filter out short words
      const allAccounts = await tx.account.findMany({
        where: {
          tenantId,
          accountType,
          isActive: true,
        },
      });
      
      // Find account where any significant word in the search name appears in the account name
      account = allAccounts.find(acc => {
        const accName = acc.accountName.toLowerCase();
        // Check if any word from search name is in account name, or vice versa
        return nameWords.some(word => accName.includes(word)) || 
               accName.split(/\s+/).some(accWord => accountName.toLowerCase().includes(accWord));
      });
    }

    if (!account) {
      console.log(`📝 Creating account: ${accountCode} - ${accountName} (${accountType})`);
      // Auto-create the account if it doesn't exist
      account = await tx.account.create({
        data: {
          tenantId,
          accountCode: accountCode || null,
          accountName,
          accountType,
          normalBalance: normalBalance || (['Asset', 'Expense'].includes(accountType) ? 'Debit' : 'Credit'),
          isActive: true,
          balance: 0,
        },
      });
      console.log(`✅ Account created: ${account.id} - ${account.accountName}`);
    } else {
      console.log(`✅ Account found: ${account.id} - ${account.accountName} (${account.accountCode || 'N/A'})`);
    }

    return account;
  } catch (error) {
    console.error(`❌ Error finding/creating account ${accountCode} - ${accountName}:`, error);
    throw error;
  }
}

/**
 * Helper to find accounts by code or name (legacy - throws error if not found)
 */
async function findAccount(tenantId, accountCode, accountName, accountType, tx = prisma) {
  const account = await tx.account.findFirst({
    where: {
      tenantId,
      OR: [
        { accountCode },
        { accountName: { contains: accountName, mode: 'insensitive' } },
      ],
      accountType,
      isActive: true,
    },
  });

  if (!account) {
    throw new Error(
      `Account not found: ${accountCode || accountName} (${accountType}). Please set up your chart of accounts.`
    );
  }

  return account;
}

/**
 * Get standard accounts for a tenant
 */
export async function getStandardAccounts(tenantId, tx = prisma) {
  console.log('🔍 Getting standard accounts for tenant:', tenantId);
  
  const [
    cashAccount,
    bankAccount,
    accountsReceivable,
    accountsPayable,
    inventoryAccount,
    revenueAccount,
    serviceRevenueAccount,
    cogsAccount,
  ] = await Promise.all([
    findOrCreateAccount(tenantId, '1000', 'Cash', 'Asset', 'Debit', tx).catch((err) => {
      console.error('❌ Error getting Cash account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '1020', 'Bank', 'Asset', 'Debit', tx).catch((err) => {
      console.error('❌ Error getting Bank account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '1200', 'Accounts Receivable', 'Asset', 'Debit', tx).catch((err) => {
      console.error('❌ Error getting Accounts Receivable account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '2100', 'Accounts Payable', 'Liability', 'Credit', tx).catch((err) => {
      console.error('❌ Error getting Accounts Payable account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '1300', 'Inventory', 'Asset', 'Debit', tx).catch((err) => {
      console.error('❌ Error getting Inventory account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '4000', 'Revenue', 'Revenue', 'Credit', tx).catch((err) => {
      console.error('❌ Error getting Revenue account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '4200', 'Service Revenue', 'Revenue', 'Credit', tx).catch((err) => {
      console.error('❌ Error getting Service Revenue account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '5000', 'Cost of Goods Sold', 'Expense', 'Debit', tx).catch((err) => {
      console.error('❌ Error getting COGS account:', err);
      return null;
    }),
  ]);

  console.log('🔍 Accounts retrieved:', {
    cash: cashAccount ? cashAccount.accountName : 'NULL',
    bank: bankAccount ? bankAccount.accountName : 'NULL',
    salesRevenue: revenueAccount ? revenueAccount.accountName : 'NULL',
    serviceRevenue: serviceRevenueAccount ? serviceRevenueAccount.accountName : 'NULL',
    cogs: cogsAccount ? cogsAccount.accountName : 'NULL',
    inventory: inventoryAccount ? inventoryAccount.accountName : 'NULL',
  });

  return {
    cash: cashAccount,
    bank: bankAccount,
    accountsReceivable,
    accountsPayable,
    inventory: inventoryAccount,
    salesRevenue: revenueAccount,
    serviceRevenue: serviceRevenueAccount,
    cogs: cogsAccount,
  };
}

/**
 * Get payment account based on payment method
 * Uses centralized payment method mapping service
 */
export async function getPaymentAccount(tenantId, paymentMethod, tx = prisma) {
  // Import the centralized mapping service
  const { getAccountForPaymentMethod } = await import('./paymentMethodAccountMapping');
  
  try {
    return await getAccountForPaymentMethod(tenantId, paymentMethod, tx);
  } catch (error) {
    // Fallback to old method if new one fails
    console.warn(`⚠️ Payment method mapping failed for ${paymentMethod}, using fallback:`, error.message);
    
    const accounts = await getStandardAccounts(tenantId, tx);
    const methodMap = {
      cash: accounts.cash,
      'Cash': accounts.cash,
      'Bank Transfer': accounts.bank,
      'bank': accounts.bank,
      'Airtel Money': accounts.bank,
      'Mpamba': accounts.bank,
      'PayChangu': accounts.bank,
    };

    const selectedAccount = methodMap[paymentMethod] || accounts.cash || accounts.bank;
    
    if (!selectedAccount) {
      return await findOrCreateAccount(tenantId, '1000', 'Cash', 'Asset', 'Debit', tx);
    }
    
    return selectedAccount;
  }
}

/**
 * Get expense account by category name
 */
export async function getExpenseAccount(tenantId, category, tx = prisma) {
  // Try to find a specific account for this category
  const categoryMap = {
    'Rent': { code: '5210', name: 'Rent Expense' },
    'Utilities': { code: '5220', name: 'Utilities Expense' },
    'Salaries': { code: '5230', name: 'Salaries Expense' },
    'Marketing': { code: '5240', name: 'Marketing & Advertising' },
    'Office Supplies': { code: '5250', name: 'Office Supplies' },
    'Professional Services': { code: '5260', name: 'Professional Services' },
    'Travel': { code: '5270', name: 'Travel & Accommodation' },
    'Vehicle': { code: '5280', name: 'Vehicle Expenses' },
  };

  const accountInfo = categoryMap[category] || { code: '5200', name: 'Operating Expenses' };

  try {
    return await findOrCreateAccount(tenantId, accountInfo.code, accountInfo.name, 'Expense', 'Debit', tx);
  } catch {
    // Fallback to Operating Expenses
    return await findOrCreateAccount(tenantId, '5200', 'Operating Expenses', 'Expense', 'Debit', tx);
  }
}

/**
 * Create journal entry for a sale
 * Entry 1: Revenue recognition (Debit: Cash/AR, Credit: Revenue)
 * Entry 2: COGS recognition (Debit: COGS, Credit: Inventory)
 */
export async function createSaleJournalEntries({
  tenantId,
  userId,
  saleId,
  saleNumber,
  saleDate,
  totalAmount,
  paymentMethod,
  hasServices = false,
  cogsAmount = 0,
  taxAmount = 0,
  taxTypeId = null,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, saleDate || new Date(), tx);
  console.log('🔍 Getting standard accounts for tenant:', tenantId);
  const accounts = await getStandardAccounts(tenantId, tx);
  console.log('🔍 Accounts retrieved:', {
    cash: !!accounts.cash,
    bank: !!accounts.bank,
    salesRevenue: !!accounts.salesRevenue,
    serviceRevenue: !!accounts.serviceRevenue,
    cogs: !!accounts.cogs,
    inventory: !!accounts.inventory,
  });
  
  if (!accounts.salesRevenue && !accounts.serviceRevenue) {
    const error = new Error('Revenue account not found. Please set up your chart of accounts.');
    console.error('❌', error.message);
    throw error;
  }
  
  console.log('🔍 Getting payment account for method:', paymentMethod);
  const paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
  console.log('🔍 Payment account retrieved:', paymentAccount ? paymentAccount.accountName : 'NULL');
  
  if (!paymentAccount) {
    const error = new Error('Payment account not found. Please set up your chart of accounts.');
    console.error('❌', error.message);
    throw error;
  }

  const entries = [];

  // Entry 1: Revenue Recognition
  const revenueAccount = hasServices
    ? accounts.serviceRevenue || accounts.salesRevenue
    : accounts.salesRevenue;

  console.log('🔍 Revenue account:', revenueAccount ? revenueAccount.accountName : 'NULL');

  if (!revenueAccount) {
    console.error('❌ Revenue account not found!');
    throw new Error('Revenue account not found. Please set up your chart of accounts.');
  }

  if (!paymentAccount) {
    console.error('❌ Payment account not found!');
    throw new Error('Payment account not found. Please set up your chart of accounts.');
  }

  const entryDate = saleDate instanceof Date ? saleDate : new Date(saleDate);
  
  console.log('📝 Creating transaction for sale:', {
    saleId,
    saleNumber,
    totalAmount,
    paymentMethod,
    tenantId,
    entryDate,
  });
  
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
  console.log('📝 Generated reference number:', referenceNumber);

  // Prepare transaction lines for validation
  const revenueLines = [
    {
      lineNumber: 1,
      accountId: paymentAccount.id,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: `Payment received for sale ${saleNumber}`,
    },
    {
      lineNumber: 2,
      accountId: revenueAccount.id,
      debitAmount: 0,
      creditAmount: totalAmount,
      description: `Revenue from sale ${saleNumber}`,
    },
  ];

  // Validate transaction balance
  const balanceValidation = validateTransactionBalance(revenueLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Revenue transaction validation failed: ${balanceValidation.error}`);
  }

  const revenueEntry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Sale ${saleNumber} - Revenue Recognition`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'Sale',
      sourceId: saleId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: revenueLines,
      },
    },
    include: { lines: true },
  });

  // Update account balances for revenue transaction
  for (const line of revenueEntry.lines) {
    await updateAccountBalanceOnTransaction(
      line.accountId,
      line.debitAmount,
      line.creditAmount,
      tx
    );
  }

  entries.push(revenueEntry);

  // Auto-post tax if tax amount and tax type are provided
  if (taxAmount > 0 && taxTypeId) {
    try {
      const taxEntry = await autoPostTaxEntry({
        tenantId,
        userId,
        taxTypeId,
        taxAmount,
        transactionDate: entryDate,
        sourceType: 'Sale',
        sourceId: saleId,
        description: `VAT/Tax for sale ${saleNumber}`,
        tx
      });
      if (taxEntry) {
        entries.push(taxEntry);
      }
    } catch (taxError) {
      console.error('Error auto-posting tax for sale:', taxError);
      // Don't fail the entire sale if tax posting fails
    }
  }

  // Entry 2: COGS Recognition (only if there's COGS)
  console.log('🔍 COGS Entry Check for Sale:', {
    cogsAmount,
    hasCogsAccount: !!accounts.cogs,
    hasInventoryAccount: !!accounts.inventory,
    cogsAccountId: accounts.cogs?.id,
    inventoryAccountId: accounts.inventory?.id,
    cogsAccountName: accounts.cogs?.accountName || accounts.cogs?.name,
    inventoryAccountName: accounts.inventory?.accountName || accounts.inventory?.name,
    willCreateCOGSEntry: cogsAmount > 0 && accounts.cogs && accounts.inventory
  });
  
  if (cogsAmount > 0 && accounts.cogs && accounts.inventory) {
    // Add a small delay to ensure unique reference numbers
    await new Promise(resolve => setTimeout(resolve, 10));
    const cogsReferenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
    console.log('📝 Generated COGS reference number:', cogsReferenceNumber);
    
    // Prepare COGS transaction lines for validation
    const cogsLines = [
      {
        lineNumber: 1,
        accountId: accounts.cogs.id,
        debitAmount: cogsAmount,
        creditAmount: 0,
        description: `COGS for sale ${saleNumber}`,
      },
      {
        lineNumber: 2,
        accountId: accounts.inventory.id,
        debitAmount: 0,
        creditAmount: cogsAmount,
        description: `Inventory reduction for sale ${saleNumber}`,
      },
    ];

    // Validate COGS transaction balance
    const cogsBalanceValidation = validateTransactionBalance(cogsLines);
    if (!cogsBalanceValidation.isValid) {
      throw new Error(`COGS transaction validation failed: ${cogsBalanceValidation.error}`);
    }
    
    const cogsEntry = await tx.transaction.create({
      data: {
        tenantId,
        date: entryDate,
        reference: cogsReferenceNumber,
        description: `Sale ${saleNumber} - COGS Recognition`,
        entryType: 'Regular',
        status: 'posted',
        sourceType: 'Sale',
        sourceId: saleId,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        lines: {
          create: cogsLines,
        },
      },
      include: { lines: true },
    });

    // Update account balances for COGS transaction
    for (const line of cogsEntry.lines) {
      await updateAccountBalanceOnTransaction(
        line.accountId,
        line.debitAmount,
        line.creditAmount,
        tx
      );
    }

    entries.push(cogsEntry);
    console.log('✅ COGS entry created successfully:', {
      saleNumber,
      cogsAmount,
      cogsAccountId: accounts.cogs.id,
      inventoryAccountId: accounts.inventory.id
    });
  } else {
    if (cogsAmount > 0) {
      console.warn('⚠️ COGS amount > 0 but entry not created:', {
        cogsAmount,
        hasCogsAccount: !!accounts.cogs,
        hasInventoryAccount: !!accounts.inventory,
        reason: !accounts.cogs ? 'Missing COGS account' : !accounts.inventory ? 'Missing Inventory account' : 'Unknown'
      });
    } else {
      console.log('ℹ️ No COGS to record (cogsAmount = 0)');
    }
  }

  console.log('✅ Successfully created transactions:', entries.length);
  return entries;
}

/**
 * Create journal entry for an invoice
 * Entry: Revenue recognition (Debit: Accounts Receivable, Credit: Revenue)
 */
export async function createInvoiceJournalEntry({
  tenantId,
  userId,
  invoiceId,
  invoiceNumber,
  issueDate,
  totalAmount,
  hasServices = false,
  cogsAmount = 0,
  taxAmount = 0,
  taxTypeId = null,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, invoiceDate || new Date(), tx);
  const accounts = await getStandardAccounts(tenantId, tx);

  if (!accounts.accountsReceivable) {
    throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
  }

  const revenueAccount = hasServices
    ? accounts.serviceRevenue || accounts.salesRevenue
    : accounts.salesRevenue;

  if (!revenueAccount) {
    throw new Error('Revenue account not found. Please set up your chart of accounts.');
  }

  const entryDate = issueDate instanceof Date ? issueDate : new Date(issueDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const entries = [];

  // Prepare revenue transaction lines
  const revenueLines = [
    {
      lineNumber: 1,
      accountId: accounts.accountsReceivable.id,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: `Accounts receivable for invoice ${invoiceNumber}`,
    },
    {
      lineNumber: 2,
      accountId: revenueAccount.id,
      debitAmount: 0,
      creditAmount: totalAmount,
      description: `Revenue from invoice ${invoiceNumber}`,
    },
  ];

  // Validate transaction balance
  const balanceValidation = validateTransactionBalance(revenueLines);
  if (!balanceValidation.isValid) {
    throw new Error(`Revenue transaction validation failed: ${balanceValidation.error}`);
  }

  // Entry 1: Revenue Recognition
  const revenueEntry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Invoice ${invoiceNumber} - Revenue Recognition`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'Invoice',
      sourceId: invoiceId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: revenueLines,
      },
    },
    include: { lines: true },
  });

  entries.push(revenueEntry);

  // Auto-post tax if tax amount and tax type are provided
  if (taxAmount > 0 && taxTypeId) {
    try {
      const taxEntry = await autoPostTaxEntry({
        tenantId,
        userId,
        taxTypeId,
        taxAmount,
        transactionDate: entryDate,
        sourceType: 'Invoice',
        sourceId: invoiceId,
        description: `VAT/Tax for invoice ${invoiceNumber}`,
        tx
      });
      if (taxEntry) {
        entries.push(taxEntry);
      }
    } catch (taxError) {
      console.error('Error auto-posting tax for invoice:', taxError);
      // Don't fail the entire invoice if tax posting fails
    }
  }

  // Entry 2: COGS Recognition (only if there's COGS)
  if (cogsAmount > 0 && accounts.cogs && accounts.inventory) {
    // Add a small delay to ensure unique reference numbers
    await new Promise(resolve => setTimeout(resolve, 10));
    const cogsReferenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
    console.log('📝 Generated COGS reference number for invoice:', cogsReferenceNumber);
    
    // Prepare COGS transaction lines
    const cogsLines = [
      {
        lineNumber: 1,
        accountId: accounts.cogs.id,
        debitAmount: cogsAmount,
        creditAmount: 0,
        description: `COGS for invoice ${invoiceNumber}`,
      },
      {
        lineNumber: 2,
        accountId: accounts.inventory.id,
        debitAmount: 0,
        creditAmount: cogsAmount,
        description: `Inventory reduction for invoice ${invoiceNumber}`,
      },
    ];

    // Validate COGS transaction balance
    const cogsBalanceValidation = validateTransactionBalance(cogsLines);
    if (!cogsBalanceValidation.isValid) {
      throw new Error(`COGS transaction validation failed: ${cogsBalanceValidation.error}`);
    }
    
    const cogsEntry = await tx.transaction.create({
      data: {
        tenantId,
        date: entryDate,
        reference: cogsReferenceNumber,
        description: `Invoice ${invoiceNumber} - COGS Recognition`,
        entryType: 'Regular',
        status: 'posted',
        sourceType: 'Invoice',
        sourceId: invoiceId,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        lines: {
          create: cogsLines,
        },
      },
      include: { lines: true },
    });

    entries.push(cogsEntry);
    console.log('✅ COGS journal entry created for invoice:', invoiceNumber, 'Amount:', cogsAmount);
  }

  return entries.length === 1 ? entries[0] : entries;
}

/**
 * Create journal entry for invoice payment
 * Entry: Payment received (Debit: Cash/Bank, Credit: Accounts Receivable)
 */
export async function createInvoicePaymentJournalEntry({
  tenantId,
  userId,
  invoiceId,
  invoiceNumber,
  paymentDate,
  paymentAmount,
  paymentMethod,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, paymentDate || new Date(), tx);
  const accounts = await getStandardAccounts(tenantId, tx);
  const paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);

  if (!accounts.accountsReceivable) {
    throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
  }

  if (!paymentAccount) {
    throw new Error('Payment account not found. Please set up your chart of accounts.');
  }

  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const entry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Payment received for Invoice ${invoiceNumber}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'InvoicePayment',
      sourceId: invoiceId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: paymentAccount.id,
            debitAmount: paymentAmount,
            creditAmount: 0,
            description: `Payment received for invoice ${invoiceNumber}`,
          },
          {
            lineNumber: 2,
            accountId: accounts.accountsReceivable.id,
            debitAmount: 0,
            creditAmount: paymentAmount,
            description: `Accounts receivable reduction for invoice ${invoiceNumber}`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  return entry;
}

/**
 * Create journal entry for an expense
 * Entry: Expense recognition (Debit: Expense Account, Credit: Cash/Bank)
 */
export async function createExpenseJournalEntry({
  tenantId,
  userId,
  expenseId,
  expenseDate,
  amount,
  category,
  expenseAccountId,
  paymentMethod,
  taxAmount = 0,
  taxTypeId = null,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, expenseDate || new Date(), tx);
  const expenseAccount = expenseAccountId
    ? await tx.account.findFirst({
        where: { id: expenseAccountId, tenantId }
      })
    : await getExpenseAccount(tenantId, category, tx);
  const paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);

  if (!expenseAccount) {
    throw new Error(`Expense account not found for category: ${category}. Please set up your chart of accounts.`);
  }

  if (!paymentAccount) {
    throw new Error('Payment account not found. Please set up your chart of accounts.');
  }

  const entryDate = expenseDate instanceof Date ? expenseDate : new Date(expenseDate);
  
  console.log('📝 Creating transaction for expense:', {
    expenseId,
    amount,
    category,
    paymentMethod,
    tenantId,
    entryDate,
  });
  
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
  console.log('📝 Generated reference number:', referenceNumber);

  const entry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Expense: ${category}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'Expense',
      sourceId: expenseId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: expenseAccount.id,
            debitAmount: amount,
            creditAmount: 0,
            description: `Expense: ${category}`,
          },
          {
            lineNumber: 2,
            accountId: paymentAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description: `Payment for expense`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  console.log('✅ Successfully created expense transaction:', entry.id);

  // Auto-post tax if tax amount and tax type are provided
  if (taxAmount > 0 && taxTypeId) {
    try {
      await autoPostTaxEntry({
        tenantId,
        userId,
        taxTypeId,
        taxAmount,
        transactionDate: entryDate,
        sourceType: 'Expense',
        sourceId: expenseId,
        description: `VAT/Tax for expense: ${category}`,
        tx
      });
    } catch (taxError) {
      console.error('Error auto-posting tax for expense:', taxError);
      // Don't fail the entire expense if tax posting fails
    }
  }

  return entry;
}

