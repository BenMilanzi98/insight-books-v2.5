/**
 * Analytics transactional outbox — BI plane only.
 */

import { createHash } from 'crypto';
import {
  OUTBOX_STATUS,
  VERIFIED_EMITTERS,
  SCAFFOLD_ONLY,
  privacyForEventType,
  requiresTenantId,
} from './catalogue.js';
import { redactAnalyticsPayload, assertNoSecretsInPayload } from './redact.js';

function checksum(payload) {
  return createHash('sha256').update(JSON.stringify(payload ?? {})).digest('hex');
}

/**
 * @param {object} db Prisma client or transaction
 * @param {object} input
 */
export async function appendAnalyticsOutbox(db, input = {}) {
  const {
    tenantId = null,
    aggregateType,
    aggregateId,
    eventType,
    schemaVersion = '1',
    payload = {},
    idempotencyKey,
    correlationId = null,
    requestId = null,
    actorType = null,
    actorId = null,
    occurredAt = new Date(),
    availableAt = new Date(),
  } = input;

  if (!aggregateType || !aggregateId || !eventType || !idempotencyKey) {
    return { ok: false, error: 'aggregateType, aggregateId, eventType, idempotencyKey required' };
  }
  if (SCAFFOLD_ONLY.has(eventType)) {
    return { ok: false, error: `Event type ${eventType} is scaffold-only` };
  }
  if (!VERIFIED_EMITTERS.has(eventType)) {
    return { ok: false, error: `Unknown or unverified event type ${eventType}` };
  }
  if (requiresTenantId(eventType) && !tenantId) {
    return { ok: false, error: 'tenantId required for this event type' };
  }
  if (typeof db?.analyticsOutbox?.create !== 'function') {
    return { ok: false, error: 'analyticsOutbox unavailable' };
  }

  const safePayload = redactAnalyticsPayload(payload);
  assertNoSecretsInPayload(safePayload);
  const payloadChecksum = checksum(safePayload);
  const privacyClass = privacyForEventType(eventType);

  try {
    const row = await db.analyticsOutbox.create({
      data: {
        tenantId,
        aggregateType,
        aggregateId,
        eventType,
        schemaVersion,
        payload: safePayload,
        payloadChecksum,
        idempotencyKey,
        status: OUTBOX_STATUS.PENDING,
        availableAt,
        correlationId,
        requestId,
        privacyClass,
        actorType,
        actorId,
        occurredAt: occurredAt instanceof Date ? occurredAt : new Date(occurredAt),
      },
    });
    return { ok: true, created: true, row };
  } catch (e) {
    if (e?.code === 'P2002') {
      const existing = await db.analyticsOutbox.findUnique({
        where: { idempotencyKey },
      });
      if (existing && existing.payloadChecksum === payloadChecksum) {
        return { ok: true, created: false, row: existing };
      }
      return { ok: false, error: 'Outbox idempotency conflict', code: 'CONFLICT' };
    }
    return { ok: false, error: e?.message || 'Outbox append failed' };
  }
}

/**
 * Claim pending outbox rows (portable: no SKIP LOCKED required for unit tests).
 */
export async function claimAnalyticsOutboxBatch(db, { workerId, limit = 20 } = {}) {
  if (typeof db?.analyticsOutbox?.findMany !== 'function') return [];
  const now = new Date();
  const rows = await db.analyticsOutbox.findMany({
    where: {
      status: OUTBOX_STATUS.PENDING,
      availableAt: { lte: now },
    },
    orderBy: { availableAt: 'asc' },
    take: Math.min(Math.max(Number(limit) || 20, 1), 100),
  });
  if (!rows.length) return [];

  const claimed = [];
  for (const row of rows) {
    const updated = await db.analyticsOutbox.update({
      where: { id: row.id },
      data: {
        status: OUTBOX_STATUS.CLAIMED,
        claimedAt: now,
        claimExpiresAt: new Date(now.getTime() + 60_000),
        claimedBy: workerId || 'analytics-dispatcher',
        attemptCount: { increment: 1 },
      },
    });
    claimed.push(updated);
  }
  return claimed;
}
