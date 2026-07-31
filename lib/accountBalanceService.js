// lib/accountBalanceService.js
/**
 * Account Balance Service
 * Manages account balance calculations and updates
 */

import prisma from './prisma';

/**
 * Recalculate account balance from all posted transactions
 * @param {String} accountId - Account ID
 * @param {String} tenantId - Tenant ID
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Number>} Current balance
 */
export async function recalculateAccountBalance(accountId, tenantId, tx = prisma) {
  // Get account to determine normal balance
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      accountType: true,
      normalBalance: true,
      balance: true
    }
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const postedStatuses = ['posted', 'Posted', 'POSTED'];

  // Fresh-books: V2 JournalEntry lines only (Transaction archive unused).
  const journalLines = await tx.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        tenantId,
        status: { in: postedStatuses },
        architectureVersion: 'ACCOUNTING_V2',
      },
    },
    select: { debitAmount: true, creditAmount: true },
  });

  const totalDebits = journalLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
  const totalCredits = journalLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);

  // Determine balance calculation based on account type
  // Assets and Expenses: Debit increases, Credit decreases
  // Liabilities, Equity, Revenue: Credit increases, Debit decreases
  let balance = 0;
  
  if (account.accountType === 'Asset' || account.accountType === 'Expense') {
    balance = totalDebits - totalCredits;
  } else if (account.accountType === 'Liability' || account.accountType === 'Equity' || account.accountType === 'Revenue') {
    balance = totalCredits - totalDebits;
  } else {
    // Default: use normal balance if available
    if (account.normalBalance === 'Debit') {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }
  }

  // Update account balance
  await tx.account.update({
    where: { id: accountId },
    data: { balance }
  });

  return balance;
}

/**
 * Recalculate stored {@link Account.balance} from posted journal lines plus posted transaction lines.
 * Use after CoA remap so retired accounts zero out and survivors match GL.
 *
 * @param {String} accountId
 * @param {String} tenantId
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} [tx]
 * @returns {Promise<Number>}
 */
export async function recalculateAccountBalanceFromPostedGl(accountId, tenantId, tx = prisma) {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      accountType: true,
      normalBalance: true,
    },
  });

  if (!account) {
    throw new Error('Account not found');
  }

  const postedStatuses = ['Posted', 'posted'];
  const journalLines = await tx.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        tenantId,
        status: { in: postedStatuses },
        architectureVersion: 'ACCOUNTING_V2',
      },
    },
    select: { debitAmount: true, creditAmount: true },
  });

  let totalDebits = 0;
  let totalCredits = 0;
  for (const line of journalLines) {
    totalDebits += parseFloat(line.debitAmount || 0);
    totalCredits += parseFloat(line.creditAmount || 0);
  }

  const normalBalance =
    account.normalBalance ||
    (account.accountType === 'Asset' || account.accountType === 'Expense'
      ? 'Debit'
      : 'Credit');

  const balance =
    normalBalance === 'Debit'
      ? totalDebits - totalCredits
      : totalCredits - totalDebits;

  await tx.account.update({
    where: { id: accountId },
    data: { balance },
  });

  return balance;
}

/**
 * @deprecated Fresh-books V2: Account.balance is not financial SoT. Callers must
 * post/reverse via accountingV2 (JournalEntry) instead.
 * @throws {{code: 'LEGACY_BALANCE_MUTATION_DISABLED'}}
 */
export async function updateAccountBalanceOnTransaction(
  _accountId,
  _debitAmount,
  _creditAmount,
  _tx = prisma,
  _options = {}
) {
  const err = new Error(
    'Legacy Account.balance mutations are disabled (fresh-books V2 cutover). Use V2 journal posting/reversal.'
  );
  err.code = 'LEGACY_BALANCE_MUTATION_DISABLED';
  throw err;
}

/**
 * Recalculate all account balances for a tenant
 * @param {String} tenantId - Tenant ID
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Object>} Summary of recalculated balances
 */
