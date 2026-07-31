import { describe, it, expect, vi } from 'vitest';

import {

  reconstructMrrHistory,

  subscriptionCoversDay,

  persistMrrSnapshots,

  readMrrSnapshot,

  mrrMetricKeys,

  summarizeActiveMrr,

} from '@/lib/admin/revenue';



describe('subscriptionCoversDay', () => {

  it('includes rows when start ≤ day < expiresAt', () => {

    const row = {

      startedAt: new Date('2026-07-01T10:00:00.000Z'),

      expiresAt: new Date('2026-08-01T00:00:00.000Z'),

    };

    expect(subscriptionCoversDay(row, new Date('2026-07-15T00:00:00.000Z'))).toBe(true);

    expect(subscriptionCoversDay(row, new Date('2026-08-01T00:00:00.000Z'))).toBe(false);

    expect(subscriptionCoversDay(row, new Date('2026-06-30T00:00:00.000Z'))).toBe(false);

  });



  it('falls back to paymentDate when startedAt missing', () => {

    const row = {

      startedAt: null,

      paymentDate: new Date('2026-07-01T00:00:00.000Z'),

      expiresAt: new Date('2026-08-01T00:00:00.000Z'),

    };

    expect(subscriptionCoversDay(row, new Date('2026-07-10T00:00:00.000Z'))).toBe(true);

  });

});



describe('summarizeActiveMrr', () => {

  it('splits CORE and MRA EIS per currency', () => {

    const summary = summarizeActiveMrr(

      [

        {

          id: '1',

          tenantId: 't1',

          plan: '1month',

          amount: 1000,

          currency: 'MWK',

        },

        {

          id: '2',

          tenantId: 't1',

          plan: 'eis-monthly',

          amount: 400,

          currency: 'MWK',

        },

        {

          id: '3',

          tenantId: 't2',

          plan: '1month',

          amount: 999,

          currency: 'USD',

        },

      ],

      'MWK'

    );

    expect(summary.total).toBe(1400);

    expect(summary.core).toBe(1000);

    expect(summary.mraEis).toBe(400);

    expect(summary.tenantIds.size).toBe(1);

  });

});



