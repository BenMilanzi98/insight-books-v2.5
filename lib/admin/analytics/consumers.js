/**
 * Idempotent analytics consumers → fact tables.
 */

import { ANALYTICS_EVENT_TYPES } from './catalogue.js';
import { consumeProductUsageFacts } from '@/lib/admin/productAnalytics/facts.js';

async function alreadyConsumed(db, consumerName, eventId) {
  const cp = await db.analyticsConsumerCheckpoint?.findUnique?.({
    where: { consumerName },
  });
  if (!cp?.cursor?.processedIds) return false;
  return Boolean(cp.cursor.processedIds[eventId]);
}

async function markConsumed(db, consumerName, event) {
  const cp = await db.analyticsConsumerCheckpoint.findUnique({
    where: { consumerName },
  });
  const processedIds = { ...(cp?.cursor?.processedIds || {}), [event.id]: true };
  // Cap memory of processed id map
  const keys = Object.keys(processedIds);
  if (keys.length > 500) {
    for (const k of keys.slice(0, keys.length - 400)) delete processedIds[k];
  }
  await db.analyticsConsumerCheckpoint.upsert({
    where: { consumerName },
    create: {
      consumerName,
      lastEventId: event.id,
      lastOccurredAt: event.occurredAt,
      cursor: { processedIds },
    },
    update: {
      lastEventId: event.id,
      lastOccurredAt: event.occurredAt,
      cursor: { processedIds },
    },
  });
}

export async function consumeBillingFacts(db, event) {
  const consumerName = 'fact_platform_billing';
  if (await alreadyConsumed(db, consumerName, event.id)) {
    return { ok: true, skipped: true };
  }

  const billingTypes = new Set([
    ANALYTICS_EVENT_TYPES.PLATFORM_INVOICE_ISSUED,
    ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
  ]);
  if (!billingTypes.has(event.eventType)) {
    return { ok: true, skipped: true, reason: 'not_billing' };
  }

  const amount = Number(event.payload?.amount ?? event.payload?.total ?? 0);
  await db.analyticsFactPlatformBilling.create({
    data: {
      tenantId: event.tenantId || 'unknown',
      sourceType: event.sourceType,
      sourceId: event.sourceId,
      eventType: event.eventType,
      amount,
      currency: event.payload?.currency || 'MWK',
      occurredAt: event.occurredAt,
      idempotencyKey: `fact-bill:${event.idempotencyKey}`,
    },
  });
  await markConsumed(db, consumerName, event);
  return { ok: true, created: true };
}

export async function consumeSubscriptionFacts(db, event) {
  const consumerName = 'fact_subscription';
  if (await alreadyConsumed(db, consumerName, event.id)) {
    return { ok: true, skipped: true };
  }
  if (!String(event.eventType).startsWith('SUBSCRIPTION_')) {
    return { ok: true, skipped: true, reason: 'not_subscription' };
  }
  await db.analyticsFactSubscription.create({
    data: {
      tenantId: event.tenantId || 'unknown',
      subscriptionId: event.sourceId,
      eventType: event.eventType,
      planCode: event.payload?.planCode || event.payload?.plan || null,
      amount:
        event.payload?.amount != null ? Number(event.payload.amount) : null,
      occurredAt: event.occurredAt,
      idempotencyKey: `fact-sub:${event.idempotencyKey}`,
    },
  });
  await markConsumed(db, consumerName, event);
  return { ok: true, created: true };
}

export async function consumeTenantActivityFacts(db, event) {
  const consumerName = 'fact_tenant_activity';
  if (await alreadyConsumed(db, consumerName, event.id)) {
    return { ok: true, skipped: true };
  }
  const types = new Set([
    ANALYTICS_EVENT_TYPES.TENANT_CREATED,
    ANALYTICS_EVENT_TYPES.TENANT_STATUS_CHANGED,
    ANALYTICS_EVENT_TYPES.USER_LOGIN,
  ]);
  if (!types.has(event.eventType)) {
    return { ok: true, skipped: true, reason: 'not_tenant_activity' };
  }
  await db.analyticsFactTenantActivity.create({
    data: {
      tenantId: event.tenantId || 'unknown',
      eventType: event.eventType,
      occurredAt: event.occurredAt,
      idempotencyKey: `fact-ten:${event.idempotencyKey}`,
      meta: event.payload || {},
    },
  });
  await markConsumed(db, consumerName, event);
  return { ok: true, created: true };
}

/**
 * Run all fact consumers for a batch of events (or load unconsumed).
 */
export async function runFactConsumers(db, { limit = 50 } = {}) {
  const events = await db.analyticsEvent.findMany({
    orderBy: { ingestedAt: 'asc' },
    take: limit,
  });
  const results = [];
  for (const event of events) {
    try {
      const a = await consumeBillingFacts(db, event);
      const b = await consumeSubscriptionFacts(db, event);
      const c = await consumeTenantActivityFacts(db, event);
      const d = await consumeProductUsageFacts(db, event);
      results.push({
        eventId: event.id,
        billing: a,
        subscription: b,
        tenant: c,
        productUsage: d,
      });
    } catch (e) {
      if (e?.code === 'P2002') {
        results.push({ eventId: event.id, skipped: true, reason: 'idempotent' });
        continue;
      }
      results.push({ eventId: event.id, error: e?.message || 'consume failed' });
    }
  }
  return { ok: true, processed: results.length, results };
}
