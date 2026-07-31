import { describe, it, expect, vi } from 'vitest';

import {

  recordOrLoadFirstValue,

  evaluateRepeatValue,

  evaluateActivation,

  evaluateAdoptionState,

  FIRST_VALUE_RULE_VERSION,

  ADOPTION_STATE,

  ADOPTION_RULE_VERSION,

  ACTIVATION_RULE_VERSION,

  consumeProductUsageFacts,

  PRODUCT_VALUE_EVENT_TYPES,

} from '@/lib/admin/productAnalytics';

import { ANALYTICS_EVENT_TYPES } from '@/lib/admin/analytics';



function makeProductDb({

  facts = [],

  firstValues = [],

  adoptionHistory = [],

  entitlement = null,

  checkpoints = new Map(),

  events = [],

} = {}) {

  return {

    facts,

    firstValues,

    adoptionHistory,

    entitlement,

    events,

    analyticsEvent: {

      findUnique: vi.fn(async ({ where }) => {

        if (where.id) return events.find((e) => e.id === where.id) || null;

        if (where.idempotencyKey) {

          return events.find((e) => e.idempotencyKey === where.idempotencyKey) || null;

        }

        return null;

      }),

    },

    analyticsFactProductUsage: {

      create: vi.fn(async ({ data }) => {

        if (facts.some((f) => f.idempotencyKey === data.idempotencyKey)) {

          const err = new Error('unique');

          err.code = 'P2002';

          throw err;

        }

        const row = { id: `pf-${facts.length + 1}`, ...data };

        facts.push(row);

        return row;

      }),

      findFirst: vi.fn(async ({ where = {} } = {}) => {

        let rows = [...facts];

        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);

        if (where.featureCode) rows = rows.filter((r) => r.featureCode === where.featureCode);

        if (where.eventType) rows = rows.filter((r) => r.eventType === where.eventType);

        if (where.sourceId) rows = rows.filter((r) => r.sourceId === where.sourceId);

        if (where.idempotencyKey) {

          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);

        }

        return rows[0] || null;

      }),

      findMany: vi.fn(async ({ where = {}, orderBy } = {}) => {

        let rows = [...facts];

        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);

        if (where.featureCode) rows = rows.filter((r) => r.featureCode === where.featureCode);

        if (where.eventType) rows = rows.filter((r) => r.eventType === where.eventType);

        if (orderBy?.occurredAt === 'asc') {

          rows.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));

        }

        return rows;

      }),

      count: vi.fn(async ({ where = {} } = {}) => {

        let rows = [...facts];

        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);

        if (where.featureCode) rows = rows.filter((r) => r.featureCode === where.featureCode);

        if (where.sourceId?.not) {

          rows = rows.filter((r) => r.sourceId !== where.sourceId.not);

        }

        return rows.length;

      }),

    },

    productFirstValueFact: {

      findUnique: vi.fn(async ({ where }) => {

        if (where.tenantId_featureCode_ruleVersion) {

          const { tenantId, featureCode, ruleVersion } =

            where.tenantId_featureCode_ruleVersion;

          return (

            firstValues.find(

              (r) =>

                r.tenantId === tenantId &&

                r.featureCode === featureCode &&

                r.ruleVersion === ruleVersion

            ) || null

          );

        }

        if (where.idempotencyKey) {

          return firstValues.find((r) => r.idempotencyKey === where.idempotencyKey) || null;

        }

        return null;

      }),

      create: vi.fn(async ({ data }) => {

        const clash = firstValues.find(

          (r) =>

            r.tenantId === data.tenantId &&

            r.featureCode === data.featureCode &&

            r.ruleVersion === data.ruleVersion

        );

        if (clash) {

          const err = new Error('unique');

          err.code = 'P2002';

          throw err;

        }

        const row = { id: `fv-${firstValues.length + 1}`, ...data };

        firstValues.push(row);

        return row;

      }),

    },

    productAdoptionStateHistory: {

      findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {

        let rows = [...adoptionHistory];

        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);

        if (where.featureCode) rows = rows.filter((r) => r.featureCode === where.featureCode);

        if (orderBy?.observedAt === 'desc' || orderBy?.createdAt === 'desc') {

          rows.sort(

            (a, b) =>

              new Date(b.observedAt || b.createdAt) - new Date(a.observedAt || a.createdAt)

          );

        }

        return rows[0] || null;

      }),

      findMany: vi.fn(async ({ where = {} } = {}) => {

        let rows = [...adoptionHistory];

        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);

        if (where.featureCode) rows = rows.filter((r) => r.featureCode === where.featureCode);

        return rows;

      }),

      create: vi.fn(async ({ data }) => {

        const row = {

          id: `ah-${adoptionHistory.length + 1}`,

          observedAt: data.observedAt || new Date(),

          createdAt: new Date(),

          ...data,

        };

        adoptionHistory.push(row);

        return row;

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

    platformFeatureEntitlement: {

      findUnique: vi.fn(async () => entitlement),

    },

    accountSubscription: {

      findFirst: vi.fn(async () => null),

    },

    mraEisTenantEntitlement: {

      findFirst: vi.fn(async () => null),

    },

  };

}