export async function recalculateAllAccountBalances(tenantId, tx = prisma) {
  const accounts = await tx.account.findMany({
    where: {
      tenantId,
      isActive: true
    },
    select: {
      id: true,
      accountCode: true,
      accountName: true,
      accountType: true
    }
  });

  const results = {
    totalAccounts: accounts.length,
    recalculated: 0,
    errors: [],
    balances: []
  };

  for (const account of accounts) {
    try {
      const balance = await recalculateAccountBalance(account.id, tenantId, tx);
      results.recalculated++;
      results.balances.push({
        accountId: account.id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        balance
      });
    } catch (error) {
      results.errors.push({
        accountId: account.id,
        accountName: account.accountName,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Get account balance with details
 * @param {String} accountId - Account ID
 * @param {String} tenantId - Tenant ID
 * @param {Date} asOfDate - Optional date to calculate balance as of
 * @param {Object} tx - Optional transaction client
 * @returns {Promise<Object>} Account balance details
 */
export async function getAccountBalanceDetails(accountId, tenantId, asOfDate = null, tx = prisma, branchId = null) {
  const account = await tx.account.findUnique({
    where: { id: accountId },
    include: {
      parentAccount: {
        select: {
          id: true,
          accountCode: true,
          accountName: true
        }
      }
    }
  });

  if (!account || account.tenantId !== tenantId) {
    throw new Error('Account not found or access denied');
  }

  // Build date filter
  const dateFilter = asOfDate ? { lte: asOfDate } : {};
  
  // Build branch filter
  const branchFilter = branchId ? { branchId } : {};
  const postedStatuses = ['posted', 'Posted', 'POSTED'];

  void dateFilter;

  const journalDateFilter = asOfDate
    ? {
        OR: [
          { entryDate: { lte: asOfDate } },
          { AND: [{ entryDate: null }, { postedDate: { lte: asOfDate } }] },
        ],
      }
    : {};

  const journalLines = await tx.journalEntryLine.findMany({
    where: {
      accountId,
      journalEntry: {
        tenantId,
        status: { in: postedStatuses },
        architectureVersion: 'ACCOUNTING_V2',
        ...branchFilter,
        ...journalDateFilter,
      },
    },
    include: {
      journalEntry: {
        select: {
          id: true,
          entryDate: true,
          postedDate: true,
          description: true,
          referenceNumber: true,
          sourceType: true,
          sourceId: true,
        },
      },
    },
  });

  const transactionLines = [];

  // Calculate totals (JournalEntry ACCOUNTING_V2 only)
  const totalDebits = journalLines.reduce((sum, line) => sum + parseFloat(line.debitAmount || 0), 0);
  const totalCredits = journalLines.reduce((sum, line) => sum + parseFloat(line.creditAmount || 0), 0);

  // Calculate balance
  let balance = 0;
  if (account.accountType === 'Asset' || account.accountType === 'Expense') {
    balance = totalDebits - totalCredits;
  } else if (account.accountType === 'Liability' || account.accountType === 'Equity' || account.accountType === 'Revenue') {
    balance = totalCredits - totalDebits;
  } else {
    if (account.normalBalance === 'Debit') {
      balance = totalDebits - totalCredits;
    } else {
      balance = totalCredits - totalDebits;
    }
  }

  return {
    account: {
      id: account.id,
      accountCode: account.accountCode,
      accountName: account.accountName,
      accountType: account.accountType,
      normalBalance: account.normalBalance,
      parentAccount: account.parentAccount
    },
    balance,
    totalDebits,
    totalCredits,
    transactionCount: transactionLines.length + journalLines.length,
    asOfDate: asOfDate || new Date(),
    recentTransactions: [
      ...transactionLines.map(line => ({
        date: line.transaction.date,
        description: line.transaction.description,
        reference: line.transaction.reference,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        sourceType: line.transaction.sourceType,
        sourceId: line.transaction.sourceId
      })),
      ...journalLines.map(line => ({
        date: line.journalEntry.entryDate || line.journalEntry.postedDate,
        description: line.journalEntry.description,
        reference: line.journalEntry.referenceNumber,
        debitAmount: line.debitAmount,
        creditAmount: line.creditAmount,
        sourceType: line.journalEntry.sourceType || 'JournalEntry',
        sourceId: line.journalEntry.sourceId || line.journalEntry.id
      }))
    ]
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
      .slice(0, 10)
  };
}










