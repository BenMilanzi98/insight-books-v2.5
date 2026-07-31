/**
 * Historical backfill planner — only from real operational rows (dry-run default).
 */

import { ANALYTICS_EVENT_TYPES } from './catalogue.js';
import { appendAnalyticsOutbox } from './outbox.js';

/**
 * Plan payment → PLATFORM_PAYMENT_SUCCEEDED backfill actions.
 */
export function planPaymentEventBackfill({ payments = [], existingEventKeys = new Set() }) {
  const actions = [];
  const skipped = [];

  for (const p of payments) {
    if (!p?.id || !p?.tenantId) {
      skipped.push({ id: p?.id, reason: 'invalid' });
      continue;
    }
    const key = `evt:PLATFORM_PAYMENT_SUCCEEDED:${p.id}`;
    if (existingEventKeys.has(key)) {
      skipped.push({ id: p.id, reason: 'event_exists' });
      continue;
    }
    actions.push({
      eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
      tenantId: p.tenantId,
      aggregateType: 'PlatformPayment',
      aggregateId: p.id,
      idempotencyKey: key,
      occurredAt: p.createdAt || p.updatedAt || new Date().toISOString(),
      payload: {
        amount: Number(p.amount || 0),
        currency: p.currency || 'MWK',
        gateway: p.gateway || null,
        invoiceId: p.invoiceId || null,
      },
    });
  }

  return {
    actions,
    skipped,
    summary: { eligible: actions.length, skipped: skipped.length, examined: payments.length },
  };
}

export async function runPaymentEventBackfill(db, { dryRun = true, limit = 100 } = {}) {
  const payments = await db.platformPayment.findMany({
    where: { status: { in: ['COMPLETED', 'Completed', 'completed'] } },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(Number(limit) || 100, 1), 500),
    select: {
      id: true,
      tenantId: true,
      amount: true,
      currency: true,
      gateway: true,
      invoiceId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  const events = await db.analyticsEvent.findMany({
    where: { eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED },
    select: { idempotencyKey: true },
    take: 5000,
  });
  const existingEventKeys = new Set(events.map((e) => e.idempotencyKey));

  const plan = planPaymentEventBackfill({ payments, existingEventKeys });
  if (dryRun) {
    return { ok: true, dryRun: true, ...plan };
  }

  const executed = [];
  for (const action of plan.actions) {
    const result = await appendAnalyticsOutbox(db, action);
    executed.push({
      paymentId: action.aggregateId,
      ok: result.ok,
      created: result.created,
      error: result.error || null,
    });
  }

  return {
    ok: executed.every((e) => e.ok),
    dryRun: false,
    summary: plan.summary,
    executed,
  };
}
