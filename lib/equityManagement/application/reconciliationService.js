/**
 * Equity reconciliation — source txs vs journals vs ownership.
 */

import { POSTED_JOURNAL_STATUSES } from '../../accountingV2/ledger/canonicalJournalSource.js';
import { parseDecimalToMinor } from '../../accountingV2/domain/money.js';
import { percentToMinor, ONE_HUNDRED_PERCENT_MINOR } from '../domain/ownershipPercent.js';
import { listActiveHoldings } from './ownershipService.js';

export async function runEquityReconciliation(db, context, { asOfDate } = {}) {
  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  const findings = [];

  const postedTx = await db.eqV2EquityTransaction.findMany({
    where: {
      tenantId: context.businessId,
      accountingStatus: 'POSTED',
    },
  });

  for (const tx of postedTx) {
    if (!tx.journalEntryId) {
      findings.push({
        ruleCode: 'EQT-001',
        severity: 'HIGH',
        message: `Posted equity transaction ${tx.transactionNumber} has no journal.`,
        evidence: { transactionId: tx.id },
      });
      continue;
    }
    const je = await db.journalEntry.findFirst({
      where: {
        id: tx.journalEntryId,
        tenantId: context.businessId,
        architectureVersion: 'ACCOUNTING_V2',
        status: { in: [...POSTED_JOURNAL_STATUSES] },
      },
    });
    if (!je) {
      findings.push({
        ruleCode: 'EQT-001',
        severity: 'CRITICAL',
        message: `Journal missing or not posted for ${tx.transactionNumber}.`,
        evidence: { transactionId: tx.id, journalEntryId: tx.journalEntryId },
      });
    }
  }

  // Ownership % total
  const holdings = await listActiveHoldings(db, context.businessId, asOf);
  const pctTotal = holdings.reduce((s, h) => s + percentToMinor(h.ownershipPercentage), 0);
  if (pctTotal > ONE_HUNDRED_PERCENT_MINOR) {
    findings.push({
      ruleCode: 'EQT-012',
      severity: 'HIGH',
      message: 'Ownership percentage exceeds 100%.',
      evidence: { totalMinor: pctTotal },
    });
  }

  // Dividend allocation integrity
  const decls = await db.eqV2DividendDeclaration.findMany({
    where: { tenantId: context.businessId, status: 'POSTED' },
    include: { allocations: true },
  });
  for (const d of decls) {
    const sum = d.allocations.reduce((s, a) => s + a.grossAmountMinor, 0);
    if (sum !== d.totalAmountMinor) {
      findings.push({
        ruleCode: 'EQT-026',
        severity: 'HIGH',
        message: `Dividend ${d.declarationNumber} allocation mismatch.`,
        evidence: { declarationId: d.id, sum, expected: d.totalAmountMinor },
      });
    }
    for (const a of d.allocations) {
      if (a.paidAmountMinor > a.netAmountMinor) {
        findings.push({
          ruleCode: 'EQT-027',
          severity: 'CRITICAL',
          message: 'Dividend payment exceeds unpaid allocation.',
          evidence: { allocationId: a.id },
        });
      }
    }
  }

  // Detect contribution typed as revenue (heuristic — lines on revenue accounts)
  // Skipped if no chart classification — soft warning only when metadata flags present

  // Duplicate capital: same amountMinor + date + relationship posted twice
  const keyCounts = new Map();
  for (const tx of postedTx.filter((t) => t.transactionType.includes('CONTRIBUTION'))) {
    const key = `${tx.relationshipId}|${tx.amountMinor}|${String(tx.transactionDate).slice(0, 10)}`;
    keyCounts.set(key, (keyCounts.get(key) || 0) + 1);
  }
  for (const [key, n] of keyCounts) {
    if (n > 1) {
      findings.push({
        ruleCode: 'EQT-003',
        severity: 'HIGH',
        message: 'Possible duplicate capital contribution posting.',
        evidence: { key, count: n },
      });
    }
  }

  // MK1,000,000 once check — flag if more than one posted contribution of exactly 1,000,000.00
  const million = postedTx.filter((t) => t.amountMinor === 100000000 && String(t.transactionType).includes('CONTRIBUTION'));
  if (million.length > 1) {
    findings.push({
      ruleCode: 'EQT-035',
      severity: 'CRITICAL',
      message: 'MK1,000,000 capital event appears more than once.',
      evidence: { transactionIds: million.map((t) => t.id) },
    });
  }

  const overallOk = findings.filter((f) => ['HIGH', 'CRITICAL'].includes(f.severity)).length === 0;

  const run = await db.eqV2EquityReconciliationRun.create({
    data: {
      tenantId: context.businessId,
      asOfDate: asOf,
      status: 'COMPLETED',
      overallOk,
      summary: {
        postedTransactions: postedTx.length,
        holdings: holdings.length,
        findingCount: findings.length,
      },
      createdBy: context.userId || null,
      findings: {
        create: findings.map((f) => ({
          tenantId: context.businessId,
          ruleCode: f.ruleCode,
          severity: f.severity,
          message: f.message,
          evidence: f.evidence,
        })),
      },
    },
    include: { findings: true },
  });

  return run;
}

/** Subledger rows from posted equity transactions (not independent balances). */
export async function getEquitySubledger(db, tenantId, { relationshipId, limit = 200 } = {}) {
  const txs = await db.eqV2EquityTransaction.findMany({
    where: {
      tenantId,
      accountingStatus: { in: ['POSTED', 'OWNERSHIP_ONLY'] },
      ...(relationshipId ? { relationshipId } : {}),
    },
    orderBy: { transactionDate: 'asc' },
    take: limit,
  });
  let running = 0;
  return txs.map((t) => {
    const signed =
      t.transactionType.includes('DRAWING') || t.transactionType.includes('DIVIDEND_PAYMENT')
        ? -t.amountMinor
        : t.transactionType.includes('DIVIDEND_DECLARATION')
          ? 0
          : t.amountMinor;
    running += signed;
    return {
      transactionId: t.id,
      transactionNumber: t.transactionNumber,
      transactionType: t.transactionType,
      transactionDate: t.transactionDate,
      journalEntryId: t.journalEntryId,
      amountMinor: t.amountMinor,
      signedAmountMinor: signed,
      runningBalanceMinor: running,
      description: t.description,
    };
  });
}
