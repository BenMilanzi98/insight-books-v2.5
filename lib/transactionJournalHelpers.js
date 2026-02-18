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
      try {
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
      } catch (createError) {
        // If creation fails due to unique constraint (e.g., accountCode already exists), try to find it again
        if (createError.code === 'P2002' && accountCode) {
          console.warn(`⚠️ Account creation failed due to unique constraint, trying to find existing account with code ${accountCode}`);
          account = await tx.account.findFirst({
            where: {
              tenantId,
              accountCode,
              isActive: true,
            },
          });
          if (account) {
            console.log(`✅ Found existing account with code ${accountCode}: ${account.id} - ${account.accountName} (${account.accountType})`);
            // Verify account type matches - if not, log warning but use it anyway
            if (account.accountType !== accountType) {
              console.warn(`⚠️ Account type mismatch: Expected ${accountType}, found ${account.accountType}. Using existing account.`);
            }
          } else {
            // If still not found, try without accountCode constraint
            account = await tx.account.findFirst({
              where: {
                tenantId,
                accountName: { contains: accountName, mode: 'insensitive' },
                isActive: true,
              },
            });
            if (account) {
              console.log(`✅ Found existing account by name: ${account.id} - ${account.accountName}`);
            }
          }
        }
        
        // If still no account found, re-throw the error
        if (!account) {
          console.error(`❌ Failed to create or find account ${accountCode} - ${accountName}:`, createError);
          throw createError;
        }
      }
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
    findOrCreateAccount(tenantId, '1000', 'Cash', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Cash account:', err);
      // Retry once more
      try {
        return await findOrCreateAccount(tenantId, '1000', 'Cash', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Cash account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '1020', 'Bank', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Bank account:', err);
      try {
        return await findOrCreateAccount(tenantId, '1020', 'Bank', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Bank account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '1200', 'Accounts Receivable', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Accounts Receivable account:', err);
      // Retry once more - this is critical for invoices
      try {
        console.log('🔄 Retrying Accounts Receivable account creation...');
        return await findOrCreateAccount(tenantId, '1200', 'Accounts Receivable', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Accounts Receivable account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '2100', 'Accounts Payable', 'Liability', 'Credit', tx).catch(async (err) => {
      console.error('❌ Error getting Accounts Payable account:', err);
      try {
        return await findOrCreateAccount(tenantId, '2100', 'Accounts Payable', 'Liability', 'Credit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Accounts Payable account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '1300', 'Inventory', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Inventory account:', err);
      try {
        return await findOrCreateAccount(tenantId, '1300', 'Inventory', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Inventory account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '4000', 'Revenue', 'Revenue', 'Credit', tx).catch(async (err) => {
      console.error('❌ Error getting Revenue account:', err);
      try {
        return await findOrCreateAccount(tenantId, '4000', 'Revenue', 'Revenue', 'Credit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Revenue account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '4200', 'Service Revenue', 'Revenue', 'Credit', tx).catch(async (err) => {
      console.error('❌ Error getting Service Revenue account:', err);
      try {
        return await findOrCreateAccount(tenantId, '4200', 'Service Revenue', 'Revenue', 'Credit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Service Revenue account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '5000', 'Expense', 'Expense', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting COGS account:', err);
      try {
        return await findOrCreateAccount(tenantId, '5000', 'Expense', 'Expense', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for COGS account:', retryErr);
        return null;
      }
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
    throw new Error(`Payment method mapping failed for ${paymentMethod}: ${error.message}`);
  }
}

/**
 * Get expense account by category name
 */
export async function getExpenseAccount() {
  throw new Error('Expense account mapping by category is no longer supported. Provide an expenseAccountId.');
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
  items = [],
  paymentMethod,
  hasServices = false,
  cogsAmount = 0,
  taxAmount = 0,
  taxTypeId = null,
  paymentAccount: preFetchedPaymentAccount = null, // Optional pre-fetched account
  standardAccounts: preFetchedStandardAccounts = null, // Optional pre-fetched standard accounts
  referenceNumber: preGeneratedReferenceNumber = null, // Optional pre-generated reference number
  cogsReferenceNumber: preGeneratedCogsReferenceNumber = null, // Optional pre-generated COGS reference number
  tx = prisma,
}) {
  // Only check period if we're inside a transaction and haven't checked yet
  // If pre-fetched data is provided, period was likely already checked
  if (!preFetchedStandardAccounts || !preGeneratedReferenceNumber) {
    try {
      await assertPeriodOpen(tenantId, saleDate || new Date(), tx);
    } catch (error) {
      // If transaction is aborted, don't try to query again
      if (error.message?.includes('transaction is aborted') || error.message?.includes('25P02')) {
        throw new Error('Transaction was aborted. Cannot check accounting period.');
      }
      // Re-throw period lock errors
      if (error.code === 'PERIOD_LOCKED') {
        throw error;
      }
      // For other errors, log but continue (period check might not be configured)
      console.warn('⚠️ Period check failed inside transaction, continuing:', error.message);
    }
  }
  
  // Use pre-fetched accounts if provided, otherwise fetch them
  let accounts = preFetchedStandardAccounts;
  if (!accounts) {
    console.log('🔍 Getting standard accounts for tenant:', tenantId);
    accounts = await getStandardAccounts(tenantId, tx);
  }
  console.log('🔍 Accounts retrieved:', {
    cash: !!accounts.cash,
    bank: !!accounts.bank,
    salesRevenue: !!accounts.salesRevenue,
    serviceRevenue: !!accounts.serviceRevenue,
    cogs: !!accounts.cogs,
    inventory: !!accounts.inventory,
  });
  
  // Use pre-fetched account if provided, otherwise look it up
  let paymentAccount = preFetchedPaymentAccount;
  if (!paymentAccount && paymentMethod) {
    console.log('🔍 Getting payment account for method:', paymentMethod);
    try {
      paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
      console.log('🔍 Payment account retrieved:', paymentAccount ? paymentAccount.accountName : 'NULL');
    } catch (error) {
      // If transaction is aborted, don't try to query again
      if (error.message?.includes('transaction is aborted') || error.message?.includes('25P02')) {
        throw new Error('Transaction was aborted. Cannot lookup payment account.');
      }
      throw error;
    }
  }
  
  if (!paymentAccount) {
    const error = new Error('Payment account not found. Please set up your chart of accounts.');
    console.error('❌', error.message);
    throw error;
  }

  const entries = [];

  const entryDate = saleDate instanceof Date ? saleDate : new Date(saleDate);
  
  console.log('📝 Creating transaction for sale:', {
    saleId,
    saleNumber,
    totalAmount,
    paymentMethod,
    tenantId,
    entryDate,
  });
  
  // Use pre-generated reference number if provided, otherwise generate it
  let referenceNumber = preGeneratedReferenceNumber;
  if (!referenceNumber) {
    referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
  }
  console.log('📝 Generated reference number:', referenceNumber);

  // Use single default revenue account for all POS transactions
  // Priority: salesRevenue > serviceRevenue > first available Income/Revenue account
  let defaultRevenueAccount = accounts.salesRevenue;
  
  if (!defaultRevenueAccount && accounts.serviceRevenue) {
    console.log('⚠️ Using Service Revenue account as default (Sales Revenue not found)');
    defaultRevenueAccount = accounts.serviceRevenue;
  }
  
  if (!defaultRevenueAccount) {
    // Fallback: find any active Income or Revenue account
    console.log('⚠️ Default revenue accounts not found, searching for any Income/Revenue account...');
    defaultRevenueAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountType: { in: ['Income', 'Revenue'] },
        isActive: true,
      },
      orderBy: [
        { accountCode: 'asc' }, // Prefer accounts with codes
      ],
    });
  }
  
  if (!defaultRevenueAccount) {
    throw new Error(
      'Default revenue account not found. Please create a Revenue or Income account ' +
      '(e.g., account code 4000 - Revenue) in Chart of Accounts.'
    );
  }
  
  console.log('✅ Using default revenue account:', {
    id: defaultRevenueAccount.id,
    code: defaultRevenueAccount.accountCode,
    name: defaultRevenueAccount.accountName,
    type: defaultRevenueAccount.accountType,
  });

  // Calculate total net amount from all items (for validation)
  const normalizedItems = (items || []).map((item) => {
    const baseAmount = typeof item.amount === 'number'
      ? item.amount
      : (Number(item.quantity || 0) * Number(item.unitPrice || 0));
    const discount = Number(item.discountAmount || 0);
    return Math.max(0, baseAmount - discount);
  });

  const totalNet = normalizedItems.reduce((sum, amount) => sum + amount, 0);
  if (!normalizedItems.length || totalNet <= 0) {
    throw new Error('Sale items must include valid amounts.');
  }

  // Create revenue transaction lines with single default revenue account
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
      accountId: defaultRevenueAccount.id,
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

  // Check if transaction is still valid before creating Transaction record
  let revenueEntry;
  try {
    revenueEntry = await tx.transaction.create({
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
  } catch (error) {
    // Check if transaction is aborted
    if (error.message?.includes('transaction is aborted') || 
        error.message?.includes('25P02') ||
        error.code === 'P2034') {
      console.error('❌ Transaction was aborted before creating journal entry. This means an error occurred earlier in the sale creation process.');
      throw new Error(
        'Transaction was aborted. An error occurred earlier in the sale creation process. ' +
        'Please check that all sale items were created successfully, products exist, and accounts are valid. ' +
        `Original error: ${error.message}`
      );
    }
    // Re-throw other errors
    throw error;
  }

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
    // Use pre-generated COGS reference number if provided, otherwise generate it
    let cogsReferenceNumber = preGeneratedCogsReferenceNumber;
    if (!cogsReferenceNumber) {
      // Add a small delay to ensure unique reference numbers
      await new Promise(resolve => setTimeout(resolve, 10));
      cogsReferenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);
    }
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
  items = [],
  hasServices = false,
  cogsAmount = 0,
  taxAmount = 0,
  taxTypeId = null,
  tx = prisma,
}) {
  // IMPORTANT:
  // Use the global prisma client (NOT the interactive transaction client `tx`)
  // for Chart of Accounts lookups and period checks. Using the interactive
  // transaction client here was causing P2028 "Transaction already closed"
  // errors when the outer transaction ran longer than 5 seconds (e.g. due to COGS
  // calculations), which then made it look like the Accounts Receivable account
  // was "missing".
  //
  // Period lock check – safe outside the interactive transaction
  await assertPeriodOpen(tenantId, issueDate || new Date());

  // Get standard accounts using standalone prisma client (no transaction timeout)
  const accounts = await getStandardAccounts(tenantId);

  if (!accounts.accountsReceivable) {
    // Try to create the account one more time as a last resort
    console.warn('⚠️ Accounts Receivable account not found, attempting to create...');
    try {
      // Also use the standalone prisma client for this creation / lookup
      accounts.accountsReceivable = await findOrCreateAccount(
        tenantId,
        '1200',
        'Accounts Receivable',
        'Asset',
        'Debit'
      );
      console.log('✅ Accounts Receivable account created/found:', accounts.accountsReceivable.id);
    } catch (createError) {
      console.error('❌ Failed to create Accounts Receivable account:', createError);
      throw new Error('Accounts Receivable account not found and could not be created. Please set up your chart of accounts manually.');
    }
  }

  const entryDate = issueDate instanceof Date ? issueDate : new Date(issueDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const entries = [];

  const revenueBuckets = new Map();
  const normalizedItems = (items || []).map((item) => {
    const baseAmount = typeof item.amount === 'number'
      ? item.amount
      : (Number(item.quantity || 0) * Number(item.unitPrice || 0));
    const discount = Number(item.discountAmount || 0);
    const netAmount = Math.max(0, baseAmount - discount);
    return {
      accountId: item.accountId,
      netAmount,
    };
  });

  const totalNet = normalizedItems.reduce((sum, item) => sum + item.netAmount, 0);
  if (!normalizedItems.length || totalNet <= 0) {
    throw new Error('Invoice items must include valid account allocations.');
  }

  normalizedItems.forEach((item) => {
    if (!item.accountId) {
      throw new Error('Each invoice item must reference an income account.');
    }
    revenueBuckets.set(
      item.accountId,
      (revenueBuckets.get(item.accountId) || 0) + item.netAmount
    );
  });

  // Prepare revenue transaction lines
  const revenueLines = [
    {
      lineNumber: 1,
      accountId: accounts.accountsReceivable.id,
      debitAmount: totalAmount,
      creditAmount: 0,
      description: `Accounts receivable for invoice ${invoiceNumber}`,
    },
  ];

  const bucketEntries = Array.from(revenueBuckets.entries());
  let lineNumber = 2;
  let allocatedTotal = 0;
  bucketEntries.forEach(([accountId, amount], index) => {
    const ratio = amount / totalNet;
    const credit = index === bucketEntries.length - 1
      ? Number((totalAmount - allocatedTotal).toFixed(2))
      : Number((totalAmount * ratio).toFixed(2));
    allocatedTotal += credit;
    revenueLines.push({
      lineNumber: lineNumber++,
      accountId,
      debitAmount: 0,
      creditAmount: credit,
      description: `Revenue from invoice ${invoiceNumber}`,
    });
  });

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
    console.log('✅ COGS entry created successfully for invoice:', {
      invoiceNumber,
      cogsAmount,
      cogsAccountId: accounts.cogs.id,
      inventoryAccountId: accounts.inventory.id,
      transactionId: cogsEntry.id
    });
  } else {
    if (cogsAmount > 0) {
      console.warn('⚠️ COGS amount > 0 but entry not created for invoice:', {
        invoiceNumber,
        cogsAmount,
        hasCogsAccount: !!accounts.cogs,
        hasInventoryAccount: !!accounts.inventory,
        reason: !accounts.cogs ? 'Missing COGS account' : !accounts.inventory ? 'Missing Inventory account' : 'Unknown'
      });
    } else {
      console.log(`ℹ️ No COGS to record for invoice ${invoiceNumber} (cogsAmount = 0)`);
    }
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
  supplierId = null,
  paymentStatus = 'Fully paid',
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, expenseDate || new Date(), tx);
  if (!expenseAccountId) {
    throw new Error('Expense account is required for posting expenses.');
  }
  const expenseAccount = await tx.account.findFirst({
    where: { id: expenseAccountId, tenantId, isActive: true, accountType: 'Expense' }
  });

  if (!expenseAccount) {
    throw new Error('Expense account not found or inactive. Please set up your chart of accounts.');
  }

  const entryDate = expenseDate instanceof Date ? expenseDate : new Date(expenseDate);
  
  // Determine if this should be posted to Accounts Payable (supplier expense, not yet paid)
  const isAccountsPayable = supplierId && paymentStatus === 'Pending';
  
  let creditAccount = null;
  let creditDescription = '';
  
  if (isAccountsPayable) {
    // Get or find Accounts Payable account
    creditAccount = await tx.account.findFirst({
      where: {
        tenantId,
        OR: [
          { accountCode: '2000' },
          { accountCode: '2100' }
        ],
        accountType: 'Liability',
        isActive: true
      }
    });

    if (!creditAccount) {
      creditAccount = await tx.account.findFirst({
        where: {
          tenantId,
          accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
          accountType: 'Liability',
          isActive: true
        }
      });
    }

    if (!creditAccount) {
      throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
    }

    // Get supplier name for description
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { supplierName: true }
    });
    
    creditDescription = `Accounts Payable - ${supplier?.supplierName || 'Supplier'}`;
    
    // Update supplier balance
    if (supplier) {
      await tx.supplier.update({
        where: { id: supplierId },
        data: {
          currentBalance: {
            increment: amount
          }
        }
      });
    }
  } else {
    // Get payment account for cash/bank payment
    creditAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
    
    if (!creditAccount) {
      throw new Error('Payment account not found. Please set up your chart of accounts.');
    }
    
    creditDescription = `Payment for expense`;
  }
  
  console.log('📝 Creating transaction for expense:', {
    expenseId,
    amount,
    expenseAccountId,
    paymentMethod,
    supplierId,
    paymentStatus,
    isAccountsPayable,
    creditAccountId: creditAccount?.id,
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
      description: `Expense: ${category}${supplierId ? ' (Supplier)' : ''}`,
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
            accountId: creditAccount.id,
            debitAmount: 0,
            creditAmount: amount,
            description: creditDescription,
          },
        ],
      },
    },
    include: { lines: true },
  });

  console.log('✅ Successfully created expense transaction:', entry.id);

  // Auto-post tax if tax amount and tax type are provided
  if (taxAmount > 0 && taxTypeId) {
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
  }

  return entry;
}

/**
 * Create journal entry for payment of supplier expense (debit AP, credit cash)
 */
export async function createExpensePaymentJournalEntry({
  tenantId,
  userId,
  expenseId,
  paymentId,
  paymentAmount,
  paymentMethod,
  paymentDate,
  supplierId,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, paymentDate || new Date(), tx);
  
  // Get Accounts Payable account
  let apAccount = await tx.account.findFirst({
    where: {
      tenantId,
      OR: [
        { accountCode: '2000' },
        { accountCode: '2100' }
      ],
      accountType: 'Liability',
      isActive: true
    }
  });

  if (!apAccount) {
    apAccount = await tx.account.findFirst({
      where: {
        tenantId,
        accountName: { contains: 'Accounts Payable', mode: 'insensitive' },
        accountType: 'Liability',
        isActive: true
      }
    });
  }

  if (!apAccount) {
    throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
  }

  // Get payment account
  const paymentAccount = await getPaymentAccount(tenantId, paymentMethod, tx);
  if (!paymentAccount) {
    throw new Error('Payment account not found. Please set up your chart of accounts.');
  }

  // Get supplier name
  const supplier = supplierId ? await tx.supplier.findFirst({
    where: { id: supplierId, tenantId },
    select: { supplierName: true }
  }) : null;

  const entryDate = paymentDate instanceof Date ? paymentDate : new Date(paymentDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const entry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Payment for supplier expense${supplier ? ` - ${supplier.supplierName}` : ''}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'ExpensePayment',
      sourceId: paymentId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: {
        create: [
          {
            lineNumber: 1,
            accountId: apAccount.id,
            debitAmount: paymentAmount,
            creditAmount: 0,
            description: `Accounts Payable - Payment${supplier ? ` to ${supplier.supplierName}` : ''}`,
          },
          {
            lineNumber: 2,
            accountId: paymentAccount.id,
            debitAmount: 0,
            creditAmount: paymentAmount,
            description: `Payment via ${paymentMethod}`,
          },
        ],
      },
    },
    include: { lines: true },
  });

  // Update supplier balance
  if (supplierId) {
    await tx.supplier.update({
      where: { id: supplierId },
      data: {
        currentBalance: {
          decrement: paymentAmount
        }
      }
    });
  }

  // Update account balances
  const { updateAccountBalanceOnTransaction } = await import('./accountBalanceService');
  for (const line of entry.lines) {
    await updateAccountBalanceOnTransaction(
      line.accountId,
      line.debitAmount,
      line.creditAmount,
      tx
    );
  }

  return entry;
}
