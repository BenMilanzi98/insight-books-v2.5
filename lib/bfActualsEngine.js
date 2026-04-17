import { dateToPeriodKey } from '@/lib/bfPeriods';
import { COA_EXPENSE_ACCOUNT_OR, isBfExpenseAccount, isBfRevenueAccount } from '@/lib/bfCoaCategories';
import { COA_INCOME_ACCOUNT_OR } from '@/lib/coaIncomeAccounts';
import {
  POSTED_TX_STATUSES,
  transactionBranchFilter,
  journalEntryBranchFilter,
  journalEntryEffectiveDate,
} from '@/lib/bfGlCore';

/**
 * Posted GL: TransactionLine + posted JournalEntryLine (manual journals).
 * Revenue-style: credit − debit. Expense-style: debit − credit.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ branchScoped?: boolean, branchId?: string|null }} branchOpts
 */
export async function fetchActualsForAccounts(
  prisma,
  {
    tenantId,
    branchScoped = false,
    branchId,
    periodType,
    periodKeys,
    rangeStart,
    rangeEnd,
    accountIds,
    accountsById,
  }
) {
  /** @type {Map<string, number>} key: `${accountId}::${periodKey}` */
  const out = new Map();

  if (!accountIds.length || !periodKeys.length) return out;

  const globalStart = new Date(rangeStart);
  const globalEnd = new Date(rangeEnd);

  const whereTx = {
    tenantId,
    status: { in: POSTED_TX_STATUSES },
    isReversal: false,
    date: { gte: globalStart, lte: globalEnd },
    ...transactionBranchFilter(branchScoped, branchId),
  };

  const lines = await prisma.transactionLine.findMany({
    where: {
      accountId: { in: accountIds },
      transaction: whereTx,
    },
    select: {
      accountId: true,
      debitAmount: true,
      creditAmount: true,
      transaction: { select: { date: true } },
    },
  });

  const periodSet = new Set(periodKeys);

  const addSigned = (accountId, dateVal, debit, credit) => {
    const acc = accountsById.get(accountId);
    if (!acc) return;
    const pk = dateToPeriodKey(dateVal, periodType);
    if (!periodSet.has(pk)) return;
    const d = Number(debit || 0);
    const c = Number(credit || 0);
    let signed = c - d;
    if (isBfExpenseAccount(acc)) {
      signed = d - c;
    }
    const mapKey = `${accountId}::${pk}`;
    out.set(mapKey, (out.get(mapKey) || 0) + signed);
  };

  for (const row of lines) {
    addSigned(row.accountId, row.transaction.date, row.debitAmount, row.creditAmount);
  }

  const jeWhere = {
    tenantId,
    status: { in: POSTED_TX_STATUSES },
    ...journalEntryBranchFilter(branchScoped, branchId),
    OR: [
      { entryDate: { gte: globalStart, lte: globalEnd } },
      {
        AND: [{ entryDate: null }, { postedDate: { gte: globalStart, lte: globalEnd } }],
      },
    ],
  };

  const jeLines = await prisma.journalEntryLine.findMany({
    where: {
      accountId: { in: accountIds },
      journalEntry: jeWhere,
    },
    select: {
      accountId: true,
      debitAmount: true,
      creditAmount: true,
      journalEntry: { select: { entryDate: true, postedDate: true } },
    },
  });

  for (const row of jeLines) {
    const dt = journalEntryEffectiveDate(row.journalEntry);
    if (!dt || dt < globalStart || dt > globalEnd) continue;
    addSigned(row.accountId, dt, row.debitAmount, row.creditAmount);
  }

  return out;
}

export function performancePercent(actual, planned) {
  const p = Number(planned);
  if (p === 0 || Number.isNaN(p)) return null;
  return (Number(actual) / p) * 100;
}

function signedForAccount(acc, debit, credit) {
  const d = Number(debit || 0);
  const c = Number(credit || 0);
  if (isBfExpenseAccount(acc)) return d - c;
  if (isBfRevenueAccount(acc)) return c - d;
  return c - d;
}

/**
 * Tenant-wide P&amp;L actuals for dashboard (posted transactions + posted journals).
 * @returns {{ revenueTotal: number, expenseTotal: number, byPeriod: Map<string, { revenue: number, expense: number }>, topRevenue: Array<{accountId, label, amount}>, topExpenses: Array<...> }}
 */
