import { describe, it, expect, vi } from 'vitest';
import {
  consumeBillingFacts,
  dispatchAnalyticsOutbox,
  ANALYTICS_EVENT_TYPES,
  OUTBOX_STATUS,
} from '@/lib/admin/analytics';

describe('consumeBillingFacts', () => {
  it('creates a billing fact once (idempotent via checkpoint)', async () => {
    const facts = [];
    const checkpoints = new Map();
    const event = {
      id: 'e1',
      eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
      tenantId: 't1',
      sourceType: 'PlatformPayment',
      sourceId: 'p1',
      idempotencyKey: 'evt:PLATFORM_PAYMENT_SUCCEEDED:p1',
      occurredAt: new Date('2026-07-01T00:00:00.000Z'),
      payload: { amount: 50, currency: 'MWK' },
    };

    const db = {
      analyticsFactPlatformBilling: {
        create: vi.fn(async ({ data }) => {
          facts.push(data);
          return { id: 'f1', ...data };
        }),
      },
      analyticsConsumerCheckpoint: {
        findUnique: vi.fn(async ({ where }) => checkpoints.get(where.consumerName) || null),
        upsert: vi.fn(async ({ where, create, update }) => {
          const next = checkpoints.get(where.consumerName)
            ? { ...checkpoints.get(where.consumerName), ...update }
            : create;
          checkpoints.set(where.consumerName, next);
          return next;
        }),
      },
    };

    const first = await consumeBillingFacts(db, event);
    const second = await consumeBillingFacts(db, event);
    expect(first.created).toBe(true);
    expect(second.skipped).toBe(true);
    expect(facts).toHaveLength(1);
  });
});

describe('dispatchAnalyticsOutbox', () => {
  it('publishes pending outbox into AnalyticsEvent', async () => {
    const outbox = [
      {
        id: 'ob1',
        eventType: ANALYTICS_EVENT_TYPES.TENANT_CREATED,
        schemaVersion: '1',
        tenantId: 't1',
        aggregateType: 'Tenant',
        aggregateId: 't1',
        idempotencyKey: 'evt:TENANT_CREATED:t1',
        occurredAt: new Date(),
        privacyClass: 'INTERNAL',
        actorType: 'admin',
        actorId: 'a1',
        correlationId: null,
        requestId: null,
        payload: { name: 'Acme' },
        status: OUTBOX_STATUS.PENDING,
        availableAt: new Date(0),
        attemptCount: 0,
      },
    ];
    const events = [];

    const db = {
      analyticsOutbox: {
        findMany: vi.fn(async () => outbox.filter((r) => r.status === OUTBOX_STATUS.PENDING)),
        update: vi.fn(async ({ where, data }) => {
          const row = outbox.find((r) => r.id === where.id);
          Object.assign(row, data);
          if (data.attemptCount?.increment) {
            row.attemptCount = (row.attemptCount || 0) + data.attemptCount.increment;
          }
          return row;
        }),
      },
      analyticsEvent: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => {
          const row = { id: 'ev1', ...data };
          events.push(row);
          return row;
        }),
      },
      analyticsDataFreshness: {
        upsert: vi.fn(async () => ({})),
      },
    };

    const result = await dispatchAnalyticsOutbox(db, { limit: 10 });
    expect(result.ok).toBe(true);
    expect(events).toHaveLength(1);
    expect(outbox[0].status).toBe(OUTBOX_STATUS.DONE);
  });
});
