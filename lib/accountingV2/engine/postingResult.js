/**
 * Posting engine — standardized Posting Result (Phase 4).
 *
 * Every engine entry point returns this shape. Idempotent retries return the
 * original successful result with `wasExistingPosting: true`. The result contains
 * only client-safe fields — never SQL, stack traces, or foreign-tenant data.
 */

import { minorToDecimalString } from '../domain/money.js';
import { ArchitectureVersion } from '../domain/enums.js';

/**
 * @typedef {object} PostingResult
 * @property {string} accountingEventId
 * @property {string} businessId
 * @property {{sourceModule:string, sourceType:string, sourceId:string, sourceNumber:string|null}} sourceReference
 * @property {string} eventType
 * @property {string} architectureVersion
 * @property {string} postingMode
 * @property {string} postingStatus EventRegistryStatus value
 * @property {string|null} journalEntryId
 * @property {string|null} journalNumber
 * @property {string|null} shadowJournalId
 * @property {string|null} financialYearId
 * @property {string|null} accountingPeriodId
 * @property {string|null} postingDate
 * @property {string|null} transactionDate
 * @property {string} currency
 * @property {string|null} totalDebit decimal string
 * @property {string|null} totalCredit decimal string
 * @property {string|null} baseTotalDebit
 * @property {string|null} baseTotalCredit
 * @property {boolean} wasExistingPosting
 * @property {boolean} wasShadowPosting
 * @property {string|null} comparisonStatus
 * @property {string[]} warnings
 * @property {string} requestId
 * @property {string} correlationId
 * @property {string|null} postedAt ISO timestamp
 * @property {string|null} postedBy
 */

/**
 * @param {object} params
 * @returns {PostingResult}
 */
export function buildPostingResult(params) {
  const {
    event,
    context,
    sourceReference,
    postingMode,
    journal = null,
    shadowJournalId = null,
    comparisonStatus = null,
    draft = null,
    wasExistingPosting = false,
    warnings = [],
  } = params;

  return Object.freeze({
    accountingEventId: event.id,
    businessId: context.businessId,
    sourceReference: {
      sourceModule: sourceReference.sourceModule,
      sourceType: sourceReference.sourceType,
      sourceId: sourceReference.sourceId,
      sourceNumber: sourceReference.sourceNumber ?? null,
    },
    eventType: sourceReference.eventType,
    architectureVersion: journal?.architectureVersion ?? event.architectureVersion ?? ArchitectureVersion.TRANSITION_V2,
    postingMode,
    postingStatus: params.postingStatus ?? event.status,
    journalEntryId: journal?.id ?? event.journalEntryId ?? null,
    journalNumber: journal?.journalNumber ?? null,
    shadowJournalId,
    financialYearId: params.financialYearId ?? null,
    accountingPeriodId: journal?.accountingPeriodId ?? params.accountingPeriodId ?? null,
    postingDate: journal?.postingDate
      ? new Date(journal.postingDate).toISOString().slice(0, 10)
      : draft?.postingDate ?? null,
    transactionDate: draft?.transactionDate
      ?? (event.transactionDate ? new Date(event.transactionDate).toISOString().slice(0, 10) : null),
    currency: draft?.currency ?? event.currency ?? context.currency,
    totalDebit: draft ? minorToDecimalString(draft.totals.debitMinor)
      : journal?.totalDebit != null ? String(journal.totalDebit) : null,
    totalCredit: draft ? minorToDecimalString(draft.totals.creditMinor)
      : journal?.totalCredit != null ? String(journal.totalCredit) : null,
    baseTotalDebit: params.baseTotalDebit ?? null,
    baseTotalCredit: params.baseTotalCredit ?? null,
    wasExistingPosting,
    wasShadowPosting: shadowJournalId != null,
    comparisonStatus,
    warnings: Object.freeze([...warnings]),
    requestId: context.requestId,
    correlationId: context.correlationId,
    postedAt: journal?.postedDate ? new Date(journal.postedDate).toISOString()
      : event.postedAt ? new Date(event.postedAt).toISOString() : null,
    postedBy: journal?.postedById ?? null,
  });
}
