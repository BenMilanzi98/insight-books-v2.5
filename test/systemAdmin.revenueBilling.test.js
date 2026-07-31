import { describe, it, expect, vi } from 'vitest';
import {
  buildBillingAnalyticsPack,
  buildCollectionsAnalyticsPack,
  buildReceivablesAnalyticsPack,
  buildPaymentPerformancePack,
  buildCreditsRefundsAnalyticsPack,
  buildMraEisCommercialPack,
  computeReceivablesAgeing,
  invoiceDueReference,
  AGEING_DUE_FIELD_DOC,
  assertNoFalseZero,
  REVENUE_KPI_CODES,
  METRIC_STATUS,
} from '@/lib/admin/revenue';

const adminFinance = { id: 'a1', role: 'Super Admin', permissions: {} };

function moneyInv(partial) {
  return {
    id: partial.id || 'inv1',
    total: 'total' in partial ? partial.total : 1000,
    outstanding: 'outstanding' in partial ? partial.outstanding : 1000,
    status: partial.status || 'ISSUED',
    currency: partial.currency || 'MWK',
    periodEnd: 'periodEnd' in partial ? partial.periodEnd : null,
    createdAt: partial.createdAt || new Date('2026-07-01T00:00:00Z'),
    subscriptionId: 'subscriptionId' in partial ? partial.subscriptionId : null,
    amountPaid: 'amountPaid' in partial ? partial.amountPaid : 0,
  };
}

function makePrisma(overrides = {}) {
  return {
    platformInvoice: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { total: 0 }, _count: { _all: 0 } })),
    },
    platformPayment: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 }, _count: { _all: 0 } })),
      groupBy: vi.fn(async () => []),
    },
    platformCredit: {
      findMany: vi.fn(async () => []),
      aggregate: vi.fn(async () => ({ _sum: { amount: 0, remaining: 0 }, _count: { _all: 0 } })),
      count: vi.fn(async () => 0),
    },
    platformRefund: {
      aggregate: vi.fn(async () => ({ _sum: { amount: 0 }, _count: { _all: 0 } })),
    },
    accountSubscription: {
      findMany: vi.fn(async () => []),
      findUnique: vi.fn(async () => null),
    },
    ...overrides,
  };
}

describe('receivables ageing field choice', () => {
  it('documents periodEnd fallback (no dueDate on PlatformInvoice)', () => {
    expect(AGEING_DUE_FIELD_DOC).toMatch(/periodEnd/i);
    expect(AGEING_DUE_FIELD_DOC).toMatch(/createdAt/i);
    expect(AGEING_DUE_FIELD_DOC).toMatch(/no dueDate/i);
  });

  it('invoiceDueReference prefers periodEnd then createdAt', () => {
    const pe = new Date('2026-06-01');
    const ca = new Date('2026-05-01');
    expect(invoiceDueReference({ periodEnd: pe, createdAt: ca })).toEqual(pe);
    expect(invoiceDueReference({ periodEnd: null, createdAt: ca })).toEqual(ca);
  });
});

