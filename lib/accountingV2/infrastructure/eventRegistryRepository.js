/**
 * Accounting V2 — event registry repository.
 *
 * The registry is the database-enforced accounting identity. All methods are
 * business-scoped and require an explicit transaction client for writes.
 */

import { assertTransactionClient } from './transactionBoundary.js';
import { assertSameBusiness } from '../domain/accountingContext.js';
import { EventRegistryStatus, ArchitectureVersion } from '../domain/enums.js';
import {
  DuplicateAccountingEventError,
  ConflictingIdempotencyKeyError,
  AccountingConcurrencyError,
} from '../domain/errors.js';

/** Statuses that represent a live (non-replayable) registration. */
const ACTIVE_STATUSES = [
  EventRegistryStatus.RECEIVED,
  EventRegistryStatus.IN_PROGRESS,
  EventRegistryStatus.POSTED,
  EventRegistryStatus.SHADOWED,
];

/**
 * Find an event by idempotency key, business-scoped.
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} idempotencyKey
 */
export async function findByIdempotencyKey(db, context, idempotencyKey) {
  const row = await db.acctV2EventRegistry.findUnique({ where: { idempotencyKey } });
  if (!row) return null;
  assertSameBusiness(context, row, 'accounting event');
  return row;
}

/**
 * Find events for a source entity, business-scoped.
 * @param {import('@prisma/client').PrismaClient|import('@prisma/client').Prisma.TransactionClient} db
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {{sourceType: string, sourceId: string}} ref
 */
export async function findBySource(db, context, ref) {
  return db.acctV2EventRegistry.findMany({
    where: {
      tenantId: context.businessId,
      sourceType: ref.sourceType,
      sourceId: ref.sourceId,
    },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Register a new accounting event inside a transaction. The unique constraints on
 * `idempotencyKey` and the identity tuple are the hard duplicate guard: a concurrent
 * duplicate insert fails at the database regardless of application races.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {object} params
 * @param {import('../domain/sourceReference.js').SourceReference} params.sourceReference
 * @param {string} params.idempotencyKey
 * @param {string|null} params.commandHash
 * @param {Date|string} params.transactionDate
 * @param {Date|string|null} [params.requestedPostingDate]
 * @param {string} params.currency
 * @param {string|null} [params.amountDecimal] decimal string for the headline amount
 * @param {string} params.postingMode
 * @returns {Promise<{row: object, replayed: boolean}>}
 */
export async function registerEvent(tx, context, params) {
  assertTransactionClient(tx);
  const { sourceReference: ref, idempotencyKey } = params;

  const existing = await tx.acctV2EventRegistry.findUnique({ where: { idempotencyKey } });
  if (existing) {
    assertSameBusiness(context, existing, 'accounting event');
    if (params.commandHash && existing.commandHash && existing.commandHash !== params.commandHash) {
      throw new ConflictingIdempotencyKeyError(idempotencyKey, {
        requestId: context.requestId,
        correlationId: context.correlationId,
        diagnostic: { existingEventId: existing.id },
      });
    }
    if (ACTIVE_STATUSES.includes(existing.status)) {
      // Safe replay: same identity, same content — return existing registration.
      return { row: existing, replayed: true };
    }
    // Previous attempt failed/was rejected: re-open the same registration for retry.
    const reopened = await tx.acctV2EventRegistry.update({
      where: { id: existing.id },
      data: {
        status: EventRegistryStatus.RECEIVED,
        failureCode: null,
        failureMessage: null,
        postingMode: params.postingMode,
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
    });
    return { row: reopened, replayed: false };
  }

  try {
    const row = await tx.acctV2EventRegistry.create({
      data: {
        tenantId: context.businessId,
        sourceModule: ref.sourceModule,
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
        eventType: ref.eventType,
        eventVersion: ref.eventVersion,
        idempotencyKey,
        commandHash: params.commandHash ?? null,
        transactionDate: new Date(params.transactionDate),
        requestedPostingDate: params.requestedPostingDate
          ? new Date(params.requestedPostingDate)
          : null,
        currency: params.currency,
        amount: params.amountDecimal ?? null,
        status: EventRegistryStatus.RECEIVED,
        postingMode: params.postingMode,
        architectureVersion: ArchitectureVersion.TRANSITION_V2,
        correlationId: context.correlationId,
        requestId: context.requestId,
        externalReference: ref.externalReference,
        importBatchId: ref.importBatchId,
        webhookEventId: ref.webhookEventId,
        createdBy: context.userId,
        metadata: ref.metadata && Object.keys(ref.metadata).length > 0 ? ref.metadata : undefined,
      },
    });
    return { row, replayed: false };
  } catch (err) {
    if (err && typeof err === 'object' && err.code === 'P2002') {
      // Unique violation — a concurrent request registered the same identity first.
      const winner = await tx.acctV2EventRegistry.findUnique({ where: { idempotencyKey } });
      if (winner) {
        throw new DuplicateAccountingEventError(idempotencyKey, winner.id, {
          requestId: context.requestId,
          correlationId: context.correlationId,
        });
      }
      throw new AccountingConcurrencyError({
        requestId: context.requestId,
        correlationId: context.correlationId,
      });
    }
    throw err;
  }
}

/**
 * Transition a registry row's status with an audit-friendly patch.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {string} eventId
 * @param {object} patch
 */
export async function updateEventStatus(tx, context, eventId, patch) {
  assertTransactionClient(tx);
  const row = await tx.acctV2EventRegistry.findUnique({ where: { id: eventId } });
  if (!row) return null;
  assertSameBusiness(context, row, 'accounting event');
  return tx.acctV2EventRegistry.update({
    where: { id: eventId },
    data: {
      status: patch.status,
      journalEntryId: patch.journalEntryId ?? row.journalEntryId,
      legacyTransactionId: patch.legacyTransactionId ?? row.legacyTransactionId,
      failureCode: patch.failureCode ?? null,
      failureMessage: patch.failureMessage ?? null,
      postedAt: patch.status === EventRegistryStatus.POSTED ? new Date() : row.postedAt,
    },
  });
}

/**
 * Record a posting attempt row (same transaction as the work it describes).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {object} params
 */
export async function recordPostingAttempt(tx, params) {
  assertTransactionClient(tx);
  const last = await tx.acctV2PostingAttempt.findFirst({
    where: { eventRegistryId: params.eventRegistryId },
    orderBy: { attemptNumber: 'desc' },
    select: { attemptNumber: true },
  });
  return tx.acctV2PostingAttempt.create({
    data: {
      eventRegistryId: params.eventRegistryId,
      attemptNumber: (last?.attemptNumber ?? 0) + 1,
      status: params.status,
      workerId: params.workerId ?? null,
      requestId: params.requestId ?? null,
      correlationId: params.correlationId ?? null,
      transactionId: params.transactionId ?? null,
      failureCode: params.failureCode ?? null,
      sanitizedFailureMessage: params.sanitizedFailureMessage ?? null,
      retryable: params.retryable ?? false,
      durationMs: params.durationMs ?? null,
      completedAt: params.completed ? new Date() : null,
    },
  });
}
