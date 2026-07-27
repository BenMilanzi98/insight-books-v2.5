/**
 * Durable fiscal snapshot worker — Phase 12.
 * Claims READY_FOR_FISCAL_SNAPSHOT bridges; never calls MRA; never reposts accounting/inventory.
 */
import prisma from '@/lib/prisma.js';
import { BRIDGE_STATUS } from '../eligibility/salesBridgeService.js';
import { createFiscalSnapshotFromBridge } from './snapshotOrchestrator.js';
import { FISCAL_SNAPSHOT_REQUESTED_EVENT } from '../eligibility/salesBridgeService.js';
import {
  claimEisOutboxBatch,
  markEisOutboxProcessed,
} from '../../infrastructure/outbox/outboxService.js';

/**
 * Process Phase 11 FISCAL_SNAPSHOT_REQUESTED outbox events into Phase 12 snapshots.
 */
export async function processFiscalSnapshotOutboxBatch({
  workerId = 'phase12-snapshot-worker',
  limit = 10,
  db = prisma,
} = {}) {
  const batch = await claimEisOutboxBatch({ workerId, limit, db });
  const results = [];

  for (const event of batch) {
    if (
      event.eventType !== FISCAL_SNAPSHOT_REQUESTED_EVENT &&
      event.eventType !== 'MRA_EIS_SNAPSHOT_REQUESTED' &&
      event.eventType !== 'MRA_EIS_FISCAL_SNAPSHOT_REQUESTED'
    ) {
      results.push({ id: event.id, skipped: true, reason: 'NOT_SNAPSHOT_EVENT' });
      continue;
    }

    const { tenantId, businessId, bridgeRecordId } = event.payload || {};
    if (!tenantId || !bridgeRecordId) {
      results.push({ id: event.id, ok: false, error: 'INVALID_PAYLOAD' });
      continue;
    }

    try {
      // Ensure bridge is READY (Phase 11 consumer may already have done this)
      const bridge = await db.mraEisSalesBridge.findFirst({
        where: { id: bridgeRecordId, tenantId, businessId: businessId || tenantId },
      });
      if (!bridge) {
        results.push({ id: event.id, ok: false, error: 'BRIDGE_NOT_FOUND' });
        continue;
      }

      if (
        bridge.status !== BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT &&
        bridge.status !== BRIDGE_STATUS.OUTBOX_PENDING &&
        bridge.status !== BRIDGE_STATUS.FISCAL_SNAPSHOT_CREATED
      ) {
        results.push({ id: event.id, ok: false, error: 'BRIDGE_NOT_READY', status: bridge.status });
        continue;
      }

      if (bridge.status === BRIDGE_STATUS.FISCAL_SNAPSHOT_CREATED) {
        await markEisOutboxProcessed({ id: event.id, db }).catch(() => {});
        results.push({ id: event.id, ok: true, deduplicated: true });
        continue;
      }

      // Promote OUTBOX_PENDING → READY if needed
      if (bridge.status === BRIDGE_STATUS.OUTBOX_PENDING) {
        await db.mraEisSalesBridge.updateMany({
          where: {
            id: bridge.id,
            status: BRIDGE_STATUS.OUTBOX_PENDING,
            version: bridge.version,
          },
          data: {
            status: BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT,
            version: { increment: 1 },
          },
        });
      }

      const created = await createFiscalSnapshotFromBridge({
        tenantId,
        businessId: businessId || tenantId,
        bridgeRecordId,
        actorOrServiceContext: { serviceId: workerId },
        correlationId: event.correlationId,
        requestId: event.requestId,
        db,
      });

      await markEisOutboxProcessed({ id: event.id, db }).catch(() => {});
      results.push({
        id: event.id,
        ok: true,
        snapshotId: created.snapshot?.id,
        numberPending: created.numberPending,
        duplicate: created.duplicate,
      });
    } catch (err) {
      results.push({
        id: event.id,
        ok: false,
        error: err.code || 'SNAPSHOT_WORKER_ERROR',
        message: err.message,
        retryable: Boolean(err.retryable),
      });
    }
  }

  return { workerId, processed: results.length, results, callsMraApi: false };
}

/**
 * Scan bridges READY_FOR_FISCAL_SNAPSHOT without relying solely on outbox.
 */
export async function claimReadyBridgesForSnapshot({
  tenantId = null,
  limit = 20,
  db = prisma,
} = {}) {
  const where = {
    status: BRIDGE_STATUS.READY_FOR_FISCAL_SNAPSHOT,
    futureFiscalSnapshotId: null,
  };
  if (tenantId) {
    where.tenantId = tenantId;
    where.businessId = tenantId;
  }

  const bridges = await db.mraEisSalesBridge.findMany({
    where,
    take: limit,
    orderBy: { lastEvaluatedAt: 'asc' },
  });

  const results = [];
  for (const bridge of bridges) {
    try {
      const created = await createFiscalSnapshotFromBridge({
        tenantId: bridge.tenantId,
        businessId: bridge.businessId,
        bridgeRecordId: bridge.id,
        expectedBridgeVersion: bridge.version,
        actorOrServiceContext: { serviceId: 'phase12-bridge-claimer' },
        db,
      });
      results.push({ bridgeId: bridge.id, ok: true, snapshotId: created.snapshot?.id });
    } catch (err) {
      results.push({
        bridgeId: bridge.id,
        ok: false,
        error: err.code || 'ERROR',
        message: err.message,
      });
    }
  }
  return { results, callsMraApi: false };
}
