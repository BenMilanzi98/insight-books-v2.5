/**
 * Durable Phase 14 fiscal receipt worker.
 * Consumes MRA_EIS_ACCEPTED_RECEIPT_REQUESTED. Never calls MRA Sales.
 */

import prisma from '@/lib/prisma.js';
import {
  claimEisOutboxBatch,
  markEisOutboxProcessed,
} from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { generateFiscalReceiptFromAcceptedTransmission } from './fiscalReceiptOrchestrator.js';

const ACCEPTED_RECEIPT_EVENT =
  EIS_OUTBOX_EVENT.ACCEPTED_RECEIPT_REQUESTED || 'MRA_EIS_ACCEPTED_RECEIPT_REQUESTED';

export async function processAcceptedReceiptOutboxBatch({
  workerId = 'phase14-receipt-worker',
  limit = 10,
  db = prisma,
} = {}) {
  const batch = await claimEisOutboxBatch({ workerId, limit, db });
  const results = [];

  for (const event of batch) {
    if (
      event.eventType !== ACCEPTED_RECEIPT_EVENT &&
      event.eventType !== 'MRA_EIS_ACCEPTED_RECEIPT_REQUESTED'
    ) {
      results.push({ id: event.id, skipped: true, reason: 'NOT_ACCEPTED_RECEIPT_EVENT' });
      continue;
    }

    const {
      tenantId,
      businessId,
      transmissionId,
      acceptedAttemptId,
      responseEvidenceId,
      responseChecksum,
      fiscalSnapshotId,
    } = event.payload || {};

    if (!tenantId || !transmissionId) {
      results.push({ id: event.id, ok: false, error: 'INVALID_PAYLOAD' });
      continue;
    }

    try {
      const outcome = await generateFiscalReceiptFromAcceptedTransmission({
        tenantId,
        businessId: businessId || tenantId,
        transmissionId,
        acceptedAttemptId: acceptedAttemptId || null,
        responseEvidenceId: responseEvidenceId || null,
        expectedResponseChecksum: responseChecksum || null,
        correlationId: event.correlationId,
        actorOrServiceContext: { serviceId: workerId },
        workerId,
        db,
      });
      await markEisOutboxProcessed({ id: event.id, db }).catch(() => {});
      results.push({
        id: event.id,
        ok: true,
        fiscalReceiptId: outcome.receipt?.id,
        state: outcome.receipt?.state,
        duplicate: outcome.duplicate,
        fiscalSnapshotId,
        mraSalesCalled: false,
        createsJournal: false,
        createsStockMovement: false,
      });
    } catch (err) {
      results.push({
        id: event.id,
        ok: false,
        error: err.code || 'RECEIPT_WORKER_ERROR',
        message: err.message,
        retryable: Boolean(err.retryable),
      });
    }
  }

  return {
    workerId,
    processed: results.length,
    results,
    createsJournal: false,
    createsStockMovement: false,
    mraSalesCalled: false,
  };
}
