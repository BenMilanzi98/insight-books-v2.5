/**
 * Phase 12 Wave 1 — Opportunity create from READY handoff + Lead convert
 * (≠ Subscription ≠ Invoice ≠ Tenant provision; Lead convert only after Opp create).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_LEAD_STATUS,
  CRM_PIPELINE_STAGE,
  CRM_OPPORTUNITY_NUMBER_RE,
  CRM_READINESS_STATUS,
  createOpportunityFromHandoff,
  getOpportunity,
  listOpportunities,
  transitionLeadStatus,
  canTransition,
  assertTransition,
} from '@/lib/admin/crm';

function makeAdmin(perms = {}) {
  return {
    id: 'admin-opp-1',
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
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-ready-1',
      leadNumber: 'LEAD-2026-000010',
      status: CRM_LEAD_STATUS.OPPORTUNITY_READY,
      accountId: 'acc-1',
      contactId: 'con-1',
      title: 'Ready lead',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
    },
  ];
  const subscriptionStore = overrides._subscriptionStore || [];
  const invoiceStore = overrides._invoiceStore || [];
  const tenantStore = overrides._tenantStore || [];

  const prisma = {
    crmOpportunity: {
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...oppStore];
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (where?.stageCode) rows = rows.filter((r) => r.stageCode === where.stageCode);
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
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
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `opp-${oppStore.length + 1}`,
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
        Object.assign(row, data, { updatedAt: new Date() });
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
        const row = {
          id: data.id || `ohist-${historyStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        historyStore.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where = {} } = {}) => {
        const before = historyStore.length;
        const keep = historyStore.filter((r) => {
          if (where?.opportunityId && r.opportunityId !== where.opportunityId) return true;
          if (where?.opportunityId) return false;
          return true;
        });
        historyStore.length = 0;
        historyStore.push(...keep);
        return { count: before - historyStore.length };
      }),
    },
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return (
          seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { ...data, updatedAt: new Date() };
        seqStore.push(row);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        const row = seqStore.find(
          (r) =>
            r.prefix === where.prefix &&
            r.year === where.year &&
            r.lastIssued === where.lastIssued
        );
        if (!row) return { count: 0 };
        row.lastIssued = data.lastIssued;
        return { count: 1 };
      }),
    },
    crmLead: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        if (where.leadNumber) {
          return leadStore.find((r) => r.leadNumber === where.leadNumber) || null;
        }
        return null;
      }),
      findMany: vi.fn(async () => leadStore),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        leadHistoryStore.push(data);
        return data;
      }),
      findMany: vi.fn(async () => leadHistoryStore),
    },
    subscription: {
      create: vi.fn(async ({ data }) => {
        subscriptionStore.push(data);
        return data;
      }),
      count: vi.fn(async () => subscriptionStore.length),
    },
    invoice: {
      create: vi.fn(async ({ data }) => {
        invoiceStore.push(data);
        return data;
      }),
      count: vi.fn(async () => invoiceStore.length),
    },
    tenant: {
      create: vi.fn(async ({ data }) => {
        tenantStore.push(data);
        return data;
      }),
      count: vi.fn(async () => tenantStore.length),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _oppStore: oppStore,
    _historyStore: historyStore,
    _leadStore: leadStore,
    _leadHistoryStore: leadHistoryStore,
    _subscriptionStore: subscriptionStore,
    _invoiceStore: invoiceStore,
    _tenantStore: tenantStore,
  };
  return prisma;
}

function readyHandoff(overrides = {}) {
  return {
    type: 'CRM_OPPORTUNITY_HANDOFF',
    version: 'crm-core-wave4-2026-07-30',
    readinessStatus: CRM_READINESS_STATUS.READY,
    leadId: 'lead-ready-1',
    leadNumber: 'LEAD-2026-000010',
    accountId: 'acc-1',
    contactId: 'con-1',
    source: 'MANUAL',
    channel: 'ADMIN_MANUAL',
    scoreVersionId: null,
    qualificationVersionId: 'qual-small-business-standard-v1',
    idempotencyKey: 'opp-ready:lead-ready-1:qual-v1:none',
    opportunityId: null,
    opportunityCreated: false,
    pipelineCreated: false,
    revenueInvented: false,
    ...overrides,
  };
}

describe('Opportunity create from READY handoff', () => {
  it('creates Opportunity at OPPORTUNITY_IDENTIFIED with OPP number', async () => {
    const prisma = makePrisma();
    const result = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff(),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    expect(result.created).toBe(true);
    expect(result.opportunity.opportunityNumber).toMatch(CRM_OPPORTUNITY_NUMBER_RE);
    expect(result.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED);
    expect(result.opportunity.leadId).toBe('lead-ready-1');
    expect(result.opportunity.accountId).toBe('acc-1');
    expect(result.opportunity.contactId).toBe('con-1');
    // Wave 2 serialize: unset commercial/close stay null; stage default probability applied
    expect(result.opportunity.amount).toBeNull();
    expect(result.opportunity.probability).toBe(10);
    expect(result.opportunity.probabilitySource).toBe('STAGE_DEFAULT');
    expect(result.opportunity.expectedCloseDate).toBeNull();
    expect(result.amountInvented).toBe(false);
    expect(result.probabilityInvented).toBe(false);
    expect(result.closeDateInvented).toBe(false);
  });

  it('is idempotent on handoffPayload.idempotencyKey', async () => {
    const prisma = makePrisma();
    const payload = readyHandoff();
    const first = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: payload,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const second = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: payload,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(second.opportunity.id).toBe(first.opportunity.id);
    expect(prisma._oppStore).toHaveLength(1);
  });

  it('rejects non-READY / wrong type handoff', async () => {
    const prisma = makePrisma();
    const notReady = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff({ readinessStatus: 'NOT_READY' }),
    });
    expect(notReady.ok).toBe(false);
    expect(notReady.error).toMatch(/not_ready|READY/i);

    const badType = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff({ type: 'SOMETHING_ELSE' }),
    });
    expect(badType.ok).toBe(false);
  });

  it('does not create Subscription, Invoice, or Tenant', async () => {
    const prisma = makePrisma();
    const result = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff(),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(true);
    expect(prisma.subscription.create).not.toHaveBeenCalled();
    expect(prisma.invoice.create).not.toHaveBeenCalled();
    expect(prisma.tenant.create).not.toHaveBeenCalled();
    expect(prisma._subscriptionStore).toHaveLength(0);
    expect(prisma._invoiceStore).toHaveLength(0);
    expect(prisma._tenantStore).toHaveLength(0);
  });

  it('transitions Lead to CONVERTED_TO_OPPORTUNITY only after Opp create', async () => {
    const prisma = makePrisma();

    // Direct transition still blocked for API / public path
    expect(
      canTransition(
        CRM_LEAD_STATUS.OPPORTUNITY_READY,
        CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY
      )
    ).toBe(false);
    const direct = await transitionLeadStatus(prisma, {
      admin: makeAdmin(),
      leadId: 'lead-ready-1',
      toStatus: CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,
    });
    expect(direct.ok).toBe(false);
    expect(['INVALID_TRANSITION', 'NOT_IMPLEMENTED']).toContain(direct.error);
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.OPPORTUNITY_READY);

    const created = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff(),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY);
    expect(prisma._leadHistoryStore.some(
      (h) => h.toStatus === CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY
    )).toBe(true);

    // State machine allows only with fromOpportunityCreate flag
    const gated = assertTransition(
      CRM_LEAD_STATUS.OPPORTUNITY_READY,
      CRM_LEAD_STATUS.CONVERTED_TO_OPPORTUNITY,
      { fromOpportunityCreate: true }
    );
    expect(gated.ok).toBe(true);
  });

  it('rejects create without opportunities.create permission', async () => {
    const prisma = makePrisma();
    const result = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin({
        'systemAdmin.crm.opportunities.create': false,
        'systemAdmin.crm.createLeads': false,
        'systemAdmin.crm.editLeads': false,
      }),
      handoffPayload: readyHandoff(),
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
  });

  it('fails closed and compensates when Lead conversion fails after Opp create', async () => {
    const prisma = makePrisma();
    let leadReads = 0;
    const originalFind = prisma.crmLead.findUnique;
    prisma.crmLead.findUnique = vi.fn(async (args) => {
      leadReads += 1;
      const row = await originalFind(args);
      // Create pre-check sees READY; convert path sees NEW → gate fails
      if (leadReads > 1 && row) {
        return { ...row, status: CRM_LEAD_STATUS.NEW };
      }
      return row;
    });

    const result = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff(),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('lead_conversion_failed');
    expect(result.code).toBe('LEAD_CONVERSION_FAILED');
    expect(result.compensated).toBe(true);
    expect(prisma._oppStore).toHaveLength(0);
    expect(prisma._historyStore).toHaveLength(0);
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.OPPORTUNITY_READY);
  });

  it('does not convert Lead without a persisted Opportunity linked to that Lead', async () => {
    const { convertLeadAfterOpportunityCreate } = await import(
      '@/lib/admin/crm/opportunities/leads.js'
    );
    const prisma = makePrisma();
    const missingOpp = await convertLeadAfterOpportunityCreate(prisma, {
      admin: makeAdmin(),
      leadId: 'lead-ready-1',
      opportunityId: 'opp-does-not-exist',
    });
    expect(missingOpp.ok).toBe(false);
    expect(missingOpp.code).toBe('OPPORTUNITY_REQUIRED');
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.OPPORTUNITY_READY);

    prisma._oppStore.push({
      id: 'opp-other-lead',
      leadId: 'lead-someone-else',
      stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
      opportunityNumber: 'OPP-2026-000099',
    });
    const mismatch = await convertLeadAfterOpportunityCreate(prisma, {
      admin: makeAdmin(),
      leadId: 'lead-ready-1',
      opportunityId: 'opp-other-lead',
    });
    expect(mismatch.ok).toBe(false);
    expect(mismatch.code).toBe('OPPORTUNITY_LEAD_MISMATCH');
    expect(prisma._leadStore[0].status).toBe(CRM_LEAD_STATUS.OPPORTUNITY_READY);
  });

  it('list and get opportunity', async () => {
    const prisma = makePrisma();
    const created = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: readyHandoff(),
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const listed = await listOpportunities(prisma, { admin: makeAdmin() });
    expect(listed.ok).toBe(true);
    expect(listed.items.length).toBe(1);

    const got = await getOpportunity(prisma, {
      admin: makeAdmin(),
      id: created.opportunity.id,
    });
    expect(got.ok).toBe(true);
    expect(got.opportunity.opportunityNumber).toBe(created.opportunity.opportunityNumber);
  });
});
