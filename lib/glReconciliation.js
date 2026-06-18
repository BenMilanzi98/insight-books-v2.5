/**
 * GL reconciliation: trial balance engine vs raw survivor totals, and posted journal entry balance checks.
 */
import prisma from '@/lib/prisma';
import {
  buildTrialBalance,
  getPostedGlSurvivorTotalsForPeriod,
} from '@/lib/trialBalanceReport.js';
import { generateARAgingFromTransactions } from '@/lib/arAgingService.js';
import { generateAPAgingFromTransactions } from '@/lib/apAgingService.js';
import { CODE_ACCOUNTS_RECEIVABLE, findAccountsPayableGlAccount } from '@/lib/coaPostingCodes.js';

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

const SUBLEDGER_TOLERANCE = 0.01;

/**
 * Compare AR sub-ledger (invoices) to GL control account 1200.
 */
export async function reconcileAccountsReceivable(tenantId, asOfDate, branchId = null, db = prisma) {
  const arReport = await generateARAgingFromTransactions(tenantId, asOfDate, branchId);
  const arAccount = await db.account.findFirst({
    where: { tenantId, accountCode: CODE_ACCOUNTS_RECEIVABLE, isActive: true },
    select: { id: true, accountCode: true, accountName: true },
  });

  const glBalance = arReport.verification?.arBalanceFromTransactions ?? 0;
  const subledgerTotal = arReport.verification?.totalInvoiceBalance ?? arReport.summary?.totalOutstanding ?? 0;
  const delta = Math.abs(asNumber(glBalance) - asNumber(subledgerTotal));

  return {
    controlAccountCode: CODE_ACCOUNTS_RECEIVABLE,
    controlAccountId: arAccount?.id || null,
    glBalance: asNumber(glBalance),
    subledgerTotal: asNumber(subledgerTotal),
    delta,
    isReconciled: delta <= SUBLEDGER_TOLERANCE,
    details: arReport.verification || {},
  };
}

/**
 * Compare AP sub-ledger (expenses + supplier bills) to GL control account 2110.
 */
export async function reconcileAccountsPayable(tenantId, asOfDate, branchId = null, db = prisma) {
  const apReport = await generateAPAgingFromTransactions(tenantId, asOfDate, branchId);
  const apAccount = await findAccountsPayableGlAccount(tenantId, db);

  const glBalance = Math.abs(asNumber(apReport.verification?.apBalanceFromTransactions ?? 0));
  const subledgerTotal = asNumber(
    apReport.verification?.totalExpenseBalance ?? apReport.summary?.totalOutstanding ?? 0
  );
  const delta = Math.abs(glBalance - subledgerTotal);

  return {
    controlAccountCode: apAccount?.accountCode || '2110',
    controlAccountId: apAccount?.id || null,
    glBalance,
    subledgerTotal,
    delta,
    isReconciled: delta <= SUBLEDGER_TOLERANCE,
    details: apReport.verification || {},
  };
}

/**
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string|null} params.branchId
 * @param {string} params.startDate
 * @param {string} params.endDate
 * @param {boolean} [params.includeSubledgers=false]
 * @param {import('@prisma/client').PrismaClient} [params.prisma]
 */
export async function runGlReconciliation({
  tenantId,
  branchId,
  startDate,
  endDate,
  includeSubledgers = false,
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

  let subledgerReconciliation = null;
  if (includeSubledgers) {
    const [ar, ap] = await Promise.all([
      reconcileAccountsReceivable(tenantId, endDate, branchId, db),
      reconcileAccountsPayable(tenantId, endDate, branchId, db),
    ]);
    subledgerReconciliation = { accountsReceivable: ar, accountsPayable: ap };
  }

  const subledgersOk =
    !includeSubledgers ||
    (subledgerReconciliation?.accountsReceivable?.isReconciled &&
      subledgerReconciliation?.accountsPayable?.isReconciled);

  return {
    period: { startDate, endDate, branchId: branchId || null },
    trialBalanceSummary: trialBalanceReport.summary,
    engineConsistencyOk: perAccountDelta.length === 0,
    perAccountDelta,
    journalEntryBalanceOk: journalImbalances.length === 0,
    journalImbalances,
    trialBalanced,
    subledgerReconciliation,
    subledgersOk,
    allOk: engineOk && trialBalanced && subledgersOk,
    notes: [
      'Trial balance uses posted journals (excluding transaction mirrors) plus posted transactions, merged to CoA survivors.',
      'General ledger may hide some transaction lines (e.g. parallel goods receipt rules); sums per account can differ from TB if GL filters differ.',
      'Chart of accounts may include stock/AR sub-ledgers and roll-ups; it is not expected to match TB line-by-line.',
    ],
  };
}
