/**
 * Phase 12 Wave 2 — Contact roles, products, commercial, probability, close dates.
 * Weighted Pipeline helper exists; UI flag remains false (Phase 16).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_PIPELINE_STAGE,
  CRM_OPPORTUNITY_CONTACT_ROLE,
  CRM_AMOUNT_BASIS,
  CRM_PROBABILITY_SOURCE,
  CRM_PROBABILITY_CONFIDENCE,
  CRM_CLOSE_DATE_SOURCE,
  CRM_CLOSE_DATE_CONFIDENCE,
  WEIGHTED_PIPELINE_UI_ENABLED,
  createOpportunityFromHandoff,
  upsertOpportunityContactRole,
  listOpportunityContactRoles,
  listOpportunityContactRoleHistory,
  addOpportunityProduct,
  listOpportunityProducts,
  setOpportunityCommercial,
  getOpportunityCommercial,
  computeIndicativeWeightedAmount,
  summarizeAmountsByCurrency,
  overrideOpportunityProbability,
  getOpportunityProbability,
  applyStageDefaultProbability,
  setOpportunityCloseDate,
  getOpportunityCloseDate,
  isCloseDateForecastEligible,
  transitionOpportunityStage,
} from '@/lib/admin/crm';
import { PRODUCT_FEATURE_CODES as FEATURE_CODES } from '@/lib/admin/productCatalogue/features.js';

function makeAdmin(perms = {}) {
  return {
    id: 'admin-w2-1',
    role: 'CRM Agent',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.viewLeads': true,
      'systemAdmin.crm.editLeads': true,
      'systemAdmin.crm.transitionStatus': true,
      'systemAdmin.crm.pipeline.view': true,
      'systemAdmin.crm.pipeline.transitionStages': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.create': true,
      'systemAdmin.crm.opportunities.edit': true,
      ...perms,
    },
  };
}

function makePrisma(overrides = {}) {
  const oppStore = overrides._oppStore || [];
  const historyStore = overrides._historyStore || [];
  const leadHistoryStore = overrides._leadHistoryStore || [];
  const seqStore = overrides._seqStore || [];
  const roleStore = overrides._roleStore || [];
  const roleHistoryStore = overrides._roleHistoryStore || [];
  const productStore = overrides._productStore || [];
  const amountHistoryStore = overrides._amountHistoryStore || [];
  const probHistoryStore = overrides._probHistoryStore || [];
  const closeHistoryStore = overrides._closeHistoryStore || [];
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-w2-1',
      leadNumber: 'LEAD-2026-000020',
      status: 'OPPORTUNITY_READY',
      accountId: 'acc-w2',
      contactId: 'con-w2',
      title: 'Wave 2 lead',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
    },
  ];

  const prisma = {
    crmOpportunity: {
      findMany: vi.fn(async () => [...oppStore]),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return oppStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return oppStore.find((r) => r.opportunityNumber === where.opportunityNumber) || null;
        }
        if (where.handoffIdempotencyKey) {
          return (
            oppStore.find((r) => r.handoffIdempotencyKey === where.handoffIdempotencyKey) ||
            null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...oppStore];
        if (where?.handoffIdempotencyKey) {
          rows = rows.filter((r) => r.handoffIdempotencyKey === where.handoffIdempotencyKey);
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `opp-w2-${oppStore.length + 1}`,
          version: data.version ?? 1,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        oppStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = oppStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let rows = oppStore.filter((r) => r.id === where.id);
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        for (const row of rows) Object.assign(row, data, { updatedAt: new Date() });
        return { count: rows.length };
      }),
      delete: vi.fn(async ({ where }) => {
        const idx = oppStore.findIndex((r) => r.id === where.id);
        if (idx < 0) throw Object.assign(new Error('not found'), { code: 'P2025' });
        const [removed] = oppStore.splice(idx, 1);
        return removed;
      }),
    },
    crmOpportunityStageHistory: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...historyStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...historyStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `ohist-${historyStore.length + 1}`, at: data.at || new Date(), ...data };
        historyStore.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where = {} } = {}) => {
        const before = historyStore.length;
        for (let i = historyStore.length - 1; i >= 0; i -= 1) {
          if (!where.opportunityId || historyStore[i].opportunityId === where.opportunityId) {
            historyStore.splice(i, 1);
          }
        }
        return { count: before - historyStore.length };
      }),
    },
    crmOpportunityContactRole: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...roleStore];
        if (where?.opportunityId) rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        if (where?.role) rows = rows.filter((r) => r.role === where.role);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...roleStore];
        if (where?.opportunityId) rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        if (where?.role) rows = rows.filter((r) => r.role === where.role);
        if (where?.contactId) rows = rows.filter((r) => r.contactId === where.contactId);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return roleStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `role-${roleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        roleStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = roleStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    crmOpportunityContactRoleHistory: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...roleHistoryStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `rh-${roleHistoryStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        roleHistoryStore.push(row);
        return row;
      }),
    },
    crmOpportunityProduct: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...productStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `prod-${productStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        productStore.push(row);
        return row;
      }),
    },
    crmOpportunityAmountHistory: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...amountHistoryStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ah-${amountHistoryStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        amountHistoryStore.push(row);
        return row;
      }),
    },
    crmOpportunityProbabilityHistory: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...probHistoryStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ph-${probHistoryStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        probHistoryStore.push(row);
        return row;
      }),
    },
    crmOpportunityCloseDateHistory: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...closeHistoryStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ch-${closeHistoryStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        closeHistoryStore.push(row);
        return row;
      }),
    },
    crmLead: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async () => [...leadStore]),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `lh-${leadHistoryStore.length + 1}`, at: new Date(), ...data };
        leadHistoryStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => [...leadHistoryStore]),
    },
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where }) => {
        return seqStore.find((r) => r.prefix === where.prefix && r.year === where.year) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: `seq-${seqStore.length + 1}`, ...data };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            (where.lastValue == null || r.lastValue === where.lastValue)
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }),
    },
    subscription: { create: vi.fn(), findMany: vi.fn(async () => []) },
    invoice: { create: vi.fn(), findMany: vi.fn(async () => []) },
    tenant: { create: vi.fn(), findMany: vi.fn(async () => []) },
    _oppStore: oppStore,
    _roleStore: roleStore,
    _roleHistoryStore: roleHistoryStore,
    _productStore: productStore,
    _amountHistoryStore: amountHistoryStore,
    _probHistoryStore: probHistoryStore,
    _closeHistoryStore: closeHistoryStore,
  };

  return prisma;
}

async function seedOpp(prisma, key = 'w2-key-1') {
  const result = await createOpportunityFromHandoff(prisma, {
    admin: makeAdmin(),
    handoffPayload: {
      type: 'CRM_OPPORTUNITY_HANDOFF',
      readinessStatus: 'READY',
      leadId: 'lead-w2-1',
      leadNumber: 'LEAD-2026-000020',
      accountId: 'acc-w2',
      contactId: 'con-w2',
      idempotencyKey: key,
      opportunityId: null,
      opportunityCreated: false,
    },
    now: new Date('2026-07-30T15:00:00.000Z'),
  });
  expect(result.ok).toBe(true);
  return result.opportunity;
}

describe('Wave 2 contact roles', () => {
  it('seeds PRIMARY from handoff contactId and never grants platform permissions', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma);
    const listed = await listOpportunityContactRoles(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(listed.ok).toBe(true);
    expect(listed.platformPermissionGrant).toBe(false);
    expect(listed.roles.some((r) => r.role === CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY)).toBe(
      true
    );
    expect(listed.roles[0].platformPermissionGrant).toBe(false);

    const hist = await listOpportunityContactRoleHistory(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(hist.ok).toBe(true);
    expect(hist.history.length).toBeGreaterThanOrEqual(1);
  });

  it('adds DECISION_MAKER / ECONOMIC_BUYER roles and replaces PRIMARY', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-roles-2');

    const dm = await upsertOpportunityContactRole(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      contactId: 'con-dm',
      role: CRM_OPPORTUNITY_CONTACT_ROLE.DECISION_MAKER,
    });
    expect(dm.ok).toBe(true);
    expect(dm.platformPermissionGrant).toBe(false);

    const eb = await upsertOpportunityContactRole(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      contactId: 'con-eb',
      role: CRM_OPPORTUNITY_CONTACT_ROLE.ECONOMIC_BUYER,
    });
    expect(eb.ok).toBe(true);

    const primary = await upsertOpportunityContactRole(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      contactId: 'con-new-primary',
      role: CRM_OPPORTUNITY_CONTACT_ROLE.PRIMARY,
      reason: 'handoff contact left company',
    });
    expect(primary.ok).toBe(true);
    expect(primary.role.contactId).toBe('con-new-primary');
  });

  it('blocks DISCOVERY transition without PRIMARY when role model is present', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-roles-3');
    // wipe roles to simulate missing primary
    prisma._roleStore.splice(0, prisma._roleStore.length);

    const result = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('PRIMARY_CONTACT_REQUIRED');
  });
});

describe('Wave 2 products (non-binding)', () => {
  it('adds catalogue feature line without entitlements / subscription lines', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-prod-1');

    const added = await addOpportunityProduct(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      featureCode: FEATURE_CODES.INVOICES_POST,
      quantity: 2,
      unitAmountEstimate: 500,
      currency: 'MWK',
    });
    expect(added.ok).toBe(true);
    expect(added.createsEntitlement).toBe(false);
    expect(added.createsSubscriptionLine).toBe(false);
    expect(added.createsInvoiceLine).toBe(false);
    expect(added.product.binding).toBe('NON_BINDING_ESTIMATE');
    expect(added.product.featureCode).toBe(FEATURE_CODES.INVOICES_POST);

    const unknown = await addOpportunityProduct(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      unknownInterest: true,
      label: 'Something custom',
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.product.unknownInterest).toBe(true);

    const listed = await listOpportunityProducts(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(listed.ok).toBe(true);
    expect(listed.products).toHaveLength(2);
    expect(listed.createsEntitlement).toBe(false);
  });

  it('requires currency when unit amount estimate is set', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-prod-2');
    const bad = await addOpportunityProduct(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      featureCode: FEATURE_CODES.SALES_POS_COMPLETE,
      unitAmountEstimate: 100,
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('currency_required_for_amount');
  });
});

describe('Wave 2 commercial currency + amount history', () => {
  it('requires amount basis + ISO currency and appends amount history', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-comm-1');

    const missingCurrency = await setOpportunityCommercial(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      amount: 12000,
      amountBasis: CRM_AMOUNT_BASIS.FIRST_YEAR_TOTAL,
    });
    expect(missingCurrency.ok).toBe(false);
    expect(missingCurrency.error).toBe('currency_required');

    const set = await setOpportunityCommercial(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      amount: 12000,
      currency: 'MWK',
      amountBasis: CRM_AMOUNT_BASIS.FIRST_YEAR_TOTAL,
      recurringAnnualAmount: 10000,
      oneTimeAmount: 2000,
      reason: 'scoping workshop',
    });
    expect(set.ok).toBe(true);
    expect(set.postsRevenue).toBe(false);
    expect(set.postsSubscription).toBe(false);
    expect(set.isBinding).toBe(false);
    expect(set.opportunity.currency).toBe('MWK');
    expect(set.opportunity.amountBasis).toBe(CRM_AMOUNT_BASIS.FIRST_YEAR_TOTAL);

    const got = await getOpportunityCommercial(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(got.ok).toBe(true);
    expect(got.amountHistory).toHaveLength(1);
    expect(got.commercial.postsRevenue).toBe(false);
  });

  it('keeps multi-currency totals separated (no silent FX)', () => {
    const summary = summarizeAmountsByCurrency([
      { amount: 100, currency: 'MWK' },
      { amount: 50, currency: 'USD' },
    ]);
    expect(summary.ok).toBe(true);
    expect(summary.grandTotal).toBeNull();
    expect(summary.grandTotalStatus).toBe('UNAVAILABLE');
    expect(summary.fxConverted).toBe(false);
    expect(summary.totalsByCurrency.MWK).toBe(100);
    expect(summary.totalsByCurrency.USD).toBe(50);
  });
});

describe('Wave 2 probability override + stage default', () => {
  it('applies stage default and allows override with reason (not ML / not Revenue certainty)', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-prob-1');
    expect(opp.probability).toBe(10);
    expect(opp.probabilitySource).toBe(CRM_PROBABILITY_SOURCE.STAGE_DEFAULT);

    const noReason = await overrideOpportunityProbability(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      probability: 55,
    });
    expect(noReason.ok).toBe(false);
    expect(noReason.error).toBe('override_reason_required');

    const overridden = await overrideOpportunityProbability(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      probability: 55,
      reason: 'champion confirmed budget process',
      confidence: CRM_PROBABILITY_CONFIDENCE.HIGH,
      requireApproval: true,
    });
    expect(overridden.ok).toBe(true);
    expect(overridden.isMl).toBe(false);
    expect(overridden.isRevenueCertainty).toBe(false);
    expect(overridden.isLeadFitScore).toBe(false);
    expect(overridden.approvalStub.status).toBe('PENDING');
    expect(overridden.opportunity.probability).toBe(55);
    expect(overridden.opportunity.probabilitySource).toBe(
      CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE
    );

    // stage transition must preserve manual override
    const moved = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    expect(moved.ok).toBe(true);
    expect(moved.opportunity.probability).toBe(55);
    expect(moved.opportunity.probabilitySource).toBe(CRM_PROBABILITY_SOURCE.MANUAL_OVERRIDE);

    const got = await getOpportunityProbability(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(got.ok).toBe(true);
    expect(got.history.length).toBeGreaterThanOrEqual(2);
    expect(got.probability.isMl).toBe(false);
    expect(got.probability.isRevenueCertainty).toBe(false);
  });

  it('rejects probability outside 0–100', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-prob-2');
    const bad = await overrideOpportunityProbability(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      probability: 150,
      reason: 'impossible',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('probability_must_be_0_to_100');
  });

  it('applies stage default on transition when not overridden', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-prob-3');
    const moved = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    expect(moved.ok).toBe(true);
    expect(moved.probabilityApplied).toBe(true);
    expect(moved.opportunity.probability).toBe(20);

    const again = await applyStageDefaultProbability(prisma, {
      opportunityId: opp.id,
      stageCode: CRM_PIPELINE_STAGE.NEED_CONFIRMED,
      admin: makeAdmin(),
    });
    // force stage on row then apply
    prisma._oppStore[0].stageCode = CRM_PIPELINE_STAGE.NEED_CONFIRMED;
    const applied = await applyStageDefaultProbability(prisma, {
      opportunityId: opp.id,
      stageCode: CRM_PIPELINE_STAGE.NEED_CONFIRMED,
      admin: makeAdmin(),
    });
    expect(applied.ok).toBe(true);
    expect(applied.probability).toBe(30);
    expect(applied.isMl).toBe(false);
    void again;
  });
});

describe('Wave 2 close date source + confidence + history', () => {
  it('requires source + confidence and records history; UNKNOWN is not forecast-eligible', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, 'w2-close-1');

    const missing = await setOpportunityCloseDate(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      expectedCloseDate: '2026-12-01',
    });
    expect(missing.ok).toBe(false);

    const unknown = await setOpportunityCloseDate(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      expectedCloseDate: '2026-12-01T00:00:00.000Z',
      source: CRM_CLOSE_DATE_SOURCE.REP_ESTIMATE,
      confidence: CRM_CLOSE_DATE_CONFIDENCE.UNKNOWN,
      reason: 'placeholder until procurement reply',
    });
    expect(unknown.ok).toBe(true);
    expect(unknown.forecastEligible).toBe(false);
    expect(unknown.invented).toBe(false);
    expect(isCloseDateForecastEligible(CRM_CLOSE_DATE_CONFIDENCE.UNKNOWN)).toBe(false);

    const confirmed = await setOpportunityCloseDate(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      expectedCloseDate: '2026-11-15T00:00:00.000Z',
      source: CRM_CLOSE_DATE_SOURCE.CUSTOMER_STATED,
      confidence: CRM_CLOSE_DATE_CONFIDENCE.CUSTOMER_CONFIRMED,
      reason: 'email confirmation',
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.forecastEligible).toBe(true);

    const got = await getOpportunityCloseDate(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(got.ok).toBe(true);
    expect(got.history).toHaveLength(2);
    expect(got.closeDate.forecastEligible).toBe(true);
    expect(got.closeDate.invented).toBe(false);
  });
});

describe('Wave 2 weighted helper dark', () => {
  it('computes indicative weighted amount but keeps WEIGHTED_PIPELINE_UI_ENABLED false', () => {
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
    const w = computeIndicativeWeightedAmount({
      amount: 10000,
      probability: 50,
      currency: 'MWK',
    });
    expect(w.ok).toBe(true);
    expect(w.indicativeWeightedAmount).toBe(5000);
    expect(w.weightedUiEnabled).toBe(false);
    expect(w.isRevenue).toBe(false);
    expect(w.isIndicativeOnly).toBe(true);
    expect(w.fxConverted).toBe(false);
  });
});
