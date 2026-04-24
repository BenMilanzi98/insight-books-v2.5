import prisma from './prisma';
import { findAccountsPayableGlAccount } from './coaPostingCodes';
import { resolveOrEnsureInventoryGlAccount, isClearlyNotInventory } from './inventoryGlAccount';
import { generateReferenceNumber } from './journalService';
import { validateTransactionBalance, validateTransaction } from './accountingValidation';
import { updateAccountBalanceOnTransaction } from './accountBalanceService';
import { assertPeriodOpen } from './accountingPeriodService';
import { getTaxType, autoPostTaxEntry } from './taxCalculationService';
import { getFixedTaxInflowAccount, getFixedTaxOutflowAccount } from './taxAccountsInitialization';
import { isCoaStructuralRootCode } from './coaPostingCodes.js';

/**
 * Get the fixed account for tax collected (inflow from sales/invoices).
 * Always returns account 2041 – Tax Inflow (Collected); tenants cannot change this.
 * @returns {Promise<{ id: string, accountName?: string }|null>} Account or null
 */
export async function getTaxInflowAccount(tenantId, tx = prisma) {
  return await getFixedTaxInflowAccount(tenantId, tx);
}

/**
 * Get the fixed account for tax on outflows (expenses, supplier bills).
 * Always returns account 2045 – Tax Outflow (Paid); tenants cannot change this.
 * @returns {Promise<{ id: string }|null>} Account or null
 */
