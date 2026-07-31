import { describe, it, expect, vi } from 'vitest';

import {

  buildRevenueKpiPack,

  assertNoFalseZero,

  REVENUE_KPI_CODES,

  METRIC_STATUS,

  buildMrrBridge,

  mrrMetricKeys,

  readMrrSnapshot,

} from '@/lib/admin/revenue';

import { unavailableMetric } from '@/lib/admin/intelligence/metricStates';



function makePrisma(overrides = {}) {

  const coreSub = {

    id: 's-core',

    tenantId: 't1',

    plan: '1month',

    amount: 12000,

    currency: 'MWK',

    status: 'Completed',

  };

  const eisSub = {

    id: 's-eis',

    tenantId: 't1',

    plan: 'eis-monthly',

    amount: 5000,

    currency: 'MWK',

    status: 'Completed',

  };

  return {

    accountSubscription: {

      findMany: vi.fn(async () => [coreSub, eisSub]),

      count: vi.fn(async () => 0),

    },

    platformPayment: {

      aggregate: vi.fn(async () => ({ _sum: { amount: 5000 } })),

    },

    platformCredit: {

      count: vi.fn(async () => 0),

    },

    analyticsDailySnapshot: {

      findUnique: vi.fn(async () => null),

      upsert: vi.fn(async () => ({})),

    },

    ...overrides,

  };

}



describe('revenue metric envelopes', () => {

  it('unavailable metrics never expose zero values', () => {

    const m = unavailableMetric(REVENUE_KPI_CODES.MRR_CROSS_CURRENCY, 'no fx');

    expect(m.value).toBeNull();

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



describe('buildRevenueKpiPack', () => {

  it('returns forbidden when admin lacks view permissions', async () => {

    const pack = await buildRevenueKpiPack(makePrisma(), {

      admin: {

        id: 'a1',

        role: 'Platform Support',

        permissions: {},

      },

    });

    expect(pack.forbidden).toBe(true);

  });



  it('builds CORE/EIS split without Tenant Sale and no false zeroes', async () => {

    const prisma = makePrisma();

    const pack = await buildRevenueKpiPack(prisma, {

      admin: { id: 'a1', role: 'Super Admin', permissions: {} },

      currency: 'MWK',

    });



    expect(pack.ok).toBe(true);

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL].status).toBe(

      METRIC_STATUS.READY_WITH_LIMITATIONS

    );

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL].value).toBe(17000);

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_CORE].value).toBe(12000);

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS].value).toBe(5000);

    expect(pack.metrics[REVENUE_KPI_CODES.ARR_ESTIMATED].value).toBe(17000 * 12);

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_CROSS_CURRENCY].status).toBe(

      METRIC_STATUS.UNAVAILABLE

    );

    expect(pack.metrics[REVENUE_KPI_CODES.MRR_CROSS_CURRENCY].value).toBeNull();



    const blob = JSON.stringify(pack);

    expect(blob).not.toMatch(/\bSale\b/);

    expect(blob).not.toMatch(/tenantActivity/);

    for (const m of Object.values(pack.metrics)) {

      expect(assertNoFalseZero(m)).toBe(true);

    }

  });



  it('marks bridge UNAVAILABLE when snapshots missing (not zero)', async () => {

    const pack = await buildRevenueKpiPack(makePrisma(), {

      admin: { id: 'a1', role: 'Super Admin', permissions: {} },

      currency: 'MWK',

    });



    expect(pack.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].status).toBe(

      METRIC_STATUS.UNAVAILABLE

    );

    expect(pack.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].value).toBeNull();

    expect(pack.metrics[REVENUE_KPI_CODES.BRIDGE_NEW].value).toBeNull();

    expect(pack.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].reasonCode).toBe(

      'snapshots_missing'

    );

  });



  it('currency=ALL marks MRR/ARR/payments/bridge UNAVAILABLE (no MWK false totals)', async () => {

    const prisma = makePrisma();

    const pack = await buildRevenueKpiPack(prisma, {

      admin: { id: 'a1', role: 'Super Admin', permissions: {} },

      currency: 'ALL',

    });



    expect(pack.ok).toBe(true);

    expect(pack.currency).toBe('ALL');



    for (const code of [

      REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

      REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

      REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

      REVENUE_KPI_CODES.ARR_ESTIMATED,

      REVENUE_KPI_CODES.PAYMENTS_PERIOD,

      REVENUE_KPI_CODES.BRIDGE_OPENING,

      REVENUE_KPI_CODES.BRIDGE_CLOSING,

      REVENUE_KPI_CODES.BRIDGE_NEW,

      REVENUE_KPI_CODES.BRIDGE_NET_NEW,

    ]) {

      expect(pack.metrics[code].status).toBe(METRIC_STATUS.UNAVAILABLE);

      expect(pack.metrics[code].value).toBeNull();

      expect(pack.metrics[code].reasonCode).toBe('fx_unavailable');

      expect(assertNoFalseZero(pack.metrics[code])).toBe(true);

    }



    // Must not invent MWK-labelled READY payments/bridge for ALL

    expect(pack.metrics[REVENUE_KPI_CODES.PAYMENTS_PERIOD].currency).not.toBe('MWK');

  });



  it('filters PlatformPayment by currency when a specific currency is requested', async () => {

    const prisma = makePrisma();

    await buildRevenueKpiPack(prisma, {

      admin: { id: 'a1', role: 'Super Admin', permissions: {} },

      currency: 'USD',

    });



    const paymentCalls = prisma.platformPayment.aggregate.mock.calls;

    expect(paymentCalls.length).toBeGreaterThan(0);

    for (const call of paymentCalls) {

      expect(call[0].where.currency).toBe('USD');

    }

  });



  it('allows intel.revenue.read alone to see money values (not FORBIDDEN)', async () => {

    const viaIntelOnly = await buildRevenueKpiPack(makePrisma(), {

      admin: {

        id: 'a2',

        role: 'Platform Support',

        permissions: {

          systemAdmin: {

            intel: { 'revenue.read': true },

          },

        },

      },

      currency: 'MWK',

    });

    expect(viaIntelOnly.ok).toBe(true);

    expect(viaIntelOnly.authz.finance).toBe(true);

    expect(viaIntelOnly.authz.masked).toBe(false);

    expect(viaIntelOnly.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL].status).not.toBe(

      METRIC_STATUS.FORBIDDEN

    );

    expect(viaIntelOnly.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL].value).toBeGreaterThan(

      0

    );

    expect(viaIntelOnly.metrics[REVENUE_KPI_CODES.PAYMENTS_PERIOD].status).not.toBe(

      METRIC_STATUS.FORBIDDEN

    );

  });



  it('keeps ALLOW_MASKED for dashboard.view-only', async () => {

    const viaDash = await buildRevenueKpiPack(makePrisma(), {

      admin: {

        id: 'a3',

        role: 'Platform Support',

        permissions: {

          systemAdmin: {

            dashboard: { view: true },

          },

        },

      },

      currency: 'MWK',

    });

    expect(viaDash.ok).toBe(true);

    expect(viaDash.metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL].masked).toBe(true);

  });



  it('exposes documented snapshot metricKeys', () => {

    const keys = mrrMetricKeys('MWK');

    expect(keys.total).toBe('mrr_estimated_total_MWK');

    expect(keys.core).toBe('mrr_estimated_core_MWK');

    expect(keys.mraEis).toBe('mrr_estimated_mra_eis_MWK');

  });

});



