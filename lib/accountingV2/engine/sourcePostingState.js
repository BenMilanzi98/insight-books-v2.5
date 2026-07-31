/**
 * Posting engine — standardized source posting state (Phase 4).
 *
 * Decision (documented in SOURCE_POSTING_STATUS.md): instead of adding
 * accounting-status columns to every operational table, the central
 * `AcctV2EventRegistry` is the source-accounting link table. This module maps
 * registry facts to the standard source posting states and answers
 * "what is the accounting state of this source?" for any module.
 */

import { EventRegistryStatus } from '../domain/enums.js';

export const SourcePostingState = Object.freeze({
  NOT_READY: 'NOT_READY',
  READY_TO_POST: 'READY_TO_POST',
  POSTING: 'POSTING',
  POSTED: 'POSTED',
  POSTING_FAILED: 'POSTING_FAILED',
  REVERSED: 'REVERSED',
  CANCELLED_BEFORE_POSTING: 'CANCELLED_BEFORE_POSTING',
});

/** Registry status → source posting state. */
const STATE_BY_REGISTRY_STATUS = Object.freeze({
  [EventRegistryStatus.RECEIVED]: SourcePostingState.READY_TO_POST,
  [EventRegistryStatus.IN_PROGRESS]: SourcePostingState.POSTING,
  [EventRegistryStatus.POSTED]: SourcePostingState.POSTED,
  [EventRegistryStatus.SHADOWED]: SourcePostingState.NOT_READY, // shadow ≠ production posting
  [EventRegistryStatus.FAILED]: SourcePostingState.POSTING_FAILED,
  [EventRegistryStatus.REJECTED]: SourcePostingState.CANCELLED_BEFORE_POSTING,
  [EventRegistryStatus.SUPERSEDED]: SourcePostingState.NOT_READY,
});

/**
 * Resolve the accounting posting state of a source entity.
 *
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {{sourceType: string, sourceId: string, eventType?: string}} ref
 * @returns {Promise<{state: string, accountingEventId: string|null, postedJournalId: string|null,
 *   postedAt: Date|null, postedBy: string|null, failureCode: string|null,
 *   failureMessage: string|null, attemptCount: number, architectureVersion: string|null}>}
 */
export async function getSourcePostingState(db, context, ref) {
  const events = await db.acctV2EventRegistry.findMany({
    where: {
      tenantId: context.businessId,
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
      ...(ref.eventType ? { eventType: ref.eventType } : {}),
    },
    orderBy: { createdAt: 'desc' },
  });

  if (events.length === 0) {
    return {
      state: SourcePostingState.NOT_READY,
      accountingEventId: null,
      postedJournalId: null,
      postedAt: null,
      postedBy: null,
      failureCode: null,
      failureMessage: null,
      attemptCount: 0,
      architectureVersion: null,
    };
  }

  // A reversal event that POSTED marks the source REVERSED.
  const reversal = events.find(
    (e) => e.eventType === 'REVERSAL_POSTED' && e.status === EventRegistryStatus.POSTED
  );
  const primary =
    events.find((e) => e.status === EventRegistryStatus.POSTED && e.eventType !== 'REVERSAL_POSTED') ??
    events[0];

  const attemptCount = await db.acctV2PostingAttempt.count({
    where: { eventRegistryId: primary.id },
  });

  return {
    state: reversal
      ? SourcePostingState.REVERSED
      : STATE_BY_REGISTRY_STATUS[primary.status] ?? SourcePostingState.NOT_READY,
    accountingEventId: primary.id,
    postedJournalId: primary.journalEntryId ?? primary.legacyTransactionId ?? null,
    postedAt: primary.postedAt ?? null,
    postedBy: primary.createdBy ?? null,
    failureCode: primary.failureCode ?? null,
    failureMessage: primary.failureMessage ?? null,
    attemptCount,
    architectureVersion: primary.architectureVersion ?? null,
  };
}
