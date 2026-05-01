/**
 * GL reconciliation: trial balance engine vs raw survivor totals, and posted journal entry balance checks.
 */
import prisma from '@/lib/prisma';
import {
  buildTrialBalance,
  getPostedGlSurvivorTotalsForPeriod,
} from '@/lib/trialBalanceReport.js';

function asNumber(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function toDateRange(startDate, endDate) {
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/**
 * Compare merge-rolled raw totals to trial balance row amounts (should always match).
 *
 * @param {Map<string, { debitAmount: number, creditAmount: number }>} rawMap
 * @param {Array<{ id: string, code?: string, debitTotal: number, creditTotal: number }>} tbRows
 * @returns {Array<Record<string, unknown>>}
 */
export function comparePostedGlMapToTrialBalanceRows(rawMap, tbRows) {
  const EPS = 0.01;
  const deltas = [];
  const tbById = new Map(tbRows.map((r) => [r.id, r]));

  for (const [id, v] of rawMap) {
    const row = tbById.get(id);
    if (!row) {
      deltas.push({ accountId: id, issue: 'missing_tb_row', rawTotals: { ...v } });
      continue;
    }
    const dD = Math.abs(asNumber(row.debitTotal) - asNumber(v.debitAmount));
    const dC = Math.abs(asNumber(row.creditTotal) - asNumber(v.creditAmount));
    if (dD > EPS || dC > EPS) {
      deltas.push({
        accountId: id,
        issue: 'total_mismatch',
        rawTotals: { ...v },
        tbRow: { debitTotal: row.debitTotal, creditTotal: row.creditTotal },
      });
    }
  }

  for (const row of tbRows) {
    if (!rawMap.has(row.id)) {
      const dt = asNumber(row.debitTotal);
      const ct = asNumber(row.creditTotal);
      if (dt > EPS || ct > EPS) {
        deltas.push({
          accountId: row.id,
          issue: 'missing_raw_map',
          code: row.code,
          tbRow: { debitTotal: row.debitTotal, creditTotal: row.creditTotal },
        });
      }
    }
  }

  return deltas;
}

async function findUnbalancedPostedJournals(db, tenantId, branchId, start, end) {
  const entries = await db.journalEntry.findMany({
    where: {
      tenantId,
      status: 'Posted',
      transactionId: null,
      entryDate: { gte: start, lte: end },
      ...(branchId ? { branchId } : {}),
    },
    select: {
      id: true,
      referenceNumber: true,
      lines: {
        select: { debitAmount: true, creditAmount: true },
      },
    },
  });

  const out = [];
  for (const e of entries) {
    let deb = 0;
    let cre = 0;
    for (const ln of e.lines) {
      deb += asNumber(ln.debitAmount);
      cre += asNumber(ln.creditAmount);
    }
    if (Math.abs(deb - cre) > 0.01) {
      out.push({
        journalEntryId: e.id,
        referenceNumber: e.referenceNumber,
        sumDebit: deb,
        sumCredit: cre,
        difference: deb - cre,
      });
    }
  }
  return out;
}

/**
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string|null} params.branchId
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function runGlReconciliation({
  tenantId,
  branchId,
  startDate,
  endDate,
  prisma: db = prisma,
}) {
  const { start, end } = toDateRange(startDate, endDate);

  const [rawMap, trialBalanceReport] = await Promise.all([
    getPostedGlSurvivorTotalsForPeriod({
      tenantId,
      branchId,
      startDate,
      endDate,
      prisma: db,
    }),
    buildTrialBalance({
      tenantId,
      branchId,
      startDate,
      endDate,
      includeZero: true,
      prisma: db,
    }),
  ]);

  const perAccountDelta = comparePostedGlMapToTrialBalanceRows(rawMap, trialBalanceReport.accounts);

  const journalImbalances = await findUnbalancedPostedJournals(db, tenantId, branchId, start, end);

  const engineOk = perAccountDelta.length === 0 && journalImbalances.length === 0;
  const trialBalanced = trialBalanceReport.summary.isBalanced;

  return {
    period: { startDate, endDate, branchId: branchId || null },
    trialBalanceSummary: trialBalanceReport.summary,
    engineConsistencyOk: perAccountDelta.length === 0,
    perAccountDelta,
    journalEntryBalanceOk: journalImbalances.length === 0,
    journalImbalances,
    trialBalanced,
    allOk: engineOk && trialBalanced,
    notes: [
      'Trial balance uses posted journals (excluding transaction mirrors) plus posted transactions, merged to CoA survivors.',
      'General ledger may hide some transaction lines (e.g. parallel goods receipt rules); sums per account can differ from TB if GL filters differ.',
      'Chart of accounts may include stock/AR sub-ledgers and roll-ups; it is not expected to match TB line-by-line.',
    ],
  };
}
