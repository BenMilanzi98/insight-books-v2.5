/**
 * Durable Phase 13 sales transmission worker.
 * Consumes MRA_EIS_SALES_PAYLOAD_REQUESTED; never reposts accounting/inventory.
 */
import prisma from '@/lib/prisma.js';
import {
  claimEisOutboxBatch,
  markEisOutboxProcessed,
} from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { transmitFiscalSnapshotOnline } from './transmissionOrchestrator.js';

const SALES_PAYLOAD_EVENT =
  EIS_OUTBOX_EVENT.SALES_PAYLOAD_REQUESTED || 'MRA_EIS_SALES_PAYLOAD_REQUESTED';

export async function processSalesPayloadOutboxBatch({
  workerId = 'phase13-sales-worker',
  limit = 10,
  db = prisma,
} = {}) {
  const batch = await claimEisOutboxBatch({ workerId, limit, db });
  const results = [];

  for (const event of batch) {
    if (event.eventType !== SALES_PAYLOAD_EVENT && event.eventType !== 'MRA_EIS_SALES_PAYLOAD_REQUESTED') {
      results.push({ id: event.id, skipped: true, reason: 'NOT_SALES_PAYLOAD_EVENT' });
      continue;
    }

    const {
      tenantId,
      businessId,
      fiscalSnapshotId,
      snapshotChecksum,
      fiscalSnapshotVersion,
    } = event.payload || {};

    if (!tenantId || !fiscalSnapshotId) {
      results.push({ id: event.id, ok: false, error: 'INVALID_PAYLOAD' });
      continue;
    }

    try {
      const outcome = await transmitFiscalSnapshotOnline({
        tenantId,
        businessId: businessId || tenantId,
        fiscalSnapshotId,
        expectedSnapshotChecksum: snapshotChecksum || null,
        expectedSnapshotVersion: fiscalSnapshotVersion || null,
        actorOrServiceContext: { serviceId: workerId },
        correlationId: event.correlationId,
        requestId: event.requestId,
        workerId,
        db,
      });
      await markEisOutboxProcessed({ id: event.id, db }).catch(() => {});
      results.push({
        id: event.id,
        ok: true,
        transmissionId: outcome.transmission?.id,
        accepted: outcome.accepted,
        duplicate: outcome.duplicate,
        outcome: outcome.outcome,
      });
    } catch (err) {
      results.push({
        id: event.id,
        ok: false,
        error: err.code || 'TRANSMISSION_WORKER_ERROR',
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
    qrGenerated: false,
  };
}
