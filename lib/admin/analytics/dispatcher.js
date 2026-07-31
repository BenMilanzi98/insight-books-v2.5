/**
 * Publish claimed outbox rows into AnalyticsEvent (idempotent).
 */

import { OUTBOX_STATUS } from './catalogue.js';
import { claimAnalyticsOutboxBatch } from './outbox.js';

/**
 * @param {object} db
 * @param {{ workerId?: string, limit?: number }} [opts]
 */
export async function dispatchAnalyticsOutbox(db, opts = {}) {
  const claimed = await claimAnalyticsOutboxBatch(db, opts);
  const results = [];

  for (const row of claimed) {
    try {
      if (typeof db.analyticsEvent?.findUnique === 'function') {
        const existing = await db.analyticsEvent.findUnique({
          where: { idempotencyKey: row.idempotencyKey },
        });
        if (existing) {
          await db.analyticsOutbox.update({
            where: { id: row.id },
            data: { status: OUTBOX_STATUS.DONE, processedAt: new Date(), lastError: null },
          });
          results.push({ outboxId: row.id, eventId: existing.id, duplicate: true });
          continue;
        }
      }

      const event = await db.analyticsEvent.create({
        data: {
          eventType: row.eventType,
          schemaVersion: row.schemaVersion || '1',
          tenantId: row.tenantId,
          sourceType: row.aggregateType,
          sourceId: row.aggregateId,
          idempotencyKey: row.idempotencyKey,
          occurredAt: row.occurredAt,
          privacyClass: row.privacyClass || 'INTERNAL',
          actorType: row.actorType,
          actorId: row.actorId,
          correlationId: row.correlationId,
          requestId: row.requestId,
          payload: row.payload,
          outboxId: row.id,
        },
      });

      await db.analyticsOutbox.update({
        where: { id: row.id },
        data: { status: OUTBOX_STATUS.DONE, processedAt: new Date(), lastError: null },
      });
      results.push({ outboxId: row.id, eventId: event.id, duplicate: false });
    } catch (e) {
      const attempts = Number(row.attemptCount || 0);
      const dead = attempts >= 5;
      await db.analyticsOutbox.update({
        where: { id: row.id },
        data: {
          status: dead ? OUTBOX_STATUS.DEAD : OUTBOX_STATUS.PENDING,
          lastError: e?.message || 'dispatch failed',
          availableAt: new Date(Date.now() + Math.min(attempts, 10) * 30_000),
          claimedAt: null,
          claimedBy: null,
          claimExpiresAt: null,
        },
      });
      if (dead && typeof db.analyticsDeadLetter?.create === 'function') {
        await db.analyticsDeadLetter.create({
          data: {
            outboxId: row.id,
            eventType: row.eventType,
            errorCode: e?.code || 'DISPATCH_FAILED',
            errorMessage: e?.message || 'dispatch failed',
            payload: row.payload,
            attemptCount: attempts,
          },
        });
      }
      results.push({ outboxId: row.id, error: e?.message || 'dispatch failed', dead });
    }
  }

  if (typeof db.analyticsDataFreshness?.upsert === 'function') {
    await db.analyticsDataFreshness.upsert({
      where: { sourceKey: 'analytics_outbox_dispatcher' },
      create: {
        sourceKey: 'analytics_outbox_dispatcher',
        lastSuccessAt: new Date(),
        lastAttemptAt: new Date(),
        lagSeconds: 0,
        status: 'OK',
      },
      update: {
        lastSuccessAt: new Date(),
        lastAttemptAt: new Date(),
        lagSeconds: 0,
        status: 'OK',
      },
    });
  }

  return {
    ok: true,
    claimed: claimed.length,
    results,
  };
}
