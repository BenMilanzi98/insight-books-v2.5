/**
 * Accounting V2 — transactional outbox.
 *
 * Outbox rows are written in the SAME database transaction as the accounting
 * operation they describe; a separate dispatcher publishes them after commit.
 * Nothing external is triggered before the commit succeeds.
 */

import { assertTransactionClient } from './transactionBoundary.js';
import { OutboxStatus } from '../domain/enums.js';

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {{aggregateType: string, aggregateId: string, eventType: string, payload: object}} message
 */
export async function enqueueOutboxMessage(tx, context, message) {
  assertTransactionClient(tx);
  return tx.acctV2Outbox.create({
    data: {
      tenantId: context.businessId,
      aggregateType: message.aggregateType,
      aggregateId: message.aggregateId,
      eventType: message.eventType,
      payload: message.payload,
      correlationId: context.correlationId,
      status: OutboxStatus.PENDING,
    },
  });
}

/**
 * Fetch a batch of pending messages for the dispatcher (post-commit, root client).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {number} [batchSize]
 */
export async function fetchPendingOutbox(prisma, batchSize = 50) {
  return prisma.acctV2Outbox.findMany({
    where: { status: OutboxStatus.PENDING },
    orderBy: { occurredAt: 'asc' },
    take: batchSize,
  });
}

/**
 * Mark a message published / failed after a dispatch attempt.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} id
 * @param {{ok: boolean, error?: string}} result
 */
export async function settleOutboxMessage(prisma, id, result) {
  return prisma.acctV2Outbox.update({
    where: { id },
    data: result.ok
      ? { status: OutboxStatus.PUBLISHED, publishedAt: new Date() }
      : {
          status: OutboxStatus.FAILED,
          attemptCount: { increment: 1 },
          lastError: (result.error ?? 'unknown').slice(0, 500),
        },
  });
}
