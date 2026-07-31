import prisma from './prisma';
import { findAccountsPayableGlAccount, findAccountsReceivableGlAccount } from './coaPostingCodes';
import { resolveOrEnsureInventoryGlAccount, isClearlyNotInventory } from './inventoryGlAccount';
import { generateReferenceNumber } from './journalService';
import { validateTransactionBalance, validateTransaction } from './accountingValidation';
import { assertAccountsAllowDirectPosting } from './coaDirectPostingEligibility.js';
import { assertPeriodOpen } from './accountingPeriodService';
import { getFixedTaxInflowAccount, getFixedTaxOutflowAccount } from './taxAccountsInitialization';
import { isCoaStructuralRootCode } from './coaPostingCodes.js';
import { resolveOperatingCashGlAccount } from './paymentAccountCoaLink.js';
import { resolveCogsPostingLeafGlAccount } from './cogsGlAccount.js';
import { roundMoney } from './money.js';

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

/** When false (default), missing GL accounts throw instead of being auto-created at posting time. */
const ALLOW_COA_AUTO_CREATE = process.env.ALLOW_COA_AUTO_CREATE === 'true';

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
      if (!ALLOW_COA_AUTO_CREATE) {
        throw new Error(
          `Account not found: ${accountCode || accountName} (${accountType}). ` +
            'Configure the account in Chart of Accounts. ' +
            'Runtime auto-create is disabled (set ALLOW_COA_AUTO_CREATE=true to override; not recommended in production).'
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
    return findOrCreateAccount(tenantId, '1131', 'National Bank of Malawi', 'Asset', 'Debit', tx).catch(() => null);
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
    (async () => {
      try {
        const resolved = await resolveOperatingCashGlAccount(tenantId, tx);
        if (resolved) return resolved;
      } catch (e) {
        console.warn('resolveOperatingCashGlAccount failed, falling back to 1110:', e?.message);
      }
      return findOrCreateAccount(tenantId, '1110', 'Cash - Main Account', 'Asset', 'Debit', tx).catch(async (err) => {
        console.error('❌ Error getting Cash account:', err);
        try {
          return await findOrCreateAccount(tenantId, '1110', 'Cash - Main Account', 'Asset', 'Debit', tx);
        } catch (retryErr) {
          console.error('❌ Retry failed for Cash account:', retryErr);
          return null;
        }
      });
    })(),
    resolveBankLikeAsset().catch(async (err) => {
      console.error('❌ Error getting Bank account:', err);
      return null;
    }),
    findAccountsReceivableGlAccount(tenantId, tx).catch(async (err) => {
      console.error('❌ Error resolving Accounts Receivable account:', err);
      try {
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
    (async () => {
      try {
        const leaf = await resolveCogsPostingLeafGlAccount(tenantId, tx);
        if (leaf) return leaf;
      } catch (e) {
        console.warn('resolveCogsPostingLeafGlAccount failed, falling back to 5100:', e?.message);
      }
      return findOrCreateAccount(tenantId, '5100', 'Cost of Sales', 'Expense', 'Debit', tx).catch(async (err) => {
        console.error('❌ Error getting COGS account:', err);
        try {
          return await findOrCreateAccount(tenantId, '5100', 'Cost of Sales', 'Expense', 'Debit', tx);
        } catch (retryErr) {
          console.error('❌ Retry failed for COGS account:', retryErr);
          return null;
        }
      });
    })(),
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

/** Payment method / PaymentAccount type → system purpose for CoA V2 resolution. */
function purposeForPaymentMethod(paymentMethod, paymentAccountType = null) {
  const type = String(paymentAccountType || '').toLowerCase();
  if (type.includes('bank')) return 'PRIMARY_BANK';
  if (type.includes('mobile') || type.includes('wallet') || type.includes('pos')) return 'MOBILE_MONEY';
  if (type.includes('cash')) return 'CASH_ON_HAND';

  const key = String(paymentMethod || '').toLowerCase().replace(/\s+/g, '_');
  if (key.includes('credit') || key.includes('receivable') || key === 'accounts_receivable') {
    return 'ACCOUNTS_RECEIVABLE';
  }
  if (key.includes('bank') || key.includes('transfer') || key.includes('paychangu')) {
    return 'PRIMARY_BANK';
  }
  if (key.includes('airtel') || key.includes('mpamba') || key.includes('mobile')) {
    return 'MOBILE_MONEY';
  }
  if (key.includes('petty')) return 'PETTY_CASH';
  return 'CASH_ON_HAND';
}

function looksLikeRecordId(value) {
  return typeof value === 'string' && value.length > 20 && /^[a-z0-9]+$/i.test(value);
}

/**
 * Resolve the GL cash/bank account for a payment method.
 *
 * Order (fail closed — no runtime auto-create):
 *  1. PaymentAccount.coaAccountId when paymentMethod is a PaymentAccount id (or linked)
 *  2. resolvePurposeAccount for the matching purpose (CASH_ON_HAND / PRIMARY_BANK / …)
 *  3. Legacy getAccountForPaymentMethod only when purpose resolution is unavailable
 *     (canonical mappings off / missing) — still never creates accounts unless
 *     ALLOW_COA_AUTO_CREATE=true via getStandardAccounts paths.
 */
export async function getPaymentAccount(tenantId, paymentMethod, tx = prisma) {
  if (!paymentMethod) {
    throw new Error('Payment method is required');
  }

  const { createAccountingContext } = await import('./accountingV2/domain/accountingContext.js');
  const { resolvePurposeAccount } = await import('./coaV2/application/accountMappingRegistry.js');
  const context = createAccountingContext({
    businessId: tenantId,
    userId: 'system-payment-resolve',
    sourceChannel: 'api',
  });

  let paymentAccountRow = null;

  if (looksLikeRecordId(paymentMethod)) {
    const accountById = await tx.account.findFirst({
      where: { id: paymentMethod, tenantId, isActive: true },
    });
    if (accountById) return accountById;

    paymentAccountRow = await tx.paymentAccount.findFirst({
      where: { id: paymentMethod, tenantId, isActive: true },
    });
    if (paymentAccountRow?.coaAccountId) {
      const linked = await tx.account.findFirst({
        where: { id: paymentAccountRow.coaAccountId, tenantId, isActive: true },
      });
      if (linked) return linked;
    }
  }

  if (!paymentAccountRow) {
    paymentAccountRow = await tx.paymentAccount.findFirst({
      where: {
        tenantId,
        isActive: true,
        OR: [
          { name: { equals: String(paymentMethod), mode: 'insensitive' } },
          { reference: { equals: String(paymentMethod), mode: 'insensitive' } },
        ],
      },
    });
    if (paymentAccountRow?.coaAccountId) {
      const linked = await tx.account.findFirst({
        where: { id: paymentAccountRow.coaAccountId, tenantId, isActive: true },
      });
      if (linked) return linked;
    }
  }

  const purpose = purposeForPaymentMethod(
    paymentMethod,
    paymentAccountRow?.accountType
  );

  try {
    return await resolvePurposeAccount(context, purpose, {}, tx);
  } catch (purposeErr) {
    // Transition: if registry/legacy purpose resolve fails, try the method map
    // without auto-create. Fail closed when that also cannot resolve.
    try {
      const { getAccountForPaymentMethod } = await import('./paymentMethodAccountMapping');
      return await getAccountForPaymentMethod(tenantId, paymentMethod, tx);
    } catch (mapErr) {
      throw new Error(
        `Payment account unresolved for "${paymentMethod}" (purpose ${purpose}). ` +
          `Link PaymentAccount.coaAccountId or assign a CoA purpose mapping. ` +
          `(purpose: ${purposeErr.message}; map: ${mapErr.message})` +
          (ALLOW_COA_AUTO_CREATE ? '' : ' Runtime auto-create is disabled.')
      );
    }
  }
}

/**
 * Get expense account by category name
 */
export async function getExpenseAccount() {
  throw new Error('Expense account mapping by category is no longer supported. Provide an expenseAccountId.');
}

export async function createSaleJournalEntries() {
  const err = new Error(
    'createSaleJournalEntries is removed (LEGACY_POSTING_REMOVED). Use V2 adapters: postPosSaleAccounting / postCostOfSalesAccounting from @/lib/accountingV2/adapters.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

export async function createInvoiceJournalEntry() {
  const err = new Error(
    'createInvoiceJournalEntry is removed (LEGACY_POSTING_REMOVED). Use V2 adapters: postInvoiceAccounting / postCostOfSalesAccounting from @/lib/accountingV2/adapters.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

export async function createInvoicePaymentJournalEntry() {
  const err = new Error(
    'createInvoicePaymentJournalEntry is removed (LEGACY_POSTING_REMOVED). Use V2 adapters: postCustomerPaymentAccounting from @/lib/accountingV2/adapters.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

/**
 * Create journal entry for a credit note (reduces amount customer owes).
 * Fresh-books V2: posts via postCreditNoteAccounting only.
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
  const { postCreditNoteAccounting } = await import(
    './accountingV2/adapters/creditNoteAdapter.js'
  );
  const outcome = await postCreditNoteAccounting({
    db: tx,
    tenantId,
    userId,
    creditNoteId,
  });
  if (outcome?.result) {
    return {
      id: outcome.result.journalEntryId,
      journalEntryId: outcome.result.journalEntryId,
      lines: outcome.result.lines ?? [],
      noteNumber,
      noteDate,
      amount,
      reason,
    };
  }
  const err = new Error(
    'createCreditNoteJournalEntry legacy path removed (LEGACY_POSTING_REMOVED). Use postCreditNoteAccounting.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

/**
 * Create journal entry for a debit note (increases amount customer owes).
 * Fresh-books V2: legacy Transaction writer removed — no V2 debit-note adapter yet.
 */
export async function createDebitNoteJournalEntry() {
  const err = new Error(
    'createDebitNoteJournalEntry is removed (LEGACY_POSTING_REMOVED). Debit notes must post via a V2 adapter.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

export async function createExpenseJournalEntry() {
  const err = new Error(
    'createExpenseJournalEntry is removed (LEGACY_POSTING_REMOVED). Use V2 adapters: postExpenseAccounting from @/lib/accountingV2/adapters.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}

export async function createExpensePaymentJournalEntry() {
  const err = new Error(
    'createExpensePaymentJournalEntry is removed (LEGACY_POSTING_REMOVED). Use V2 adapters: postTaxSettlementAccounting (ExpensePayment) or supplier payment adapters from @/lib/accountingV2/adapters.'
  );
  err.code = 'LEGACY_POSTING_REMOVED';
  throw err;
}


