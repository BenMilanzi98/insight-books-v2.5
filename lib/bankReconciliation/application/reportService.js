/**
 * Bank reconciliation statement / unmatched / outstanding exports.
 */

import { fromSignedMinor } from '../domain/signedAmount.js';
import { calculateAndPersist, getReconciliationWorkspace } from './reconciliationService.js';

export async function buildReconciliationStatement(db, context, reconciliationId) {
  const workspace = await getReconciliationWorkspace(db, context, reconciliationId);
  const { reconciliation, calculation, statements, matches, outstanding, adjustments } = workspace;

  return {
    title: 'Bank Reconciliation Statement',
    reconciliationId,
    paymentAccountId: reconciliation.paymentAccountId,
    statementDate: reconciliation.statementDate,
    status: reconciliation.status,
    currency: reconciliation.currency,
    summary: calculation.calculation.decimals,
    differenceMinor: calculation.calculation.differenceMinor,
    canComplete: calculation.calculation.canComplete,
    progress: calculation.progress,
    matchedCount: calculation.matchedCount,
    totalCount: calculation.totalCount,
    sections: {
      statementLines: statements.map((s) => ({
        id: s.id,
        date: s.transactionDate,
        description: s.description,
        reference: s.reference,
        amount: fromSignedMinor(s.signedAmountMinor),
        status: s.matchingStatus,
        remaining: fromSignedMinor(s.remainingAmountMinor),
      })),
      matches: matches.map((m) => ({
        id: m.id,
        type: m.matchType,
        confidence: m.confidence,
        status: m.status,
        statementTotal: fromSignedMinor(m.statementTotalMinor),
        bookTotal: fromSignedMinor(m.bookTotalMinor),
      })),
      outstanding: outstanding.map((o) => ({
        id: o.id,
        type: o.itemType,
        description: o.description,
        amount: String(o.amount),
        stale: o.stale,
        agingDays: o.agingDays,
      })),
      adjustments: adjustments.map((a) => ({
        id: a.id,
        type: a.adjustmentType,
        amount: fromSignedMinor(a.amountMinor),
        journalEntryId: a.journalEntryId,
        description: a.description,
      })),
    },
  };
}

export function statementToCsv(statement) {
  const lines = [
    'Section,Id,Date,Description,Reference,Amount,Status',
    ...statement.sections.statementLines.map(
      (r) =>
        `STATEMENT,${csv(r.id)},${csv(r.date)},${csv(r.description)},${csv(r.reference)},${csv(r.amount)},${csv(r.status)}`
    ),
    ...statement.sections.outstanding.map(
      (r) => `OUTSTANDING,${csv(r.id)},,${csv(r.description)},,${csv(r.amount)},${csv(r.type)}`
    ),
    ...statement.sections.adjustments.map(
      (r) => `ADJUSTMENT,${csv(r.id)},,${csv(r.description)},,${csv(r.amount)},${csv(r.type)}`
    ),
    '',
    `Summary,Statement Closing,,,${statement.summary.statementClosing},`,
    `Summary,Book Balance,,,${statement.summary.bookBalance},`,
    `Summary,Deposits in Transit,,,${statement.summary.depositsInTransit},`,
    `Summary,Outstanding Payments,,,${statement.summary.outstandingPayments},`,
    `Summary,Difference,,,${statement.summary.difference},`,
  ];
  return lines.join('\n');
}

function csv(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function refreshCalculation(db, context, reconciliationId) {
  return calculateAndPersist(db, context, reconciliationId);
}
