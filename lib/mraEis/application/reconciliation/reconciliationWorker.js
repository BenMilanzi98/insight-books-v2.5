/**
 * Durable Phase 15 reconciliation worker.
 * Consumes MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED.
 */

import prisma from '@/lib/prisma.js';
import {
  claimEisOutboxBatch,
  markEisOutboxProcessed,
} from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { reconcileTransmissionOutcome } from './reconciliationOrchestrator.js';

const RECON_EVENT =
  EIS_OUTBOX_EVENT.TRANSMISSION_RECONCILIATION_REQUESTED ||
  'MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED';

export async function processTransmissionReconciliationOutboxBatch({
  workerId = 'phase15-recon-worker',
  limit = 10,
  db = prisma,
} = {}) {
  const batch = await claimEisOutboxBatch({ workerId, limit, db });
  const results = [];

  for (const event of batch) {
    if (
      event.eventType !== RECON_EVENT &&
      event.eventType !== 'MRA_EIS_TRANSMISSION_RECONCILIATION_REQUESTED'
    ) {
      results.push({ id: event.id, skipped: true, reason: 'NOT_RECON_EVENT' });
      continue;
    }

    const {
      tenantId,
      businessId,
      transmissionId,
      attemptId,
      reasonCode,
    } = event.payload || {};

    if (!tenantId || !transmissionId) {
      results.push({ id: event.id, ok: false, error: 'INVALID_PAYLOAD' });
      continue;
    }

    try {
      const outcome = await reconcileTransmissionOutcome({
        tenantId,
        businessId: businessId || tenantId,
        transmissionId,
        triggeringAttemptId: attemptId || null,
        reasonCode: reasonCode || 'UNKNOWN_OUTCOME',
        correlationId: event.correlationId,
        workerId,
        actorOrServiceContext: { serviceId: workerId },
        db,
      });
      await markEisOutboxProcessed({ id: event.id, db }).catch(() => {});
      results.push({
        id: event.id,
        ok: true,
        reconciliationId: outcome.case?.id,
        matchOutcome: outcome.outcome || outcome.case?.matchOutcome,
        retryAllowed: Boolean(outcome.retryAllowed),
        duplicate: outcome.duplicate,
        mraSalesCalled: false,
        createsJournal: false,
        createsStockMovement: false,
      });
    } catch (err) {
      results.push({
        id: event.id,
        ok: false,
        error: err.code || 'RECON_WORKER_ERROR',
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
    blindRetryDisabled: true,
  };
}
