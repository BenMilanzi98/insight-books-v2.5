import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { OUTBOX_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';

function checksum(payload) {
  return crypto.createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

function assertNoSecrets(payload) {
  const text = JSON.stringify(payload ?? {});
  if (/(authorization|bearer\s|secretKey|jwt|tac\b|"token"\s*:)/i.test(text)) {
    throw EisErrors.validation({ message: 'Outbox payload must not contain secrets.' });
  }
}

export async function appendEisOutboxEvent({
  tenantId,
  businessId = null,
  aggregateType,
  aggregateId,
  eventType,
  eventVersion = '1',
  payload,
  idempotencyKey,
  availableAt = new Date(),
  requestId = null,
  correlationId = null,
  db = prisma,
}) {
  assertNoSecrets(payload);
  const payloadChecksum = checksum(payload);

  try {
    return await db.mraEisOutbox.create({
      data: {
        tenantId,
        businessId,
        aggregateType,
        aggregateId,
        eventType,
        eventVersion,
        payload,
        payloadChecksum,
        idempotencyKey,
        status: OUTBOX_STATUS.PENDING,
        availableAt,
        requestId,
        correlationId,
      },
    });
  } catch (err) {
    if (err?.code === 'P2002') {
      const existing = await db.mraEisOutbox.findUnique({ where: { idempotencyKey } });
      if (existing && existing.payloadChecksum === payloadChecksum) return existing;
      throw EisErrors.outboxConflict({ tenantId, businessId, details: { idempotencyKey } });
    }
    throw err;
  }
}

/**
 * Claim next pending outbox rows using SKIP LOCKED semantics where available.
 * Fake handlers only in Phase 5.
 */
export async function claimEisOutboxBatch({
  workerId,
  limit = 10,
  leaseMs = 60_000,
  db = prisma,
} = {}) {
  const now = new Date();
  const expires = new Date(now.getTime() + leaseMs);

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id FROM "MraEisOutbox"
      WHERE status = 'PENDING'
        AND "availableAt" <= ${now}
      ORDER BY "availableAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT ${limit}
    `;
    const ids = (rows || []).map((r) => r.id);
    if (!ids.length) return [];

    await tx.mraEisOutbox.updateMany({
      where: { id: { in: ids } },
      data: {
        status: OUTBOX_STATUS.CLAIMED,
        claimedAt: now,
        claimExpiresAt: expires,
        claimedBy: workerId,
        attemptCount: { increment: 1 },
      },
    });

    return tx.mraEisOutbox.findMany({ where: { id: { in: ids } } });
  });
}

export async function markEisOutboxProcessed({ id, db = prisma }) {
  return db.mraEisOutbox.update({
    where: { id },
    data: {
      status: OUTBOX_STATUS.PROCESSED,
      processedAt: new Date(),
    },
  });
}

export async function recoverExpiredEisOutboxClaims({ now = new Date(), db = prisma } = {}) {
  const result = await db.mraEisOutbox.updateMany({
    where: {
      status: OUTBOX_STATUS.CLAIMED,
      claimExpiresAt: { lt: now },
    },
    data: {
      status: OUTBOX_STATUS.PENDING,
      claimedAt: null,
      claimedBy: null,
      claimExpiresAt: null,
      availableAt: now,
    },
  });
  return { recovered: result.count };
}