describe('reconstructMrrHistory', () => {

  it('returns UNAVAILABLE without currency (no false zeroes)', async () => {

    const result = await reconstructMrrHistory(

      { accountSubscription: { findMany: vi.fn() } },

      { from: '2026-07-01', to: '2026-07-03', currency: 'ALL' }

    );

    expect(result.confidence).toBe('UNAVAILABLE');

    expect(result.days).toEqual([]);

    expect(result.gaps.length).toBeGreaterThan(0);

  });



  it('historical query does not require isActive (churned rows may cover past days)', async () => {

    const findMany = vi.fn(async () => []);

    await reconstructMrrHistory(

      { accountSubscription: { findMany } },

      {

        from: new Date('2026-07-01T00:00:00.000Z'),

        to: new Date('2026-07-02T00:00:00.000Z'),

        currency: 'MWK',

      }

    );

    expect(findMany).toHaveBeenCalled();

    const where = findMany.mock.calls[0][0].where;

    expect(where.isActive).toBeUndefined();

    expect(where.isTrial).toBe(false);

    expect(where.status?.notIn).toEqual(

      expect.arrayContaining(['cancelled', 'Expired', 'pending'])

    );

  });



  it('includes churned (isActive:false) subscriptions that covered day D', async () => {

    const rows = [

      {

        id: 'churned-1',

        tenantId: 't1',

        plan: '1month',

        amount: 1500,

        currency: 'MWK',

        status: 'Completed',

        isActive: false,

        isTrial: false,

        startedAt: new Date('2026-07-01T00:00:00.000Z'),

        paymentDate: new Date('2026-07-01T00:00:00.000Z'),

        createdAt: new Date('2026-07-01T00:00:00.000Z'),

        expiresAt: new Date('2026-08-01T00:00:00.000Z'),

      },

    ];



    const result = await reconstructMrrHistory(

      { accountSubscription: { findMany: vi.fn(async () => rows) } },

      {

        from: new Date('2026-07-15T00:00:00.000Z'),

        to: new Date('2026-07-15T00:00:00.000Z'),

        currency: 'MWK',

      }

    );



    expect(result.days).toHaveLength(1);

    expect(result.days[0].total).toBe(1500);

    expect(result.days[0].bySubscription['churned-1']).toBeTruthy();

    expect(result.days[0].confidence).toBe('HIGH');

  });



  it('reconstructs daily totals and marks low confidence when startedAt missing', async () => {

    const rows = [

      {

        id: 's1',

        tenantId: 't1',

        plan: '1month',

        amount: 1200,

        currency: 'MWK',

        status: 'Completed',

        isActive: true,

        isTrial: false,

        startedAt: null,

        paymentDate: new Date('2026-07-01T00:00:00.000Z'),

        createdAt: new Date('2026-07-01T00:00:00.000Z'),

        expiresAt: new Date('2026-08-01T00:00:00.000Z'),

      },

      {

        id: 's2',

        tenantId: 't2',

        plan: 'eis-monthly',

        amount: 600,

        currency: 'MWK',

        status: 'Completed',

        isActive: true,

        isTrial: false,

        startedAt: new Date('2026-07-01T00:00:00.000Z'),

        paymentDate: new Date('2026-07-01T00:00:00.000Z'),

        createdAt: new Date('2026-07-01T00:00:00.000Z'),

        expiresAt: new Date('2026-08-01T00:00:00.000Z'),

      },

    ];



    const prisma = {

      accountSubscription: {

        findMany: vi.fn(async () => rows),

      },

    };



    const result = await reconstructMrrHistory(prisma, {

      from: new Date('2026-07-01T00:00:00.000Z'),

      to: new Date('2026-07-02T00:00:00.000Z'),

      currency: 'MWK',

    });



    expect(result.days).toHaveLength(2);

    expect(result.days[0].total).toBe(1800);

    expect(result.days[0].core).toBe(1200);

    expect(result.days[0].mraEis).toBe(600);

    expect(result.days[0].confidence).toBe('LOW_CONFIDENCE');

    expect(result.confidence).toMatch(/LOW_CONFIDENCE|MIXED/);

  });



  it('persists snapshot keys mrr_estimated_*_<CCY>', async () => {

    const upsert = vi.fn(async () => ({}));

    const prisma = {

      analyticsDailySnapshot: {

        upsert,

        findUnique: vi.fn(async () => null),

      },

    };

    const keys = mrrMetricKeys('MWK');

    const result = await persistMrrSnapshots(prisma, {

      currency: 'MWK',

      days: [

        {

          date: '2026-07-01',

          snapshotDate: new Date('2026-07-01T00:00:00.000Z'),

          currency: 'MWK',

          total: 100,

          core: 80,

          mraEis: 20,

          confidence: 'HIGH',

          bySubscription: { a: { mrr: 100, category: 'CORE' } },

        },

      ],

    });



    expect(result.written).toBe(3);

    const metricKeys = upsert.mock.calls.map(

      (c) => c[0].create.metricKey || c[0].where.snapshotDate_metricKey_tenantId.metricKey

    );

    expect(metricKeys).toEqual(

      expect.arrayContaining([keys.total, keys.core, keys.mraEis])

    );

  });



  it('does not overwrite HIGH/OK confidence with LOW_CONFIDENCE unless force:true', async () => {

    const upsert = vi.fn(async () => ({}));

    const findUnique = vi.fn(async () => ({

      valueNumeric: 100,

      valueJson: { confidence: 'HIGH', total: 100 },

    }));

    const prisma = {

      analyticsDailySnapshot: { upsert, findUnique },

    };



    const skipped = await persistMrrSnapshots(prisma, {

      currency: 'MWK',

      days: [

        {

          date: '2026-07-01',

          snapshotDate: new Date('2026-07-01T00:00:00.000Z'),

          currency: 'MWK',

          total: 50,

          core: 40,

          mraEis: 10,

          confidence: 'LOW_CONFIDENCE',

          bySubscription: {},

        },

      ],

    });

    expect(skipped.written).toBe(0);

    expect(skipped.skipped).toBe(3);

    expect(upsert).not.toHaveBeenCalled();



    const forced = await persistMrrSnapshots(

      prisma,

      {

        currency: 'MWK',

        days: [

          {

            date: '2026-07-01',

            snapshotDate: new Date('2026-07-01T00:00:00.000Z'),

            currency: 'MWK',

            total: 50,

            core: 40,

            mraEis: 10,

            confidence: 'LOW_CONFIDENCE',

            bySubscription: {},

          },

        ],

      },

      { force: true }

    );

    expect(forced.written).toBe(3);

    expect(upsert).toHaveBeenCalled();

  });



  it('incomplete snapshot valueJson+null numeric returns null (not 0)', async () => {

    const prisma = {

      analyticsDailySnapshot: {

        findUnique: vi.fn(async () => ({

          valueNumeric: null,

          valueJson: { confidence: 'HIGH' },

        })),

      },

    };

    const snap = await readMrrSnapshot(prisma, {

      date: new Date('2026-07-01T00:00:00.000Z'),

      currency: 'MWK',

    });

    expect(snap).toBeNull();

  });



  it('missing confidence defaults to UNKNOWN (not HIGH)', async () => {

    const prisma = {

      analyticsDailySnapshot: {

        findUnique: vi.fn(async () => ({

          valueNumeric: 100,

          valueJson: { total: 100, core: 80, mraEis: 20 },

        })),

      },

    };

    const snap = await readMrrSnapshot(prisma, {

      date: new Date('2026-07-01T00:00:00.000Z'),

      currency: 'MWK',

    });

    expect(snap).not.toBeNull();

    expect(snap.confidence).toBe('UNKNOWN');

  });

});



describe('canPostRevenueReconciliation', () => {

  it('requires revenue read AND health.view (Super Admin break-glass ok)', async () => {

    const { canPostRevenueReconciliation } = await import(

      '@/app/api/admin/intelligence/revenue/reconciliation/route.js'

    );



    expect(

      canPostRevenueReconciliation({

        id: 'a1',

        role: 'Billing Administrator',

        permissions: {

          systemAdmin: {

            dashboard: { view: true },

          },

        },

      })

    ).toBe(false);



    expect(

      canPostRevenueReconciliation({

        id: 'a2',

        role: 'Billing Administrator',

        permissions: {

          systemAdmin: {

            health: { view: true },

          },

        },

      })

    ).toBe(false);



    expect(

      canPostRevenueReconciliation({

        id: 'a3',

        role: 'Billing Administrator',

        permissions: {

          systemAdmin: {

            intel: { 'revenue.read': true },

            health: { view: true },

          },

        },

      })

    ).toBe(true);



    expect(

      canPostRevenueReconciliation({

        id: 'a4',

        role: 'Super Admin',

        permissions: {},

      })

    ).toBe(true);

  });

});


