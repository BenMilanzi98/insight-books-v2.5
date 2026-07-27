/**
 * Phase 15 — missing Event / Receipt recovery (never resubmits Sales).
 */

import prisma from '@/lib/prisma.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT, TRANSMISSION_STATUS } from '../../domain/operationalEnums.js';
import { processAcceptedReceiptOutboxBatch } from '../fiscalReceipt/fiscalReceiptWorker.js';

/**
 * Idempotently recreate missing Phase 14 accepted-receipt outbox event.
 */
export async function recoverMissingPhase14Event({
  tenantId,
  businessId,
  transmissionId,
  attemptId,
  snapshot,
  mraEvidence,
  responseChecksum,
  correlationId = null,
  db = prisma,
} = {}) {
  if (!snapshot?.id) {
    return { created: false, reason: 'SNAPSHOT_MISSING' };
  }

  const idempotencyKey = `accepted-receipt:${transmissionId}:${attemptId}`;
  const existing = await db.mraEisOutbox
    .findFirst({
      where: { tenantId, businessId, idempotencyKey },
    })
    .catch(() => null);

  if (existing) {
    return { created: false, reused: true, eventId: existing.id, saleResubmitted: false };
  }

  // Prefer existing response evidence id if present
  const transmission = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });

  const payload = {
    eventVersion: '1',
    tenantId,
    businessId,
    transmissionId,
    acceptedAttemptId: attemptId,
    fiscalSnapshotId: snapshot.id,
    fiscalSnapshotVersion: String(snapshot.version || 1),
    snapshotChecksum: snapshot.snapshotChecksum,
    fiscalNumberAssignmentId: snapshot.fiscalNumberAllocationId,
    responseEvidenceId: transmission?.latestResponseId || null,
    responseChecksum: responseChecksum || null,
    mraTransactionId: mraEvidence?.mraTransactionId || null,
    environment: transmission?.environment || snapshot.environment,
    correlationId,
    occurredAt: new Date().toISOString(),
    recoveredByPhase15: true,
  };

  const event = await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisTransmission',
    aggregateId: transmissionId,
    eventType: EIS_OUTBOX_EVENT.ACCEPTED_RECEIPT_REQUESTED || 'MRA_EIS_ACCEPTED_RECEIPT_REQUESTED',
    eventVersion: '1',
    payload,
    idempotencyKey,
    correlationId,
    db,
  });

  return { created: true, eventId: event?.id, saleResubmitted: false };
}

/**
 * Trigger receipt worker for accepted transmissions missing completed receipts.
 */
export async function recoverMissingFiscalReceipt({
  tenantId,
  businessId,
  transmissionId = null,
  db = prisma,
  runWorker = true,
} = {}) {
  const where = {
    tenantId,
    businessId,
    status: {
      in: [TRANSMISSION_STATUS.ACCEPTED_ONLINE, TRANSMISSION_STATUS.RECONCILED_ACCEPTED],
    },
  };
  if (transmissionId) where.id = transmissionId;

  const accepted = await db.mraEisTransmission.findMany({
    where,
    take: 25,
    orderBy: { acceptedAt: 'asc' },
  });

  const results = [];
  for (const tx of accepted) {
    const receipt = await db.mraEisFiscalReceipt
      .findFirst({
        where: {
          transmissionId: tx.id,
          tenantId,
          businessId,
          state: { in: ['COMPLETED', 'COMPLETED_WITH_WARNINGS'] },
        },
      })
      .catch(() => null);

    if (receipt) {
      results.push({ transmissionId: tx.id, needed: false });
      continue;
    }

    const attemptId = tx.currentAttemptId;
    const snapshot = await db.mraEisSnapshot.findFirst({
      where: { id: tx.snapshotId, tenantId, businessId },
    });
    const recovery = await recoverMissingPhase14Event({
      tenantId,
      businessId,
      transmissionId: tx.id,
      attemptId,
      snapshot,
      mraEvidence: { mraTransactionId: null },
      responseChecksum: null,
      db,
    });
    results.push({ transmissionId: tx.id, needed: true, ...recovery });
  }

  let workerResult = null;
  if (runWorker) {
    workerResult = await processAcceptedReceiptOutboxBatch({
      workerId: 'phase15-receipt-recovery',
      limit: 10,
      db,
    });
  }

  return {
    scanned: accepted.length,
    results,
    workerResult,
    saleResubmitted: false,
    createsJournal: false,
    createsStockMovement: false,
  };
}

/**
 * Recover missing Phase 15 reconciliation outbox for UNKNOWN_OUTCOME transmissions.
 */
export async function recoverMissingReconciliationEvents({
  tenantId,
  businessId,
  db = prisma,
  limit = 20,
} = {}) {
  const unknowns = await db.mraEisTransmission.findMany({
    where: {
      tenantId,
      businessId,
      status: TRANSMISSION_STATUS.UNKNOWN_OUTCOME,
    },
    take: limit,
    orderBy: { unknownOutcomeAt: 'asc' },
  });

  const created = [];
  for (const tx of unknowns) {
    const key = `tx-recon:${tx.id}:${tx.currentAttemptId || 'na'}`;
    const existing = await db.mraEisOutbox.findFirst({ where: { idempotencyKey: key } }).catch(() => null);
    if (existing) continue;

    const snapshot = await db.mraEisSnapshot.findFirst({
      where: { id: tx.snapshotId, tenantId, businessId },
    });
    await appendEisOutboxEvent({
      tenantId,
      businessId,
      aggregateType: 'MraEisTransmission',
      aggregateId: tx.id,
      eventType: EIS_OUTBOX_EVENT.TRANSMISSION_RECONCILIATION_REQUESTED,
      eventVersion: '1',
      payload: {
        tenantId,
        businessId,
        terminalId: tx.terminalId,
        transmissionId: tx.id,
        attemptId: tx.currentAttemptId,
        fiscalSnapshotId: tx.snapshotId,
        fiscalNumber: snapshot?.canonicalSnapshot?.fiscalNumber?.formatted || null,
        environment: tx.environment,
        reasonCode: 'UNKNOWN_OUTCOME',
        recoveredByPhase15: true,
        occurredAt: new Date().toISOString(),
      },
      idempotencyKey: key,
      db,
    });
    created.push(tx.id);
  }

  return { scanned: unknowns.length, created: created.length, transmissionIds: created };
}
