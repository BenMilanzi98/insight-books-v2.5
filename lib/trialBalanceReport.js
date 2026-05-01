import prisma from '@/lib/prisma';
import {
  fetchTenantAccountsForMergeRollup,
  buildMergeRollupContext,
  aggregateGroupByRowsBySurvivor,
} from '@/lib/accountMergeRollup';

const TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Revenue', 'Expense'];

function normalizeType(t) {
  const v = (t || '').toString().trim();
  const lower = v.toLowerCase();
  if (lower === 'assets' || lower === 'asset') return 'Asset';
  if (lower === 'liabilities' || lower === 'liability') return 'Liability';
  if (lower === 'equity') return 'Equity';
  if (lower === 'income' || lower === 'revenue') return 'Income';
  if (lower === 'expenses' || lower === 'expense') return 'Expense';
  return v || 'Other';
}

function toDateRange(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function asNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Posted journal + transaction lines for the period, rolled up to merge survivors.
 * Excludes journal entries that mirror a Transaction (`transactionId` set) to avoid double-counting.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string|null} params.branchId
 * @param {string} params.startDate YYYY-MM-DD
 * @param {string} params.endDate YYYY-MM-DD
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 * @returns {Promise<Map<string, { debitAmount: number, creditAmount: number }>>}
 */
export async function getPostedGlSurvivorTotalsForPeriod({
  tenantId,
  branchId,
  startDate,
  endDate,
  prisma: db = prisma,
}) {
  const { start, end } = toDateRange(startDate, endDate);

  const mergeRollupRows = await fetchTenantAccountsForMergeRollup(tenantId, db);
  const { survivorOf } = buildMergeRollupContext(mergeRollupRows);

  const journalWhere = {
    tenantId,
    status: 'Posted',
    entryDate: { gte: start, lte: end },
    transactionId: null,
    ...(branchId ? { branchId } : {}),
  };

  const journalEntryIds = await db.journalEntry
    .findMany({
      where: journalWhere,
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const journalGrouped = journalEntryIds.length
    ? await db.journalEntryLine.groupBy({
        by: ['accountId'],
        where: { journalEntryId: { in: journalEntryIds } },
        _sum: { debitAmount: true, creditAmount: true },
      })
    : [];

  const transactionWhere = {
    tenantId,
    status: 'posted',
    date: { gte: start, lte: end },
    ...(branchId ? { branchId } : {}),
  };

  const transactionIds = await db.transaction
    .findMany({
      where: transactionWhere,
      select: { id: true },
    })
    .then((rows) => rows.map((r) => r.id));

  const transactionGrouped = transactionIds.length
    ? await db.transactionLine.groupBy({
        by: ['accountId'],
        where: { transactionId: { in: transactionIds } },
        _sum: { debitAmount: true, creditAmount: true },
      })
    : [];

  const journalMerged = aggregateGroupByRowsBySurvivor(journalGrouped, survivorOf);
  const transactionMerged = aggregateGroupByRowsBySurvivor(transactionGrouped, survivorOf);

  const accountBalanceMap = new Map();

  for (const [accountId, v] of journalMerged) {
    accountBalanceMap.set(accountId, {
      debitAmount: v.debit,
      creditAmount: v.credit,
    });
  }
  for (const [accountId, v] of transactionMerged) {
    const existing = accountBalanceMap.get(accountId) || { debitAmount: 0, creditAmount: 0 };
    accountBalanceMap.set(accountId, {
      debitAmount: existing.debitAmount + v.debit,
      creditAmount: existing.creditAmount + v.credit,
    });
  }

  return accountBalanceMap;
}

/**
 * Builds a Trial Balance from posted journal entries/lines AND transactions/lines.
 * Includes both JournalEntry and Transaction records to capture payment processing.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string|null} params.branchId
 * @param {string} params.startDate YYYY-MM-DD
 * @param {string} params.endDate YYYY-MM-DD
 * @param {boolean} params.includeZero
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function buildTrialBalance({
  tenantId,
  branchId,
  startDate,
  endDate,
  includeZero = false,
  prisma: db = prisma,
}) {
  const accountBalanceMap = await getPostedGlSurvivorTotalsForPeriod({
    tenantId,
    branchId,
    startDate,
    endDate,
    prisma: db,
  });

  const grouped = Array.from(accountBalanceMap.entries()).map(([accountId, totals]) => ({
    accountId,
    _sum: {
      debitAmount: totals.debitAmount,
      creditAmount: totals.creditAmount,
    },
  }));

  const accountIds = grouped.map((g) => g.accountId);

  const accounts = accountIds.length
    ? await db.account.findMany({
        where: { id: { in: accountIds }, tenantId, isActive: true },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true,
          normalBalance: true,
        },
      })
    : [];

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const rowsRaw = grouped.map((g) => {
    const acc = accountMap.get(g.accountId);
    const debitTotal = asNumber(g._sum?.debitAmount);
    const creditTotal = asNumber(g._sum?.creditAmount);

    const code = acc?.accountCode ? String(acc.accountCode) : '';
    const name = acc?.accountName || 'Unknown Account';
    const type = normalizeType(acc?.accountType || acc?.type);
    const normal = (
      acc?.normalBalance || (type === 'Asset' || type === 'Expense' ? 'Debit' : 'Credit')
    ).toString();

    let debit = 0;
    let credit = 0;
    if (normal.toLowerCase() === 'debit') {
      const bal = debitTotal - creditTotal;
      if (bal >= 0) debit = bal;
      else credit = Math.abs(bal);
    } else {
      const bal = creditTotal - debitTotal;
      if (bal >= 0) credit = bal;
      else debit = Math.abs(bal);
    }

    return {
      id: g.accountId,
      code,
      name,
      type,
      normalBalance: normal,
      debitTotal,
      creditTotal,
      debit,
      credit,
    };
  });

  const rows = includeZero ? rowsRaw : rowsRaw.filter((r) => (r.debit || 0) !== 0 || (r.credit || 0) !== 0);

  rows.sort((a, b) => {
    const ta = TYPE_ORDER.indexOf(a.type);
    const tb = TYPE_ORDER.indexOf(b.type);
    if (ta !== tb) return (ta === -1 ? 999 : ta) - (tb === -1 ? 999 : tb);
    const na = parseInt(a.code, 10);
    const nb = parseInt(b.code, 10);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return String(a.code).localeCompare(String(b.code));
  });

  const totalDebits = rows.reduce((s, r) => s + asNumber(r.debit), 0);
  const totalCredits = rows.reduce((s, r) => s + asNumber(r.credit), 0);
  const difference = totalDebits - totalCredits;

  return {
    accounts: rows,
    summary: {
      startDate,
      endDate,
      branchId: branchId || null,
      totalDebits,
      totalCredits,
      difference,
      isBalanced: Math.abs(difference) < 0.01,
    },
  };
}