export async function aggregateBfGlPnlOverview(
  prisma,
  { tenantId, branchScoped = false, branchId, rangeStart, rangeEnd, periodType, periodKeys }
) {
  const globalStart = new Date(rangeStart);
  const globalEnd = new Date(rangeEnd);
  const whereTx = {
    tenantId,
    status: { in: POSTED_TX_STATUSES },
    isReversal: false,
    date: { gte: globalStart, lte: globalEnd },
    ...transactionBranchFilter(branchScoped, branchId),
  };

  const accountExpenseWhere = {
    tenantId,
    mergedIntoAccountId: null,
    isActive: true,
    OR: COA_EXPENSE_ACCOUNT_OR,
  };
  const accountIncomeWhere = {
    tenantId,
    mergedIntoAccountId: null,
    isActive: true,
    OR: COA_INCOME_ACCOUNT_OR,
  };

  const [expLines, revLines] = await Promise.all([
    prisma.transactionLine.findMany({
      where: {
        transaction: whereTx,
        account: accountExpenseWhere,
      },
      select: {
        accountId: true,
        debitAmount: true,
        creditAmount: true,
        transaction: { select: { date: true } },
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true, type: true } },
      },
    }),
    prisma.transactionLine.findMany({
      where: {
        transaction: whereTx,
        account: accountIncomeWhere,
      },
      select: {
        accountId: true,
        debitAmount: true,
        creditAmount: true,
        transaction: { select: { date: true } },
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true, type: true } },
      },
    }),
  ]);

  const jeBase = {
    tenantId,
    status: { in: POSTED_TX_STATUSES },
    ...journalEntryBranchFilter(branchScoped, branchId),
    AND: [
      {
        OR: [
          { entryDate: { gte: globalStart, lte: globalEnd } },
          { AND: [{ entryDate: null }, { postedDate: { gte: globalStart, lte: globalEnd } }] },
        ],
      },
    ],
  };

  const [jeExp, jeRev] = await Promise.all([
    prisma.journalEntryLine.findMany({
      where: {
        journalEntry: jeBase,
        account: accountExpenseWhere,
      },
      select: {
        accountId: true,
        debitAmount: true,
        creditAmount: true,
        journalEntry: { select: { entryDate: true, postedDate: true } },
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true, type: true } },
      },
    }),
    prisma.journalEntryLine.findMany({
      where: {
        journalEntry: jeBase,
        account: accountIncomeWhere,
      },
      select: {
        accountId: true,
        debitAmount: true,
        creditAmount: true,
        journalEntry: { select: { entryDate: true, postedDate: true } },
        account: { select: { id: true, accountCode: true, accountName: true, accountType: true, type: true } },
      },
    }),
  ]);

  const periodSet = new Set(periodKeys);
  const byPeriod = new Map();
  for (const pk of periodKeys) {
    byPeriod.set(pk, { revenue: 0, expense: 0 });
  }

  const revByAccount = new Map();
  const expByAccount = new Map();

  const bumpPeriod = (pk, kind, amt) => {
    if (!periodSet.has(pk)) return;
    const row = byPeriod.get(pk);
    if (kind === 'revenue') row.revenue += amt;
    else row.expense += amt;
  };

  const bumpAccount = (map, accountId, label, amt) => {
    const cur = map.get(accountId) || { accountId, label, amount: 0 };
    cur.amount += amt;
    map.set(accountId, cur);
  };

  const labelFor = (a) =>
    `${a.accountCode || a.code || ''} ${a.accountName || a.name || ''}`.trim() || a.id;

  for (const row of revLines) {
    const amt = signedForAccount(row.account, row.debitAmount, row.creditAmount);
    const pk = dateToPeriodKey(row.transaction.date, periodType);
    bumpPeriod(pk, 'revenue', amt);
    bumpAccount(revByAccount, row.accountId, labelFor(row.account), amt);
  }
  for (const row of jeRev) {
    const dt = journalEntryEffectiveDate(row.journalEntry);
    if (!dt || dt < globalStart || dt > globalEnd) continue;
    const amt = signedForAccount(row.account, row.debitAmount, row.creditAmount);
    const pk = dateToPeriodKey(dt, periodType);
    bumpPeriod(pk, 'revenue', amt);
    bumpAccount(revByAccount, row.accountId, labelFor(row.account), amt);
  }

  for (const row of expLines) {
    const amt = signedForAccount(row.account, row.debitAmount, row.creditAmount);
    const pk = dateToPeriodKey(row.transaction.date, periodType);
    bumpPeriod(pk, 'expense', amt);
    bumpAccount(expByAccount, row.accountId, labelFor(row.account), amt);
  }
  for (const row of jeExp) {
    const dt = journalEntryEffectiveDate(row.journalEntry);
    if (!dt || dt < globalStart || dt > globalEnd) continue;
    const amt = signedForAccount(row.account, row.debitAmount, row.creditAmount);
    const pk = dateToPeriodKey(dt, periodType);
    bumpPeriod(pk, 'expense', amt);
    bumpAccount(expByAccount, row.accountId, labelFor(row.account), amt);
  }

  let revenueTotal = 0;
  let expenseTotal = 0;
  for (const [, v] of byPeriod) {
    revenueTotal += v.revenue;
    expenseTotal += v.expense;
  }

  const topRevenue = [...revByAccount.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);
  const topExpenses = [...expByAccount.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  return {
    revenueTotal,
    expenseTotal,
    netTotal: revenueTotal - expenseTotal,
    byPeriod: [...byPeriod.entries()].map(([period, v]) => ({ period, ...v })),
    topRevenue,
    topExpenses,
  };
}
