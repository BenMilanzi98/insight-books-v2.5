import { describe, it, expect, vi } from 'vitest';
import {
  buildExecutiveKpiPack,
  assertNoFalseZero,
  filterPackBySection,
  METRIC_STATUS,
  unavailableMetric,
  KPI_CODES,
} from '@/lib/admin/intelligence';

function makePrisma(overrides = {}) {
  const sub = {
    id: 's1',
    tenantId: 't1',
    plan: '1month',
    amount: 12000,
    currency: 'MWK',
    status: 'Completed',
  };
  return {
    accountSubscription: {
      findMany: vi.fn(async () => [sub]),
      count: vi.fn(async () => 0),
    },
    platformPayment: {
      aggregate: vi.fn(async () => ({ _sum: { amount: 5000 } })),
    },
    platformCredit: {
      count: vi.fn(async () => 0),
    },
    tenant: { count: vi.fn(async () => 3) },
    user: { count: vi.fn(async () => 10) },
    analyticsDataFreshness: {
      findUnique: vi.fn(async () => ({
        lastSuccessAt: new Date(),
        status: 'OK',
      })),
    },
    analyticsReconciliationRun: {
      findFirst: vi.fn(async () => null),
    },
    mraEisTenantEntitlement: {
      count: vi.fn(async () => 1),
    },
    ...overrides,
  };
}

describe('metric envelopes', () => {
  it('unavailable metrics never expose zero values', () => {
    const m = unavailableMetric(KPI_CODES.ENGAGEMENT_DAU, 'not instrumented');
    expect(m.value).toBeNull();
    expect(m.status).toBe(METRIC_STATUS.NOT_SUPPORTED);
    expect(assertNoFalseZero(m)).toBe(true);
  });

  it('rejects false zero on UNAVAILABLE', () => {
    expect(
      assertNoFalseZero({
        status: METRIC_STATUS.UNAVAILABLE,
        value: 0,
      })
    ).toBe(false);
  });
});

describe('buildExecutiveKpiPack', () => {
  it('returns forbidden when admin lacks view permissions', async () => {
    const pack = await buildExecutiveKpiPack(makePrisma(), {
      admin: {
        id: 'a1',
        role: 'Platform Support',
        permissions: {},
      },
    });
    expect(pack.forbidden).toBe(true);
  });

  it('builds SaaS metrics without Tenant Sale', async () => {
    const prisma = makePrisma();
    const pack = await buildExecutiveKpiPack(prisma, {
      admin: { id: 'a1', role: 'Super Admin', permissions: {} },
    });

    expect(pack.ok).toBe(true);
    expect(pack.metrics[KPI_CODES.MRR_ESTIMATED].value).toBeGreaterThan(0);
    expect(pack.metrics[KPI_CODES.ARR_ESTIMATED].value).toBe(
      pack.metrics[KPI_CODES.MRR_ESTIMATED].value * 12
    );
    expect(pack.metrics[KPI_CODES.ENGAGEMENT_DAU].value).toBeNull();
    expect(pack.metrics[KPI_CODES.PRODUCT_ADOPTION].status).toBe(
      METRIC_STATUS.NOT_SUPPORTED
    );
    expect(pack.metrics[KPI_CODES.CRM_PIPELINE].value).toBeNull();
    const blob = JSON.stringify(pack);
    expect(blob).not.toMatch(/\bSale\b/);
    expect(blob).not.toMatch(/tenantActivity/);
    for (const m of Object.values(pack.metrics)) {
      expect(assertNoFalseZero(m)).toBe(true);
    }
  });

  it('masks finance metrics when only dashboard.view is granted', async () => {
    const pack = await buildExecutiveKpiPack(makePrisma(), {
      admin: {
        id: 'a2',
        role: 'Platform Support',
        permissions: {
          systemAdmin: {
            dashboard: { view: true },
          },
        },
      },
    });

    expect(pack.ok).toBe(true);
    const mrr = pack.metrics[KPI_CODES.MRR_ESTIMATED];
    expect(mrr.status).not.toBe(METRIC_STATUS.FORBIDDEN);
    expect(mrr.masked).toBe(true);
    expect(pack.authz.masked).toBe(true);
  });

  it('forbids finance when neither finance nor dashboard.view', async () => {
    const pack = await buildExecutiveKpiPack(makePrisma(), {
      admin: {
        id: 'a3',
        role: 'Platform Support',
        permissions: {
          systemAdmin: {
            intel: { 'executive.read': true },
          },
        },
      },
    });

    expect(pack.ok).toBe(true);
    expect(pack.metrics[KPI_CODES.MRR_ESTIMATED].status).toBe(METRIC_STATUS.FORBIDDEN);
    expect(pack.metrics[KPI_CODES.MRR_ESTIMATED].value).toBeNull();
  });

  it('marks SaaS metrics unavailable (not zero) when billing query fails', async () => {
    const prisma = makePrisma({
      accountSubscription: {
        findMany: vi.fn(async () => {
          throw new Error('db down');
        }),
        count: vi.fn(async () => 0),
      },
    });
    const pack = await buildExecutiveKpiPack(prisma, {
      admin: { id: 'a1', role: 'Super Admin', permissions: {} },
    });
    expect(pack.metrics[KPI_CODES.MRR_ESTIMATED].status).toBe(METRIC_STATUS.UNAVAILABLE);
    expect(pack.metrics[KPI_CODES.MRR_ESTIMATED].value).toBeNull();
    expect(assertNoFalseZero(pack.metrics[KPI_CODES.MRR_ESTIMATED])).toBe(true);
  });

  it('filters pack by section', async () => {
    const pack = await buildExecutiveKpiPack(makePrisma(), {
      admin: { id: 'a1', role: 'Super Admin', permissions: {} },
    });
    const filtered = filterPackBySection(pack, 'financial');
    expect(Object.keys(filtered.metrics)).toEqual(
      expect.arrayContaining([KPI_CODES.MRR_ESTIMATED, KPI_CODES.ARR_ESTIMATED])
    );
    expect(filtered.metrics[KPI_CODES.TENANTS_TOTAL]).toBeUndefined();
  });
});