describe('computeReceivablesAgeing', () => {
  it('ageing bucket amounts are non-negative and sum to outstanding', async () => {
    const now = new Date('2026-07-28T12:00:00Z');
    const prisma = makePrisma({
      platformInvoice: {
        findMany: vi.fn(async () => [
          moneyInv({
            id: 'c',
            outstanding: 100,
            periodEnd: new Date('2026-08-01'),
          }),
          moneyInv({
            id: 'd15',
            outstanding: 200,
            periodEnd: new Date('2026-07-13'),
          }),
          moneyInv({
            id: 'd45',
            outstanding: 300,
            periodEnd: new Date('2026-06-13'),
          }),
          moneyInv({
            id: 'd75',
            outstanding: 400,
            periodEnd: new Date('2026-05-14'),
          }),
          moneyInv({
            id: 'd120',
            outstanding: 500,
            periodEnd: new Date('2026-03-01'),
          }),
        ]),
      },
    });

    const result = await computeReceivablesAgeing(prisma, { currency: 'MWK', now });
    expect(result.ok).toBe(true);
    const b = result.buckets;
    for (const key of ['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus']) {
      expect(b[key]).toBeGreaterThanOrEqual(0);
    }
    expect(b.current).toBe(100);
    expect(b.d1_30).toBe(200);
    expect(b.d31_60).toBe(300);
    expect(b.d61_90).toBe(400);
    expect(b.d90_plus).toBe(500);
    expect(result.outstandingTotal).toBe(1500);
    expect(
      b.current + b.d1_30 + b.d31_60 + b.d61_90 + b.d90_plus
    ).toBe(result.outstandingTotal);
  });

  it('incomplete outstanding → UNAVAILABLE (not false zero)', async () => {
    const prisma = makePrisma({
      platformInvoice: {
        findMany: vi.fn(async () => [
          moneyInv({ outstanding: null, periodEnd: new Date('2026-07-01') }),
        ]),
      },
    });
    const result = await computeReceivablesAgeing(prisma, {
      currency: 'MWK',
      now: new Date('2026-07-28'),
    });
    expect(result.ok).toBe(false);
    expect(result.reasonCode).toBe('incomplete_outstanding');
    expect(result.buckets).toBeNull();
  });

  it('respects currency filter', async () => {
    const prisma = makePrisma({
      platformInvoice: {
        findMany: vi.fn(async (args) => {
          expect(args.where.currency).toBe('USD');
          return [moneyInv({ currency: 'USD', outstanding: 50, periodEnd: new Date('2026-08-01') })];
        }),
      },
    });
    const result = await computeReceivablesAgeing(prisma, {
      currency: 'USD',
      now: new Date('2026-07-28'),
    });
    expect(result.ok).toBe(true);
    expect(result.currency).toBe('USD');
    expect(result.buckets.current).toBe(50);
  });
});