describe('product usage fact consumer', () => {

  it('consumes commerce value events into product usage facts once', async () => {

    const db = makeProductDb();

    const event = {

      id: 'e1',

      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

      tenantId: 't1',

      sourceType: 'Invoice',

      sourceId: 'inv-1',

      idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv-1',

      occurredAt: new Date('2026-07-29T10:00:00Z'),

      payload: { featureCode: 'invoices.post' },

    };

    const first = await consumeProductUsageFacts(db, event);

    const second = await consumeProductUsageFacts(db, event);

    expect(first.created).toBe(true);

    expect(second.skipped).toBe(true);

    expect(db.facts).toHaveLength(1);

    expect(db.facts[0]).toMatchObject({

      tenantId: 't1',

      featureCode: 'invoices.post',

      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

      sourceId: 'inv-1',

    });

    expect(PRODUCT_VALUE_EVENT_TYPES.has(ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED)).toBe(true);

    // Live pipeline advances first value from the fact/event plane

    expect(first.firstValue?.ok).toBe(true);

    expect(first.firstValue?.created).toBe(true);

    expect(db.firstValues).toHaveLength(1);

    expect(db.firstValues[0].sourceId).toBe('inv-1');

  });



  it('skips login / page-view style events', async () => {

    const db = makeProductDb();

    const r = await consumeProductUsageFacts(db, {

      id: 'e2',

      eventType: ANALYTICS_EVENT_TYPES.USER_LOGIN,

      tenantId: 't1',

      sourceType: 'User',

      sourceId: 'u1',

      idempotencyKey: 'evt:USER_LOGIN:u1',

      occurredAt: new Date(),

      payload: {},

    });

    expect(r.skipped).toBe(true);

    expect(db.facts).toHaveLength(0);

    expect(db.firstValues).toHaveLength(0);

  });

});



describe('first value', () => {

  it('is unique per tenant + feature + ruleVersion', async () => {

    const db = makeProductDb({

      facts: [

        {

          id: 'pf1',

          tenantId: 't1',

          featureCode: 'invoices.post',

          eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

          sourceType: 'Invoice',

          sourceId: 'inv-1',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

          idempotencyKey: 'fact-prod:evt:SALES_INVOICE_POSTED:inv-1',

        },

        {

          id: 'pf2',

          tenantId: 't1',

          featureCode: 'invoices.post',

          eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

          sourceType: 'Invoice',

          sourceId: 'inv-2',

          occurredAt: new Date('2026-07-29T11:00:00Z'),

          idempotencyKey: 'fact-prod:evt:SALES_INVOICE_POSTED:inv-2',

        },

      ],

    });

    const sourceEvent = {

      id: 'ev-a',

      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

      tenantId: 't1',

      sourceType: 'Invoice',

      sourceId: 'inv-1',

      occurredAt: new Date('2026-07-29T10:00:00Z'),

      payload: { featureCode: 'invoices.post' },

      idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv-1',

    };

    const first = await recordOrLoadFirstValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      sourceEvent,

    });

    const second = await recordOrLoadFirstValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      sourceEvent: {

        ...sourceEvent,

        id: 'ev-b',

        sourceId: 'inv-2',

        occurredAt: new Date('2026-07-29T11:00:00Z'),

        idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv-2',

      },

    });

    expect(first.ok).toBe(true);

    expect(first.created).toBe(true);

    expect(first.fact.ruleVersion).toBe(FIRST_VALUE_RULE_VERSION);

    expect(second.ok).toBe(true);

    expect(second.created).toBe(false);

    expect(second.fact.sourceId).toBe('inv-1');

    expect(db.firstValues).toHaveLength(1);

  });



  it('rejects uninstrumented features and non-value sources', async () => {

    const db = makeProductDb();

    const uninstrumented = await recordOrLoadFirstValue(db, {

      tenantId: 't1',

      featureCode: 'payroll.run',

      sourceEvent: {

        id: 'ev-p',

        eventType: 'PAYROLL_RUN',

        tenantId: 't1',

        sourceType: 'Payroll',

        sourceId: 'pr1',

        occurredAt: new Date(),

      },

    });

    expect(uninstrumented.ok).toBe(false);

    expect(uninstrumented.reason || uninstrumented.state).toMatch(/NOT_INSTRUMENTED|instrument/i);



    const login = await recordOrLoadFirstValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      sourceEvent: {

        id: 'ev-l',

        eventType: ANALYTICS_EVENT_TYPES.USER_LOGIN,

        tenantId: 't1',

        sourceType: 'User',

        sourceId: 'u1',

        occurredAt: new Date(),

      },

    });

    expect(login.ok).toBe(false);

    expect(db.firstValues).toHaveLength(0);

  });



  it('rejects synthetic sourceEvent without AnalyticsEvent or usage fact evidence', async () => {

    const db = makeProductDb();

    const r = await recordOrLoadFirstValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      sourceEvent: {

        id: 'forged-ev',

        eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

        tenantId: 't1',

        sourceType: 'Invoice',

        sourceId: 'forged-inv',

        occurredAt: new Date('2026-07-29T10:00:00Z'),

        idempotencyKey: 'evt:SALES_INVOICE_POSTED:forged-inv',

      },

    });

    expect(r.ok).toBe(false);

    expect(r.reason).toBe('unverified_source');

    expect(db.firstValues).toHaveLength(0);

  });

});



