import prisma from '@/lib/prisma.js';
import {
  TRANSMISSION_STATUS,
  TRANSMISSION_MODE,
  ATTEMPT_OUTCOME,
  RETRY_CLASSIFICATION,
  RECEIPT_EIS_STATUS,
} from '../../domain/operationalEnums.js';
import { transitionTransmission } from '../../domain/operationalStateMachines.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch, createIdempotencyKey } from '../../domain/valueObjects/index.js';
import { appendEisOutboxEvent } from '../../infrastructure/outbox/outboxService.js';
import { EIS_OUTBOX_EVENT } from '../../domain/operationalEnums.js';
import { SNAPSHOT_STATUS } from '../../domain/operationalEnums.js';

export async function createTransmission({
  tenantId,
  businessId = tenantId,
  terminalId,
  snapshotId,
  environment,
  mode = TRANSMISSION_MODE.ONLINE,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const snapshot = await db.mraEisSnapshot.findFirst({
    where: { id: snapshotId, tenantId, businessId },
  });
  if (!snapshot) throw EisErrors.validation({ message: 'Snapshot not found.', httpStatus: 404 });
  // Phase 12/13: COMPLETED immutable snapshots are the normal source.
  // Phase 5 QUEUED remains accepted for legacy synthetic fixtures.
  const transmitReady =
    snapshot.immutableAt &&
    (snapshot.status === SNAPSHOT_STATUS.COMPLETED ||
      snapshot.status === SNAPSHOT_STATUS.QUEUED ||
      snapshot.status === SNAPSHOT_STATUS.NUMBER_PENDING);
  if (!transmitReady) {
    throw EisErrors.validation({
      message: 'Transmission requires a completed (or queued) immutable fiscal snapshot.',
      details: { status: snapshot.status, immutableAt: Boolean(snapshot.immutableAt) },
    });
  }
  if (snapshot.status === SNAPSHOT_STATUS.NUMBER_PENDING) {
    throw EisErrors.validation({
      message: 'Fiscal number is pending — cannot transmit until number assignment completes.',
      code: 'FISCAL_NUMBER_NOT_ASSIGNED',
    });
  }

  const idempotencyKey = createIdempotencyKey(['transmission', snapshotId, mode]).value;

  try {
    const row = await db.mraEisTransmission.create({
      data: {
        tenantId,
        businessId,
        terminalId,
        snapshotId,
        environment,
        mode,
        status: TRANSMISSION_STATUS.CREATED,
        idempotencyKey,
        version: 1,
      },
    });

    await db.mraEisReceiptProjection.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: snapshot.sourceType,
          sourceId: snapshot.sourceId,
        },
      },
      create: {
        tenantId,
        businessId,
        sourceType: snapshot.sourceType,
        sourceId: snapshot.sourceId,
        snapshotId,
        transmissionId: row.id,
        localDocumentNumber: snapshot.localDocumentNumber,
        eisStatus: RECEIPT_EIS_STATUS.EIS_PENDING,
        terminalId,
        sellerTin: snapshot.sellerTin,
        projectionVersion: 1,
      },
      update: {
        transmissionId: row.id,
        eisStatus: RECEIPT_EIS_STATUS.EIS_PENDING,
        projectionVersion: { increment: 1 },
      },
    });

    return row;
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.mraEisTransmission.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }
    throw err;
  }
}

export async function queueTransmission({
  tenantId,
  businessId = tenantId,
  transmissionId,
  expectedVersion,
  db = prisma,
}) {
  const current = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!current) throw EisErrors.validation({ message: 'Transmission not found.', httpStatus: 404 });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId, businessId });
  }
  transitionTransmission(current.status, TRANSMISSION_STATUS.QUEUED);

  const updated = await db.mraEisTransmission.update({
    where: { id: transmissionId },
    data: {
      previousStatus: current.status,
      status: TRANSMISSION_STATUS.QUEUED,
      firstQueuedAt: current.firstQueuedAt || new Date(),
      nextAttemptAt: new Date(),
      version: { increment: 1 },
    },
  });

  await appendEisOutboxEvent({
    tenantId,
    businessId,
    aggregateType: 'MraEisTransmission',
    aggregateId: transmissionId,
    eventType: EIS_OUTBOX_EVENT.TRANSMISSION_QUEUED,
    payload: { transmissionId, snapshotId: current.snapshotId },
    idempotencyKey: `tx-queued:${transmissionId}:${current.version}`,
    db,
  });

  return updated;
}

