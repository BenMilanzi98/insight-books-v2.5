/**
 * Accounting V2 — journal status lifecycle (Phase 4).
 *
 * V2 journals are persisted in the shared `JournalEntry` table. Persisted status
 * strings stay legacy-compatible so existing reports (which read `status = 'Posted'`)
 * recognize engine-posted journals, while pre-posted V2 statuses are invisible to them.
 */

import { JournalStatus } from './enums.js';
import { AccountingValidationError, JournalImmutableError } from './errors.js';

/** Domain status → persisted `JournalEntry.status` string. */
export const PERSISTED_JOURNAL_STATUS = Object.freeze({
  [JournalStatus.DRAFT]: 'Draft',
  [JournalStatus.PENDING_APPROVAL]: 'PendingApproval',
  [JournalStatus.APPROVED]: 'Approved',
  [JournalStatus.POSTING]: 'Posting',
  [JournalStatus.POSTED]: 'Posted',
  [JournalStatus.REVERSED]: 'Reversed',
  [JournalStatus.PARTIALLY_REVERSED]: 'PartiallyReversed',
  [JournalStatus.FAILED]: 'Failed',
  [JournalStatus.CANCELLED]: 'Cancelled',
});

const DOMAIN_BY_PERSISTED = Object.freeze(
  Object.fromEntries(Object.entries(PERSISTED_JOURNAL_STATUS).map(([k, v]) => [v, k]))
);

/** @param {string} persisted @returns {string|null} JournalStatus value */
export function domainJournalStatus(persisted) {
  return DOMAIN_BY_PERSISTED[persisted] ?? null;
}

/** Permitted transitions (domain values). */
export const JOURNAL_STATUS_TRANSITIONS = Object.freeze({
  [JournalStatus.DRAFT]: [
    JournalStatus.PENDING_APPROVAL,
    JournalStatus.APPROVED, // approval not required
    JournalStatus.CANCELLED,
  ],
  [JournalStatus.PENDING_APPROVAL]: [
    JournalStatus.APPROVED,
    JournalStatus.DRAFT, // rejected back to draft for correction
    JournalStatus.CANCELLED,
  ],
  [JournalStatus.APPROVED]: [
    JournalStatus.POSTING,
    JournalStatus.POSTED, // single-transaction post
    JournalStatus.CANCELLED,
  ],
  [JournalStatus.POSTING]: [
    JournalStatus.POSTED,
    JournalStatus.FAILED,
  ],
  [JournalStatus.POSTED]: [
    JournalStatus.REVERSED, // only through a separate reversal event
    JournalStatus.PARTIALLY_REVERSED,
  ],
  [JournalStatus.PARTIALLY_REVERSED]: [JournalStatus.REVERSED],
  [JournalStatus.FAILED]: [
    JournalStatus.DRAFT, // correct and retry
    JournalStatus.CANCELLED,
  ],
  [JournalStatus.REVERSED]: [],
  [JournalStatus.CANCELLED]: [],
});

/** Transitions out of POSTED that are forbidden under every circumstance. */
const FORBIDDEN_FROM_POSTED = new Set([
  JournalStatus.DRAFT,
  JournalStatus.CANCELLED,
  JournalStatus.PENDING_APPROVAL,
  JournalStatus.APPROVED,
  JournalStatus.POSTING,
  JournalStatus.FAILED,
]);

/**
 * Assert a journal status transition is permitted (domain values).
 * @param {string} from
 * @param {string} to
 */
export function assertJournalStatusTransition(from, to) {
  if (from === to) return;
  if (from === JournalStatus.POSTED && FORBIDDEN_FROM_POSTED.has(to)) {
    throw new JournalImmutableError({ diagnostic: { from, to } });
  }
  const allowed = JOURNAL_STATUS_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    throw new AccountingValidationError(`Journal status cannot change from ${from} to ${to}.`, [
      { path: 'status', message: `illegal transition ${from} → ${to}` },
    ]);
  }
}

/**
 * Financially meaningful fields of a posted journal that may never be modified.
 * Corrections use reversal or adjustment events.
 */
export const IMMUTABLE_POSTED_FIELDS = Object.freeze([
  'entryDate',
  'postingDate',
  'accountingPeriodId',
  'financialYearLabel',
  'sourceType',
  'sourceId',
  'description',
  'currency',
  'exchangeRate',
  'baseCurrency',
  'totalDebit',
  'totalCredit',
  'journalNumber',
  'accountingEventId',
  'templateId',
  'templateVersion',
  'architectureVersion',
  'approvedById',
  'approvedAt',
  'tenantId',
  'branchId',
  'adjustmentCategory',
  'adjustmentReason',
  'relatedJournalId',
]);

/**
 * Guard: reject any patch that touches immutable fields of a POSTED V2 journal.
 * Safe annotations (notes) are permitted; everything financial is frozen.
 * @param {{status: string, architectureVersion?: string|null}} journalRow persisted row
 * @param {Record<string, unknown>} patch proposed update payload
 */
export function assertJournalMutationAllowed(journalRow, patch) {
  const domain = domainJournalStatus(journalRow.status) ?? journalRow.status;
  if (domain !== JournalStatus.POSTED && journalRow.status !== 'Posted') return;
  const touched = Object.keys(patch).filter((k) => IMMUTABLE_POSTED_FIELDS.includes(k));
  if (touched.length > 0) {
    throw new JournalImmutableError({ diagnostic: { touched } });
  }
  if ('status' in patch) {
    const target = DOMAIN_BY_PERSISTED[String(patch.status)] ?? String(patch.status);
    assertJournalStatusTransition(JournalStatus.POSTED, target);
  }
  if ('lines' in patch) {
    throw new JournalImmutableError({ diagnostic: { touched: ['lines'] } });
  }
}
