import { describe, it, expect, vi } from 'vitest';
import {
  appendAnalyticsOutbox,
  redactAnalyticsPayload,
  planPaymentEventBackfill,
  evaluateReconciliation,
  ANALYTICS_EVENT_TYPES,
  VERIFIED_EMITTERS,
  SCAFFOLD_ONLY,
} from '@/lib/admin/analytics';

describe('analytics catalogue', () => {
  it('keeps CRM events scaffold-only', () => {
    expect(SCAFFOLD_ONLY.has(ANALYTICS_EVENT_TYPES.LEAD_CREATED)).toBe(true);
    expect(VERIFIED_EMITTERS.has(ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED)).toBe(
      true
    );
  });
});

describe('redactAnalyticsPayload', () => {
  it('redacts secrets and masks email', () => {
    const out = redactAnalyticsPayload({
      email: 'alice@example.com',
      password: 'secret',
      amount: 10,
    });
    expect(out.password).toBe('[REDACTED]');
    expect(out.email).toMatch(/^a\*\*\*/);
    expect(out.amount).toBe(10);
  });
});

describe('appendAnalyticsOutbox', () => {
  it('is idempotent on matching checksum', async () => {
    const store = [];
    const db = {
      analyticsOutbox: {
        create: vi.fn(async ({ data }) => {
          if (store.some((r) => r.idempotencyKey === data.idempotencyKey)) {
            const err = new Error('unique');
            err.code = 'P2002';
            throw err;
          }
          const row = { id: `ob-${store.length + 1}`, ...data };
          store.push(row);
          return row;
        }),
        findUnique: vi.fn(async ({ where }) =>
          store.find((r) => r.idempotencyKey === where.idempotencyKey) || null
        ),
      },
    };

    const input = {
      tenantId: 't1',
      aggregateType: 'PlatformPayment',
      aggregateId: 'p1',
      eventType: ANALYTICS_EVENT_TYPES.PLATFORM_PAYMENT_SUCCEEDED,
      idempotencyKey: 'evt:PLATFORM_PAYMENT_SUCCEEDED:p1',
      payload: { amount: 100, currency: 'MWK' },
    };

    const first = await appendAnalyticsOutbox(db, input);
    const second = await appendAnalyticsOutbox(db, input);
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.created).toBe(false);
    expect(db.analyticsOutbox.create).toHaveBeenCalledTimes(2);
  });

  it('rejects scaffold-only events', async () => {
    const r = await appendAnalyticsOutbox(
      { analyticsOutbox: { create: vi.fn() } },
      {
        tenantId: 't1',
        aggregateType: 'Lead',
        aggregateId: 'l1',
        eventType: ANALYTICS_EVENT_TYPES.LEAD_CREATED,
        idempotencyKey: 'x',
      }
    );
    expect(r.ok).toBe(false);
  });
});

describe('planPaymentEventBackfill', () => {
  it('skips payments that already have events', () => {
    const plan = planPaymentEventBackfill({
      payments: [
        { id: 'p1', tenantId: 't1', amount: 10 },
        { id: 'p2', tenantId: 't1', amount: 20 },
      ],
      existingEventKeys: new Set(['evt:PLATFORM_PAYMENT_SUCCEEDED:p1']),
    });
    expect(plan.actions.map((a) => a.aggregateId)).toEqual(['p2']);
  });
});

describe('evaluateReconciliation', () => {
  it('detects mismatch', () => {
    expect(evaluateReconciliation(5, 3)).toEqual({
      status: 'MISMATCH',
      variance: 2,
      expected: 5,
      actual: 3,
    });
  });
});