describe('Wave 3 billing KPI packs', () => {
  it('forbids without view permission', async () => {
    const pack = await buildBillingAnalyticsPack(makePrisma(), {
      admin: { id: 'x', role: 'Platform Support', permissions: {} },
      currency: 'MWK',
    });
    expect(pack.forbidden).toBe(true);
  });

  it('currency=ALL marks money totals UNAVAILABLE (no FX)', async () => {
    const pack = await buildBillingAnalyticsPack(makePrisma(), {
      admin: adminFinance,
      currency: 'ALL',
    });
    expect(pack.ok).toBe(true);
    const billed = pack.metrics[REVENUE_KPI_CODES.BILLED_PERIOD];
    expect(billed.status).toBe(METRIC_STATUS.UNAVAILABLE);
    expect(billed.value).toBeNull();
    expect(billed.reasonCode).toBe('fx_unavailable');
    expect(assertNoFalseZero(billed)).toBe(true);
  });

  it('query fail → UNAVAILABLE not false zero', async () => {
    const prisma = makePrisma({
      platformInvoice: {
        findMany: vi.fn(async () => {
          throw new Error('db down');
        }),
        aggregate: vi.fn(async () => {
          throw new Error('db down');
        }),
      },
    });
    const pack = await buildBillingAnalyticsPack(prisma, {
      admin: adminFinance,
      currency: 'MWK',
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-07-28'),
    });
    const billed = pack.metrics[REVENUE_KPI_CODES.BILLED_PERIOD];
    expect(billed.status).toBe(METRIC_STATUS.UNAVAILABLE);
    expect(billed.value).toBeNull();
    expect(assertNoFalseZero(billed)).toBe(true);
  });

  it('no Sale in JSON across Wave 3 packs', async () => {
    const now = new Date('2026-07-28');
    const periodStart = new Date('2026-07-01');
    const prisma = makePrisma({
      platformInvoice: {
        findMany: vi.fn(async () => [
          moneyInv({
            total: 1000,
            outstanding: 400,
            status: 'PARTIALLY_PAID',
            periodEnd: new Date('2026-08-01'),
            subscriptionId: 'sub-eis',
          }),
        ]),
        aggregate: vi.fn(async () => ({ _sum: { total: 1000 }, _count: { _all: 1 } })),
      },
      platformPayment: {
        findMany: vi.fn(async () => [
          { id: 'p1', amount: 600, status: 'COMPLETED', currency: 'MWK', invoiceId: 'inv1', createdAt: now },
          { id: 'p2', amount: 100, status: 'FAILED', currency: 'MWK', invoiceId: null, createdAt: now },
        ]),
        aggregate: vi.fn(async () => ({ _sum: { amount: 600 }, _count: { _all: 1 } })),
        groupBy: vi.fn(async () => []),
      },
      platformCredit: {
        findMany: vi.fn(async () => []),
        aggregate: vi.fn(async () => ({ _sum: { amount: 0, remaining: 50 }, _count: { _all: 1 } })),
        count: vi.fn(async () => 1),
      },
      platformRefund: {
        aggregate: vi.fn(async () => ({ _sum: { amount: 25 }, _count: { _all: 1 } })),
      },
      accountSubscription: {
        findMany: vi.fn(async () => [
          {
            id: 'sub-eis',
            tenantId: 't1',
            plan: 'eis-monthly',
            amount: 5000,
            currency: 'MWK',
            status: 'Completed',
          },
        ]),
      },
    });

    const opts = { admin: adminFinance, currency: 'MWK', periodStart, periodEnd: now, now };
    const packs = await Promise.all([
      buildBillingAnalyticsPack(prisma, opts),
      buildCollectionsAnalyticsPack(prisma, opts),
      buildReceivablesAnalyticsPack(prisma, opts),
      buildPaymentPerformancePack(prisma, opts),
      buildCreditsRefundsAnalyticsPack(prisma, opts),
      buildMraEisCommercialPack(prisma, opts),
    ]);

    for (const pack of packs) {
      expect(pack.ok).toBe(true);
      const blob = JSON.stringify(pack);
      // \bSale\b does not match TenantSale (no boundary inside the identifier);
      // pack may list TenantSale under sources.excludes as a forbidden source.
      expect(blob).not.toMatch(/\bSale\b/);
      expect(blob).not.toMatch(/tenantActivity/);
      expect(blob).not.toMatch(/"source":\s*"Sale"/);
      for (const m of Object.values(pack.metrics || {})) {
        expect(assertNoFalseZero(m)).toBe(true);
      }
    }

    const recv = packs[2];
    for (const code of [
      REVENUE_KPI_CODES.AGEING_CURRENT,
      REVENUE_KPI_CODES.AGEING_D1_30,
      REVENUE_KPI_CODES.AGEING_D31_60,
      REVENUE_KPI_CODES.AGEING_D61_90,
      REVENUE_KPI_CODES.AGEING_D90_PLUS,
    ]) {
      const m = recv.metrics[code];
      expect(m.value == null || m.value >= 0).toBe(true);
    }

    const payPerf = packs[3];
    expect(payPerf.metrics[REVENUE_KPI_CODES.PAYMENT_RETRY_ANALYTICS].status).toBe(
      METRIC_STATUS.NOT_SUPPORTED
    );
    expect(payPerf.metrics[REVENUE_KPI_CODES.PAYMENT_RETRY_ANALYTICS].value).toBeNull();
  });

  it('collections respects currency filter', async () => {
    const prisma = makePrisma({
      platformPayment: {
        findMany: vi.fn(async () => []),
        aggregate: vi.fn(async (args) => {
          expect(args.where.currency).toBe('ZAR');
          expect(args.where.status.in).toEqual(
            expect.arrayContaining(['COMPLETED', 'SUCCESSFUL', 'FULLY_ALLOCATED'])
          );
          return { _sum: { amount: 123 }, _count: { _all: 1 } };
        }),
        groupBy: vi.fn(async () => []),
      },
    });
    const pack = await buildCollectionsAnalyticsPack(prisma, {
      admin: adminFinance,
      currency: 'ZAR',
      periodStart: new Date('2026-07-01'),
      periodEnd: new Date('2026-07-28'),
    });
    expect(pack.metrics[REVENUE_KPI_CODES.COLLECTED_PERIOD].value).toBe(123);
    expect(pack.metrics[REVENUE_KPI_CODES.COLLECTED_PERIOD].currency).toBe('ZAR');
  });
});