describe('readMrrSnapshot', () => {

  it('incomplete snapshot does not become false zero', async () => {

    const prisma = makePrisma({

      analyticsDailySnapshot: {

        findUnique: vi.fn(async () => ({

          valueNumeric: null,

          valueJson: {},

        })),

        upsert: vi.fn(async () => ({})),

      },

    });



    const snap = await readMrrSnapshot(prisma, {

      date: new Date('2026-07-01T00:00:00.000Z'),

      currency: 'MWK',

    });

    expect(snap).toBeNull();



    const bridge = await buildMrrBridge(prisma, {

      periodStart: new Date('2026-07-01T00:00:00.000Z'),

      periodEnd: new Date('2026-07-28T00:00:00.000Z'),

      currency: 'MWK',

    });

    expect(bridge.available).toBe(false);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].value).toBeNull();

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].reasonCode).toBe(

      'snapshots_missing'

    );

  });

});



describe('buildMrrBridge', () => {

  it('returns UNAVAILABLE envelopes when open/close snapshots absent', async () => {

    const prisma = makePrisma();

    const bridge = await buildMrrBridge(prisma, {

      periodStart: new Date('2026-07-01T00:00:00.000Z'),

      periodEnd: new Date('2026-07-28T00:00:00.000Z'),

      currency: 'MWK',

    });

    expect(bridge.available).toBe(false);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].value).toBeNull();

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_NET_NEW].status).toBe(

      METRIC_STATUS.UNAVAILABLE

    );

  });



  it('returns fx_unavailable for currency ALL without inventing MWK bridge', async () => {

    const bridge = await buildMrrBridge(makePrisma(), {

      periodStart: new Date('2026-07-01T00:00:00.000Z'),

      periodEnd: new Date('2026-07-28T00:00:00.000Z'),

      currency: 'ALL',

    });

    expect(bridge.available).toBe(false);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].reasonCode).toBe(

      'fx_unavailable'

    );

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].value).toBeNull();

  });



  it('classifies movements when adjacent snapshots exist', async () => {

    const openJson = {

      total: 100,

      core: 100,

      mraEis: 0,

      currency: 'MWK',

      confidence: 'HIGH',

      bySubscription: {

        a: { mrr: 100, category: 'CORE', tenantId: 't1' },

      },

    };

    const closeJson = {

      total: 150,

      core: 150,

      mraEis: 0,

      currency: 'MWK',

      confidence: 'HIGH',

      bySubscription: {

        a: { mrr: 120, category: 'CORE', tenantId: 't1' },

        b: { mrr: 30, category: 'CORE', tenantId: 't2' },

      },

    };

    const prisma = makePrisma({

      analyticsDailySnapshot: {

        findUnique: vi.fn(async ({ where }) => {

          const key = where.snapshotDate_metricKey_tenantId.metricKey;

          if (key !== 'mrr_estimated_total_MWK') return null;

          const d = where.snapshotDate_metricKey_tenantId.snapshotDate

            .toISOString()

            .slice(0, 10);

          if (d === '2026-07-01') {

            return { valueNumeric: 100, valueJson: openJson };

          }

          if (d === '2026-07-28') {

            return { valueNumeric: 150, valueJson: closeJson };

          }

          return null;

        }),

        upsert: vi.fn(async () => ({})),

      },

    });



    const bridge = await buildMrrBridge(prisma, {

      periodStart: new Date('2026-07-01T00:00:00.000Z'),

      periodEnd: new Date('2026-07-28T00:00:00.000Z'),

      currency: 'MWK',

    });



    expect(bridge.available).toBe(true);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_OPENING].value).toBe(100);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_CLOSING].value).toBe(150);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_NEW].value).toBe(30);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_NEW].limitations).toMatch(

      /possible reactivations/i

    );

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_EXPANSION].value).toBe(20);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_NET_NEW].value).toBe(50);

    expect(bridge.metrics[REVENUE_KPI_CODES.BRIDGE_REACTIVATION].status).toBe(

      METRIC_STATUS.UNAVAILABLE

    );

  });

});