describe('repeat value', () => {

  it('requires a distinct source from first value', async () => {

    const db = makeProductDb({

      firstValues: [

        {

          id: 'fv1',

          tenantId: 't1',

          featureCode: 'invoices.post',

          ruleVersion: FIRST_VALUE_RULE_VERSION,

          sourceId: 'inv-1',

          eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

          sourceType: 'Invoice',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

        },

      ],

      facts: [

        {

          id: 'pf1',

          tenantId: 't1',

          featureCode: 'invoices.post',

          eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

          sourceType: 'Invoice',

          sourceId: 'inv-1',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

          idempotencyKey: 'fact-prod:evt:SALES_INVOICE_POSTED:inv-1',

        },

      ],

    });



    const sameOnly = await evaluateRepeatValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

    });

    expect(sameOnly.achieved).toBe(false);

    expect(sameOnly.reasonCode).toMatch(/distinct|insufficient/i);



    db.facts.push({

      id: 'pf2',

      tenantId: 't1',

      featureCode: 'invoices.post',

      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

      sourceType: 'Invoice',

      sourceId: 'inv-2',

      occurredAt: new Date('2026-07-29T12:00:00Z'),

      idempotencyKey: 'fact-prod:evt:SALES_INVOICE_POSTED:inv-2',

    });



    const withDistinct = await evaluateRepeatValue(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

    });

    expect(withDistinct.achieved).toBe(true);

    expect(withDistinct.distinctSourceCount).toBeGreaterThanOrEqual(2);

  });

});



describe('activation', () => {

  it('does not treat entitlement or login as product activation', async () => {

    const db = makeProductDb({

      entitlement: {

        tenantId: 't1',

        featureCode: 'invoices.post',

        status: 'ACTIVE',

        startDate: null,

        endDate: null,

      },

    });

    const r = await evaluateActivation(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      level: 'feature',

    });

    expect(r.activated).toBe(false);

    expect(r.ruleVersion).toBe(ACTIVATION_RULE_VERSION);

    expect(r.reasonCode).not.toBe('entitlement_alone');

  });



  it('activates feature only after first value', async () => {

    const db = makeProductDb({

      firstValues: [

        {

          id: 'fv1',

          tenantId: 't1',

          featureCode: 'sales.pos.complete',

          ruleVersion: FIRST_VALUE_RULE_VERSION,

          sourceId: 'sale-1',

          eventType: ANALYTICS_EVENT_TYPES.POS_TRANSACTION_COMPLETED,

          sourceType: 'Sale',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

        },

      ],

      entitlement: {

        tenantId: 't1',

        featureCode: 'sales.pos.complete',

        status: 'ACTIVE',

        startDate: null,

        endDate: null,

      },

    });

    const r = await evaluateActivation(db, {

      tenantId: 't1',

      featureCode: 'sales.pos.complete',

      level: 'feature',

    });

    expect(r.activated).toBe(true);

    expect(r.level).toBe('feature');

  });

});