export async function getTaxOutflowAccount(tenantId, tx = prisma) {
  return await getFixedTaxOutflowAccount(tenantId, tx);
}

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

    if (account && accountCode === '1300' && isClearlyNotInventory(account)) {
      account = null;
    }

    const inventoryNameGuard =
      accountCode === '1300' || /inventory|stock/i.test(accountName || '');

    // If not found by code, try to find by name (contains match)
    if (!account) {
      account = await tx.account.findFirst({
        where: {
          tenantId,
          accountName: { contains: accountName, mode: 'insensitive' },
          accountType,
          isActive: true,
          ...(inventoryNameGuard
            ? {
                NOT: {
                  OR: [
                    { accountCode: '1200' },
                    { accountName: { contains: 'Receivable', mode: 'insensitive' } },
                  ],
                },
              }
            : {}),
        },
      });
      if (account && inventoryNameGuard && isClearlyNotInventory(account)) {
        account = null;
      }
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
        if (
          (accountCode === '1300' || /inventory|stock/i.test(accountName || '')) &&
          isClearlyNotInventory(acc)
        ) {
          return false;
        }
        const accName = (acc.accountName || '').toLowerCase();
        // Check if any word from search name is in account name, or vice versa
        return nameWords.some(word => accName.includes(word)) || 
               accName.split(/\s+/).some(accWord => accountName.toLowerCase().includes(accWord));
      });
    }

    if (!account) {
      if (accountCode && isCoaStructuralRootCode(accountCode)) {
        throw new Error(
          `Refusing to auto-create structural chart root ${accountCode} (${accountName}). ` +
            `Run Chart of Accounts setup — postings must use leaf accounts under this section, not the root.`
        );
      }
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

  const resolveBankLikeAsset = async () => {
    const group1130 = await tx.account.findFirst({
      where: { tenantId, accountCode: '1130', isActive: true, accountType: 'Asset' },
      select: { id: true },
    });
    if (group1130?.id) {
      const child = await tx.account.findFirst({
        where: { tenantId, parentAccountId: group1130.id, isActive: true, accountType: 'Asset' },
        orderBy: { accountCode: 'asc' },
      });
      if (child) return child;
    }
    return findOrCreateAccount(tenantId, '1130-01', 'National Bank', 'Asset', 'Debit', tx).catch(() => null);
  };

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
    findOrCreateAccount(tenantId, '1110', 'Cash - Main Account', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Cash account:', err);
      try {
        return await findOrCreateAccount(tenantId, '1110', 'Cash - Main Account', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Cash account:', retryErr);
        return null;
      }
    }),
    resolveBankLikeAsset().catch(async (err) => {
      console.error('❌ Error getting Bank account:', err);
      return null;
    }),
    findOrCreateAccount(tenantId, '1200', 'Accounts Receivable', 'Asset', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting Accounts Receivable account:', err);
      try {
        console.log('🔄 Retrying Accounts Receivable account creation...');
        return await findOrCreateAccount(tenantId, '1200', 'Accounts Receivable', 'Asset', 'Debit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Accounts Receivable account:', retryErr);
        return null;
      }
    }),
    (async () => {
      const ap = await findAccountsPayableGlAccount(tenantId, tx);
      if (ap) return ap;
      return findOrCreateAccount(tenantId, '2110', 'Accounts Payable', 'Liability', 'Credit', tx).catch(
        async (err) => {
          console.error('❌ Error getting Accounts Payable account:', err);
          return findOrCreateAccount(tenantId, '2110', 'Accounts Payable', 'Liability', 'Credit', tx);
        },
      );
    })(),
    resolveOrEnsureInventoryGlAccount(tenantId, tx).catch(async (err) => {
      console.error('❌ Error getting Inventory account:', err);
      try {
        return await resolveOrEnsureInventoryGlAccount(tenantId, tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Inventory account:', retryErr);
        return null;
      }
    }),
    findOrCreateAccount(tenantId, '4100', 'Product Sales', 'Income', 'Credit', tx).catch(async (err) => {
      console.error('❌ Error getting Revenue account:', err);
      try {
        return await findOrCreateAccount(tenantId, '4100', 'Product Sales', 'Income', 'Credit', tx);
      } catch (retryErr) {
        console.error('❌ Retry failed for Revenue account:', retryErr);
        return null;
      }
    }),
    (async () => {
      let acc = await tx.account.findFirst({
        where: { tenantId, accountCode: '4150', accountType: 'Income', isActive: true },
      });
      if (acc) return acc;
      acc = await tx.account.findFirst({
        where: { tenantId, accountCode: '4200', accountType: 'Income', isActive: true },
      });
      if (acc) return acc;
      return findOrCreateAccount(tenantId, '4150', 'Service Revenue', 'Income', 'Credit', tx).catch(() => null);
    })(),
    findOrCreateAccount(tenantId, '5100', 'Cost of Sales', 'Expense', 'Debit', tx).catch(async (err) => {
      console.error('❌ Error getting COGS account:', err);
      try {
        return await findOrCreateAccount(tenantId, '5100', 'Cost of Sales', 'Expense', 'Debit', tx);
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
  paymentAccount: preFetchedPaymentAccount = null, // Optional pre-fetched account (single payment)
  paymentDebitLines: preFetchedPaymentDebitLines = null, // Optional: [{ accountId, amount }] for split payments
  standardAccounts: preFetchedStandardAccounts = null, // Optional pre-fetched standard accounts
  referenceNumber: preGeneratedReferenceNumber = null, // Optional pre-generated reference number
  cogsReferenceNumber: preGeneratedCogsReferenceNumber = null, // Optional pre-generated COGS reference number
  branchId = null, // Sale branch — GL rows should match for branch-scoped dashboard/reports
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
  
  // Use pre-fetched account or payment debit lines (split payments)
  let paymentAccount = preFetchedPaymentAccount;
  const usePaymentDebitLines = preFetchedPaymentDebitLines && preFetchedPaymentDebitLines.length > 0;
  if (!usePaymentDebitLines) {
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

  // Create revenue transaction lines: debit Cash/A/R (one or multiple for split payments), credit Revenue
  const revenueLines = usePaymentDebitLines
    ? [
        ...preFetchedPaymentDebitLines.map((line, i) => ({
          lineNumber: i + 1,
          accountId: line.accountId,
          debitAmount: Number(line.amount),
          creditAmount: 0,
          description: `Payment received for sale ${saleNumber}`,
        })),
        {
          lineNumber: preFetchedPaymentDebitLines.length + 1,
          accountId: defaultRevenueAccount.id,
          debitAmount: 0,
          creditAmount: totalAmount,
          description: `Revenue from sale ${saleNumber}`,
        },
      ]
    : [
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
        ...(branchId ? { branchId } : {}),
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
        ...(branchId ? { branchId } : {}),
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
 * Create journal entry for a credit note (reduces amount customer owes).
 * Entry: Dr Revenue (or contra-revenue), Cr Accounts Receivable.
 */
export async function createCreditNoteJournalEntry({
  tenantId,
  userId,
  creditNoteId,
  noteNumber,
  noteDate,
  amount,
  reason,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, noteDate || new Date(), tx);
  const accounts = await getStandardAccounts(tenantId, tx);

  if (!accounts.accountsReceivable) {
    throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
  }

  const revenueAccount = accounts.salesRevenue || accounts.serviceRevenue;
  if (!revenueAccount) {
    throw new Error('Revenue account not found. Please set up your chart of accounts.');
  }

  const entryDate = noteDate instanceof Date ? noteDate : new Date(noteDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: revenueAccount.id,
      debitAmount: amount,
      creditAmount: 0,
      description: `Credit note ${noteNumber} - ${reason || 'Reduce revenue'}`,
    },
    {
      lineNumber: 2,
      accountId: accounts.accountsReceivable.id,
      debitAmount: 0,
      creditAmount: amount,
      description: `Credit note ${noteNumber} - Reduce AR`,
    },
  ];

  const balanceValidation = validateTransactionBalance(lines);
  if (!balanceValidation.isValid) {
    throw new Error(`Credit note transaction validation failed: ${balanceValidation.error}`);
  }

  const entry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Credit Note ${noteNumber} - ${reason || 'Amount adjustment'}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'CreditNote',
      sourceId: creditNoteId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: { create: lines },
    },
    include: { lines: true },
  });

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

/**
 * Create journal entry for a debit note (increases amount customer owes).
 * Entry: Dr Accounts Receivable, Cr Revenue.
 */
export async function createDebitNoteJournalEntry({
  tenantId,
  userId,
  debitNoteId,
  noteNumber,
  noteDate,
  amount,
  reason,
  tx = prisma,
}) {
  await assertPeriodOpen(tenantId, noteDate || new Date(), tx);
  const accounts = await getStandardAccounts(tenantId, tx);

  if (!accounts.accountsReceivable) {
    throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
  }

  const revenueAccount = accounts.salesRevenue || accounts.serviceRevenue;
  if (!revenueAccount) {
    throw new Error('Revenue account not found. Please set up your chart of accounts.');
  }

  const entryDate = noteDate instanceof Date ? noteDate : new Date(noteDate);
  const referenceNumber = await generateReferenceNumber(tx, tenantId, entryDate);

  const lines = [
    {
      lineNumber: 1,
      accountId: accounts.accountsReceivable.id,
      debitAmount: amount,
      creditAmount: 0,
      description: `Debit note ${noteNumber} - ${reason || 'Increase AR'}`,
    },
    {
      lineNumber: 2,
      accountId: revenueAccount.id,
      debitAmount: 0,
      creditAmount: amount,
      description: `Debit note ${noteNumber} - Revenue`,
    },
  ];

  const balanceValidation = validateTransactionBalance(lines);
  if (!balanceValidation.isValid) {
    throw new Error(`Debit note transaction validation failed: ${balanceValidation.error}`);
  }

  const entry = await tx.transaction.create({
    data: {
      tenantId,
      date: entryDate,
      reference: referenceNumber,
      description: `Debit Note ${noteNumber} - ${reason || 'Amount adjustment'}`,
      entryType: 'Regular',
      status: 'posted',
      sourceType: 'DebitNote',
      sourceId: debitNoteId,
      createdById: userId,
      postedById: userId,
      postedDate: new Date(),
      lines: { create: lines },
    },
    include: { lines: true },
  });

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
    creditAccount = await findAccountsPayableGlAccount(tenantId, tx);

    if (!creditAccount) {
      throw new Error('Accounts Payable account not found. Please set up your chart of accounts.');
    }

    // Get supplier name for description
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, tenantId },
      select: { supplierName: true }
    });
    
    creditDescription = `Accounts Payable - ${supplier?.supplierName || 'Supplier'}`;
    // Supplier currentBalance is derived in updateSupplierBalance (bills + gross expense AP); do not increment here.
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
    taxAmount,
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

  const taxToPost = taxAmount && taxAmount > 0 ? taxAmount : 0;
  const totalPaid = amount + taxToPost;

  // Use TaxType's linked account when taxTypeId is provided; fall back to generic outflow account
  let taxAccount = null;
  if (taxToPost > 0) {
    if (taxTypeId) {
      try {
        const taxType = await tx.taxType.findFirst({
          where: { id: taxTypeId, tenantId, status: 'Active' },
          include: { account: true },
        });
        if (taxType?.account) {
          taxAccount = taxType.account;
        }
      } catch (err) {
        console.warn('Failed to look up TaxType account for expense:', err?.message);
      }
    }
    if (!taxAccount) {
      taxAccount = await getTaxOutflowAccount(tenantId, tx);
    }
  }

  const linesToCreate = [];
  if (taxToPost > 0 && taxAccount) {
    // amount = base cost (excl. tax), taxToPost = tax portion, totalPaid = amount + tax
    linesToCreate.push(
      {
        lineNumber: 1,
        accountId: expenseAccount.id,
        debitAmount: amount,
        creditAmount: 0,
        description: `Expense: ${category}`,
      },
      {
        lineNumber: 2,
        accountId: taxAccount.id,
        debitAmount: taxToPost,
        creditAmount: 0,
        description: `Tax on expense: ${category}`,
      },
      {
        lineNumber: 3,
        accountId: creditAccount.id,
        debitAmount: 0,
        creditAmount: totalPaid,
        description: creditDescription,
      }
    );
  } else {
    linesToCreate.push(
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
      }
    );
  }

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
        create: linesToCreate,
      },
    },
    include: { lines: true },
  });

  console.log('✅ Successfully created expense transaction:', entry.id);

  // Update account balances for all lines
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
  
  let apAccount = await findAccountsPayableGlAccount(tenantId, tx);

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

  // Supplier currentBalance is refreshed via updateSupplierBalance after payments; do not decrement here.

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