export async function claimTransmission({
  workerId,
  terminalId = null,
  leaseMs = 60_000,
  db = prisma,
}) {
  const now = new Date();
  const expires = new Date(now.getTime() + leaseMs);

  return db.$transaction(async (tx) => {
    const rows = terminalId
      ? await tx.$queryRaw`
          SELECT id, status, version, "tenantId", "businessId"
          FROM "MraEisTransmission"
          WHERE status = 'QUEUED'
            AND "terminalId" = ${terminalId}
            AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
          ORDER BY "nextAttemptAt" ASC NULLS FIRST
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `
      : await tx.$queryRaw`
          SELECT id, status, version, "tenantId", "businessId"
          FROM "MraEisTransmission"
          WHERE status = 'QUEUED'
            AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= ${now})
          ORDER BY "nextAttemptAt" ASC NULLS FIRST
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        `;

    const row = rows?.[0];
    if (!row) return null;

    transitionTransmission(row.status, TRANSMISSION_STATUS.CLAIMED);

    return tx.mraEisTransmission.update({
      where: { id: row.id },
      data: {
        previousStatus: row.status,
        status: TRANSMISSION_STATUS.CLAIMED,
        claimedAt: now,
        claimedByWorker: workerId,
        claimExpiresAt: expires,
        version: { increment: 1 },
      },
    });
  });
}

export async function appendTransmissionAttempt({
  tenantId,
  businessId = tenantId,
  transmissionId,
  endpointKey,
  requestChecksum,
  outcome = ATTEMPT_OUTCOME.STARTED,
  retryClassification = RETRY_CLASSIFICATION.NOT_APPLICABLE,
  workerId = null,
  requestId = null,
  correlationId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const tx = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!tx) throw EisErrors.validation({ message: 'Transmission not found.', httpStatus: 404 });

  const attemptNumber = tx.attemptCount + 1;
  const attempt = await db.mraEisTransmissionAttempt.create({
    data: {
      tenantId,
      businessId,
      transmissionId,
      attemptNumber,
      endpointKey,
      requestChecksum,
      outcome,
      retryClassification,
      workerId,
      requestId,
      correlationId,
    },
  });

  await db.mraEisTransmission.update({
    where: { id: transmissionId },
    data: {
      attemptCount: attemptNumber,
      currentAttemptId: attempt.id,
      lastAttemptAt: new Date(),
      version: { increment: 1 },
    },
  });

  return attempt;
}

export async function transitionTransmissionStatus({
  tenantId,
  businessId = tenantId,
  transmissionId,
  nextStatus,
  expectedVersion,
  validationUrl = null,
  db = prisma,
}) {
  const current = await db.mraEisTransmission.findFirst({
    where: { id: transmissionId, tenantId, businessId },
  });
  if (!current) throw EisErrors.validation({ message: 'Transmission not found.', httpStatus: 404 });
  if (expectedVersion != null && current.version !== expectedVersion) {
    throw EisErrors.versionConflict({ tenantId, businessId });
  }
  transitionTransmission(current.status, nextStatus);

  const accepted =
    nextStatus === TRANSMISSION_STATUS.ACCEPTED_ONLINE ||
    nextStatus === TRANSMISSION_STATUS.ACCEPTED_OFFLINE ||
    nextStatus === TRANSMISSION_STATUS.RECONCILED_ACCEPTED;

  const updated = await db.mraEisTransmission.update({
    where: { id: transmissionId },
    data: {
      previousStatus: current.status,
      status: nextStatus,
      validationUrl: validationUrl ?? current.validationUrl,
      acceptedAt: accepted ? new Date() : current.acceptedAt,
      unknownOutcomeAt:
        nextStatus === TRANSMISSION_STATUS.UNKNOWN_OUTCOME ? new Date() : current.unknownOutcomeAt,
      rejectedAt: nextStatus === TRANSMISSION_STATUS.REJECTED ? new Date() : current.rejectedAt,
      version: { increment: 1 },
    },
  });

  // Receipt projection: never mark validated unless accepted
  const snapshot = await db.mraEisSnapshot.findUnique({ where: { id: current.snapshotId } });
  if (snapshot) {
    let eisStatus = RECEIPT_EIS_STATUS.EIS_PENDING;
    if (accepted) eisStatus = RECEIPT_EIS_STATUS.EIS_ACCEPTED_ONLINE;
    else if (nextStatus === TRANSMISSION_STATUS.REJECTED) eisStatus = RECEIPT_EIS_STATUS.EIS_REJECTED;
    else if (nextStatus === TRANSMISSION_STATUS.UNKNOWN_OUTCOME) {
      eisStatus = RECEIPT_EIS_STATUS.EIS_UNKNOWN_OUTCOME;
    } else if (nextStatus === TRANSMISSION_STATUS.BLOCKED) {
      eisStatus = RECEIPT_EIS_STATUS.EIS_BLOCKED;
    }

    await db.mraEisReceiptProjection.updateMany({
      where: { snapshotId: snapshot.id, tenantId, businessId },
      data: {
        eisStatus,
        validationUrl: accepted ? validationUrl || current.validationUrl : null,
        acceptedAt: accepted ? new Date() : null,
        projectionVersion: { increment: 1 },
      },
    });
  }

  return updated;
}
