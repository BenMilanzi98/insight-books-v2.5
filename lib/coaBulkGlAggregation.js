/**
 * Bulk-load journal + transaction lines for chart-of-accounts with BS vs IS date semantics,
 * merge survivor rollup, mirror-journal exclusion (transactionId null). Posted transactions load in two
 * passes (non-reversal + reversal-only) so large tenants do not OOM/time out, while net GL still includes reversals.
 */
import {
  accountClass,
  resolveCoaFilterBounds,
  journalLineEffectiveDate,
  journalLineMatchesCoaFilter,
  transactionDateMatchesCoaFilter,
} from '@/lib/coaDateFilter.js';

const journalStatusNorm = (s) => (s || '').toString().trim().toLowerCase();

function partitionPostingIdsByClass(accounts, mergeRollupCtx) {
  const bsIds = new Set();
  const isIds = new Set();
  for (const a of accounts) {
    const cls = accountClass(a);
    for (const id of mergeRollupCtx.allIdsRollingInto(a.id)) {
      if (cls === 'BS') bsIds.add(id);
      else isIds.add(id);
    }
  }
  return { bsIds, isIds };
}

function journalEntryWhereChunk({ tenantId, glBranchFilter, hasDateFilter, bounds, mode }) {
  const base = {
    tenantId,
    ...glBranchFilter,
    architectureVersion: 'ACCOUNTING_V2',
  };
  if (!hasDateFilter || !bounds?.end) {
    return base;
  }
  const end = bounds.end;
  if (mode === 'BS') {
    return {
      ...base,
      OR: [
        { entryDate: { lte: end } },
        { AND: [{ entryDate: null }, { postedDate: { lte: end } }] },
      ],
    };
  }
  const start = bounds.effectiveFrom;
  if (!start) return base;
  return {
    ...base,
    OR: [
      { entryDate: { gte: start, lte: end } },
      {
        AND: [{ entryDate: null }, { postedDate: { gte: start, lte: end } }],
      },
    ],
  };
}

function transactionWhereChunk({ tenantId, glBranchFilter, hasDateFilter, bounds, mode, isReversal }) {
  const base = {
    tenantId,
    status: { in: ['posted', 'Posted'] },
    isReversal,
    ...glBranchFilter,
  };
  if (!hasDateFilter || !bounds?.end) {
    return base;
  }
  const end = bounds.end;
  if (mode === 'BS') {
    return { ...base, date: { lte: end } };
  }
  const start = bounds.effectiveFrom;
  if (!start) return { ...base, date: { lte: end } };
  return { ...base, date: { gte: start, lte: end } };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} params
 * @returns {Promise<{ journalBySurvivor: Map<string, { debit: number, credit: number, lineCount: number }>, draftBySurvivor: Map<string, number>, txnBySurvivor: Map<string, { debit: number, credit: number, lineCount: number }> }>}
 */
export async function loadCoaBulkGlAggregates(prisma, params) {
  const {
    tenantId,
    glBranchFilter,
    mergeRollupCtx,
    accounts,
    dateRange,
    fiscalYearStartMonth = 1,
  } = params;

  const { survivorOf } = mergeRollupCtx;
  const accountById = new Map(accounts.map((a) => [a.id, a]));
  const bounds = resolveCoaFilterBounds(dateRange, fiscalYearStartMonth);
  const hasDateFilter = bounds.hasFilter;

  const { bsIds, isIds } = partitionPostingIdsByClass(accounts, mergeRollupCtx);
  const unionIds = [...new Set([...bsIds, ...isIds])];

  const journalSelect = {
    id: true,
    accountId: true,
    debitAmount: true,
    creditAmount: true,
    journalEntry: {
      select: { status: true, entryDate: true, postedDate: true },
    },
  };

  /** @type {Array<Record<string, unknown>>} */
  let journalLines = [];
  if (unionIds.length) {
    if (!hasDateFilter) {
      journalLines = await prisma.journalEntryLine.findMany({
        where: {
          accountId: { in: unionIds },
          journalEntry: {
            tenantId,
            ...glBranchFilter,
            architectureVersion: 'ACCOUNTING_V2',
          },
        },
        select: journalSelect,
      });
    } else {
      const chunks = [];
      if (bsIds.size) {
        chunks.push(
          prisma.journalEntryLine.findMany({
            where: {
              accountId: { in: [...bsIds] },
              journalEntry: journalEntryWhereChunk({
                tenantId,
                glBranchFilter,
                hasDateFilter,
                bounds,
                mode: 'BS',
              }),
            },
            select: journalSelect,
          })
        );
      }
      if (isIds.size) {
        chunks.push(
          prisma.journalEntryLine.findMany({
            where: {
              accountId: { in: [...isIds] },
              journalEntry: journalEntryWhereChunk({
                tenantId,
                glBranchFilter,
                hasDateFilter,
                bounds,
                mode: 'IS',
              }),
            },
            select: journalSelect,
          })
        );
      }
      const parts = await Promise.all(chunks);
      const seen = new Set();
      for (const part of parts) {
        for (const row of part) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            journalLines.push(row);
          }
        }
      }
    }
  }

  // Fresh-books: Transaction archive unused — JournalEntry path only.
  const txnLines = [];

  const journalBySurvivor = new Map();
  const draftBySurvivor = new Map();

  for (const line of journalLines) {
    const postingId = line.accountId;
    const survId = survivorOf(postingId);
    if (!survId || !accountById.has(survId)) continue;

    const cls = accountClass(accountById.get(survId));
    const eff = journalLineEffectiveDate(line);
    const st = journalStatusNorm(line.journalEntry?.status);

    if (st === 'posted') {
      if (hasDateFilter && !journalLineMatchesCoaFilter(cls, eff, bounds)) continue;
      const cur = journalBySurvivor.get(survId) || { debit: 0, credit: 0, lineCount: 0 };
      cur.debit += parseFloat(line.debitAmount) || 0;
      cur.credit += parseFloat(line.creditAmount) || 0;
      cur.lineCount += 1;
      journalBySurvivor.set(survId, cur);
    } else if (st === 'draft') {
      if (hasDateFilter && eff && !journalLineMatchesCoaFilter(cls, eff, bounds)) continue;
      draftBySurvivor.set(survId, (draftBySurvivor.get(survId) || 0) + 1);
    }
  }

  const txnBySurvivor = new Map();
  for (const line of txnLines) {
    const tx = line.transaction;
    if (!tx) continue;
    const st = (tx.status || '').toString().trim().toLowerCase();
    if (st !== 'posted') continue;
    const survId = survivorOf(line.accountId);
    if (!survId || !accountById.has(survId)) continue;
    const cls = accountClass(accountById.get(survId));
    const txDate = tx.date ? new Date(tx.date) : null;
    if (hasDateFilter && !transactionDateMatchesCoaFilter(cls, txDate, bounds)) continue;

    const cur = txnBySurvivor.get(survId) || { debit: 0, credit: 0, lineCount: 0 };
    cur.debit += parseFloat(line.debitAmount) || 0;
    cur.credit += parseFloat(line.creditAmount) || 0;
    cur.lineCount += 1;
    txnBySurvivor.set(survId, cur);
  }

  return { journalBySurvivor, draftBySurvivor, txnBySurvivor };
}