describe('adoption state', () => {

  it('returns NOT_INSTRUMENTED for uninstrumented features', async () => {

    const db = makeProductDb();

    const r = await evaluateAdoptionState(db, {

      tenantId: 't1',

      featureCode: 'payroll.run',

    });

    expect(r.state).toBe(ADOPTION_STATE.NOT_INSTRUMENTED);

    expect(r.state).not.toBe(ADOPTION_STATE.CONSISTENTLY_ACTIVE);

  });



  it('does not treat entitlement as first value / consistently active', async () => {

    const db = makeProductDb({

      entitlement: {

        tenantId: 't1',

        featureCode: 'invoices.post',

        status: 'ACTIVE',

        startDate: null,

        endDate: null,

        reason: 'plan includes invoices',

      },

    });

    const r = await evaluateAdoptionState(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

    });

    expect(r.state).not.toBe(ADOPTION_STATE.FIRST_VALUE_ACHIEVED);

    expect(r.state).not.toBe(ADOPTION_STATE.CONSISTENTLY_ACTIVE);

    expect(r.state).not.toBe(ADOPTION_STATE.REPEAT_VALUE_ACHIEVED);

    expect([

      ADOPTION_STATE.NOT_ENTITLED,

      ADOPTION_STATE.ENTITLED_NOT_AVAILABLE,

      ADOPTION_STATE.AVAILABLE_NOT_DISCOVERED,

      ADOPTION_STATE.DISCOVERED_NOT_CONFIGURED,

      ADOPTION_STATE.UNKNOWN,

    ]).toContain(r.state);

    expect(r.ruleVersion).toBe(ADOPTION_RULE_VERSION);

  });



  it('advances to FIRST_VALUE_ACHIEVED from first-value fact and appends history', async () => {

    const db = makeProductDb({

      entitlement: {

        tenantId: 't1',

        featureCode: 'eis.fiscal.accept',

        status: 'ACTIVE',

        startDate: null,

        endDate: null,

      },

      firstValues: [

        {

          id: 'fv1',

          tenantId: 't1',

          featureCode: 'eis.fiscal.accept',

          ruleVersion: FIRST_VALUE_RULE_VERSION,

          sourceId: 'tx-1',

          eventType: ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED,

          sourceType: 'MraEisTransmission',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

        },

      ],

      facts: [

        {

          id: 'pf1',

          tenantId: 't1',

          featureCode: 'eis.fiscal.accept',

          eventType: ANALYTICS_EVENT_TYPES.MRA_EIS_TRANSACTION_ACCEPTED,

          sourceType: 'MraEisTransmission',

          sourceId: 'tx-1',

          occurredAt: new Date('2026-07-29T10:00:00Z'),

          idempotencyKey: 'fact-prod:evt:MRA_EIS_TRANSACTION_ACCEPTED:tx-1',

        },

      ],

    });



    const r = await evaluateAdoptionState(db, {

      tenantId: 't1',

      featureCode: 'eis.fiscal.accept',

      persist: true,

    });

    expect(r.state).toBe(ADOPTION_STATE.FIRST_VALUE_ACHIEVED);

    expect(db.adoptionHistory.length).toBeGreaterThanOrEqual(1);

    expect(db.adoptionHistory[0].state).toBe(ADOPTION_STATE.FIRST_VALUE_ACHIEVED);



    // Re-evaluate must not silent-overwrite; append only on change

    const again = await evaluateAdoptionState(db, {

      tenantId: 't1',

      featureCode: 'eis.fiscal.accept',

      persist: true,

    });

    expect(again.state).toBe(ADOPTION_STATE.FIRST_VALUE_ACHIEVED);

    expect(db.adoptionHistory).toHaveLength(1);

  });



  it('E2E: consume commerce event → first value created → adoption advances (no pre-seeded firstValues)', async () => {

    const db = makeProductDb({

      entitlement: {

        tenantId: 't1',

        featureCode: 'invoices.post',

        status: 'ACTIVE',

        startDate: null,

        endDate: null,

      },

      // No firstValues seeded — live consumer must establish them

    });



    const event = {

      id: 'e-live-1',

      eventType: ANALYTICS_EVENT_TYPES.SALES_INVOICE_POSTED,

      tenantId: 't1',

      sourceType: 'Invoice',

      sourceId: 'inv-live-1',

      idempotencyKey: 'evt:SALES_INVOICE_POSTED:inv-live-1',

      occurredAt: new Date('2026-07-29T10:00:00Z'),

      payload: { featureCode: 'invoices.post' },

    };



    expect(db.firstValues).toHaveLength(0);



    const consumed = await consumeProductUsageFacts(db, event);

    expect(consumed.ok).toBe(true);

    expect(consumed.created).toBe(true);

    expect(db.facts).toHaveLength(1);

    expect(consumed.firstValue?.ok).toBe(true);

    expect(consumed.firstValue?.created).toBe(true);

    expect(db.firstValues).toHaveLength(1);

    expect(db.firstValues[0]).toMatchObject({

      tenantId: 't1',

      featureCode: 'invoices.post',

      sourceId: 'inv-live-1',

      ruleVersion: FIRST_VALUE_RULE_VERSION,

    });



    const adoption = await evaluateAdoptionState(db, {

      tenantId: 't1',

      featureCode: 'invoices.post',

      persist: true,

    });

    expect(adoption.state).toBe(ADOPTION_STATE.FIRST_VALUE_ACHIEVED);

    expect(adoption.historyAppended).toBe(true);

  });

});


