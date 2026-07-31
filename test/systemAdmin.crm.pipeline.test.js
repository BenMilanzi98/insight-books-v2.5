/**
 * Phase 12 Wave 1 — NEW_BUSINESS Pipeline + stage transitions
 * (≠ Lead status machine ≠ analytics-pipeline ≠ POS sales.*).
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_STAGE,
  CRM_PIPELINE_STAGES_ORDERED,
  CRM_OPPORTUNITY_NUMBER_RE,
  CRM_NUMBER_PREFIX,
  getDefaultNewBusinessPipelineDefinition,
  listPipelines,
  getPipeline,
  transitionOpportunityStage,
  createOpportunityFromHandoff,
  allocateCrmNumber,
} from '@/lib/admin/crm';
import { SYSTEM_ADMIN_PERMISSIONS, NAV_PERMISSION_MAP } from '@/lib/admin/permissions';

describe('CRM Pipeline catalogue (Phase 12 Wave 1)', () => {
  it('defines NEW_BUSINESS Pipeline v1 with 10 ordered stages', () => {
    const def = getDefaultNewBusinessPipelineDefinition();
    expect(def.code).toBe(CRM_PIPELINE_CODE.NEW_BUSINESS);
    expect(def.status).toBe('ACTIVE');
    expect(def.version).toBeTruthy();
    expect(def.stages.map((s) => s.code)).toEqual([...CRM_PIPELINE_STAGES_ORDERED]);
    expect(CRM_PIPELINE_STAGES_ORDERED).toHaveLength(10);
    expect(CRM_PIPELINE_STAGES_ORDERED[0]).toBe(CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED);
    expect(CRM_PIPELINE_STAGES_ORDERED).toContain(CRM_PIPELINE_STAGE.CLOSED_WON);
    expect(CRM_PIPELINE_STAGES_ORDERED).toContain(CRM_PIPELINE_STAGE.CLOSED_LOST);
  });

  it('marks CLOSED_WON and CLOSED_LOST as terminal', () => {
    const def = getDefaultNewBusinessPipelineDefinition();
    const won = def.stages.find((s) => s.code === CRM_PIPELINE_STAGE.CLOSED_WON);
    const lost = def.stages.find((s) => s.code === CRM_PIPELINE_STAGE.CLOSED_LOST);
    expect(won.terminal).toBe(true);
    expect(lost.terminal).toBe(true);
    const open = def.stages.filter((s) => !s.terminal);
    expect(open).toHaveLength(8);
  });

  it('exposes live pipeline + opportunities permissions and nav maps', () => {
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView).toBe(
      'systemAdmin.crm.pipeline.view'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.pipelineManageDefinitions).toBe(
      'systemAdmin.crm.pipeline.manageDefinitions'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.pipelineTransitionStages).toBe(
      'systemAdmin.crm.pipeline.transitionStages'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesView).toBe(
      'systemAdmin.crm.opportunities.view'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesCreate).toBe(
      'systemAdmin.crm.opportunities.create'
    );
    expect(SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesEdit).toBe(
      'systemAdmin.crm.opportunities.edit'
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/crm/pipeline']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.crm.pipelineView
    );
    expect(NAV_PERMISSION_MAP['/insightbooks/crm/opportunities']).toBe(
      SYSTEM_ADMIN_PERMISSIONS.crm.opportunitiesView
    );
  });
});

function makeAdmin(perms = {}) {
  return {
    id: 'admin-pipeline-1',
    role: 'CRM Agent',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.pipeline.view': true,
      'systemAdmin.crm.pipeline.transitionStages': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.create': true,
      'systemAdmin.crm.opportunities.edit': true,
      'systemAdmin.crm.viewLeads': true,
      'systemAdmin.crm.editLeads': true,
      'systemAdmin.crm.transitionStatus': true,
      ...perms,
    },
  };
}

function makePrisma(overrides = {}) {
  const oppStore = overrides._oppStore || [];
  const historyStore = overrides._historyStore || [];
  const seqStore = overrides._seqStore || [];
  const leadStore = overrides._leadStore || [];
  const pipelineStore = overrides._pipelineStore || [];
  const versionStore = overrides._versionStore || [];
  const stageStore = overrides._stageStore || [];
  const subscriptionStore = overrides._subscriptionStore || [];
  const invoiceStore = overrides._invoiceStore || [];

  const prisma = {
    crmOpportunity: {
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...oppStore];
        if (where?.stageCode) rows = rows.filter((r) => r.stageCode === where.stageCode);
        if (where?.leadId) rows = rows.filter((r) => r.leadId === where.leadId);
        if (where?.handoffIdempotencyKey) {
          rows = rows.filter((r) => r.handoffIdempotencyKey === where.handoffIdempotencyKey);
        }
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
        Object.assign(row, data, {
          updatedAt: data.updatedAt || new Date(),
          version: data.version != null ? data.version : (row.version || 1) + 1,
        });
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }) => {
        let rows = oppStore.filter((r) => r.id === where.id);
        if (where.version != null) rows = rows.filter((r) => r.version === where.version);
        for (const row of rows) {
          Object.assign(row, data, {
            updatedAt: data.updatedAt || new Date(),
          });
        }
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
        if (where?.idempotencyKey) {
          rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
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
          id: data.id || `hist-${historyStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        historyStore.push(row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where = {} } = {}) => {
        const before = historyStore.length;
        const keep = historyStore.filter((r) => {
          if (where?.opportunityId && r.opportunityId === where.opportunityId) return false;
          return true;
        });
        historyStore.length = 0;
        historyStore.push(...keep);
        return { count: before - historyStore.length };
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...historyStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows.length;
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
        row.updatedAt = new Date();
        return { count: 1 };
      }),
    },
    crmLead: {
      findMany: vi.fn(async () => leadStore),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        if (where.leadNumber) {
          return leadStore.find((r) => r.leadNumber === where.leadNumber) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: new Date() });
        return row;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => data),
      findMany: vi.fn(async () => []),
    },
    crmPipeline: {
      findMany: vi.fn(async () => pipelineStore),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return pipelineStore.find((r) => r.id === where.id) || null;
        if (where.code) return pipelineStore.find((r) => r.code === where.code) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...pipelineStore];
        if (where?.code) rows = rows.filter((r) => r.code === where.code);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
    },
    crmPipelineVersion: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...versionStore];
        if (where?.pipelineId) rows = rows.filter((r) => r.pipelineId === where.pipelineId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...versionStore];
        if (where?.pipelineId) rows = rows.filter((r) => r.pipelineId === where.pipelineId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return versionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    crmPipelineStage: {
      findMany: vi.fn(async ({ where = {}, orderBy } = {}) => {
        let rows = [...stageStore];
        if (where?.pipelineVersionId) {
          rows = rows.filter((r) => r.pipelineVersionId === where.pipelineVersionId);
        }
        if (orderBy?.sortOrder === 'asc') {
          rows.sort((a, b) => a.sortOrder - b.sortOrder);
        }
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...stageStore];
        if (where?.pipelineVersionId) {
          rows = rows.filter((r) => r.pipelineVersionId === where.pipelineVersionId);
        }
        if (where?.code) rows = rows.filter((r) => r.code === where.code);
        return rows[0] || null;
      }),
    },
    subscription: {
      create: vi.fn(async ({ data }) => {
        subscriptionStore.push(data);
        return data;
      }),
      findMany: vi.fn(async () => subscriptionStore),
    },
    invoice: {
      create: vi.fn(async ({ data }) => {
        invoiceStore.push(data);
        return data;
      }),
      findMany: vi.fn(async () => invoiceStore),
    },
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _oppStore: oppStore,
    _historyStore: historyStore,
    _leadStore: leadStore,
    _subscriptionStore: subscriptionStore,
    _invoiceStore: invoiceStore,
  };

  return prisma;
}

describe('CRM Pipeline list / get', () => {
  it('lists ACTIVE NEW_BUSINESS from catalogue when DB empty', async () => {
    const prisma = makePrisma();
    const result = await listPipelines(prisma, { admin: makeAdmin() });
    expect(result.ok).toBe(true);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
    expect(result.items[0].code).toBe(CRM_PIPELINE_CODE.NEW_BUSINESS);
    expect(result.items[0].stages).toHaveLength(10);
  });

  it('forbids pipeline list without view permission', async () => {
    const prisma = makePrisma();
    const result = await listPipelines(prisma, {
      admin: makeAdmin({
        'systemAdmin.crm.pipeline.view': false,
        'systemAdmin.crm.view': false,
      }),
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
  });

  it('getPipeline returns definition by code', async () => {
    const prisma = makePrisma();
    const result = await getPipeline(prisma, {
      admin: makeAdmin(),
      id: CRM_PIPELINE_CODE.NEW_BUSINESS,
    });
    expect(result.ok).toBe(true);
    expect(result.pipeline.code).toBe(CRM_PIPELINE_CODE.NEW_BUSINESS);
  });
});

describe('CRM Opportunity stage transitions', () => {
  async function seedOpenOpportunity(prisma, stageCode = CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED) {
    const created = await createOpportunityFromHandoff(prisma, {
      admin: makeAdmin(),
      handoffPayload: {
        type: 'CRM_OPPORTUNITY_HANDOFF',
        readinessStatus: 'READY',
        leadId: 'lead-1',
        leadNumber: 'LEAD-2026-000001',
        accountId: 'acc-1',
        contactId: 'con-1',
        idempotencyKey: `opp-ready:lead-1:v1:none:${stageCode}`,
        opportunityId: null,
        opportunityCreated: false,
      },
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(created.ok).toBe(true);
    if (stageCode !== CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED) {
      // force stage for mid-path tests
      const row = prisma._oppStore.find((r) => r.id === created.opportunity.id);
      row.stageCode = stageCode;
    }
    return created.opportunity;
  }

  it('allows sequential forward DISCOVERY and appends immutable history', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const result = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
      reason: 'kickoff scheduled',
    });
    expect(result.ok).toBe(true);
    expect(result.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.DISCOVERY);
    expect(prisma._historyStore.length).toBeGreaterThanOrEqual(2); // create + transition
    const last = prisma._historyStore[prisma._historyStore.length - 1];
    expect(last.toStageCode).toBe(CRM_PIPELINE_STAGE.DISCOVERY);
    expect(last.fromStageCode).toBe(CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED);
  });

  it('rejects skip-forward and same-stage as INVALID_TRANSITION', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const skip = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.NEED_CONFIRMED,
    });
    expect(skip.ok).toBe(false);
    expect(skip.error).toBe('INVALID_TRANSITION');

    const same = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
    });
    expect(same.ok).toBe(false);
    expect(same.error).toBe('INVALID_TRANSITION');
  });

  it('denies direct terminal CLOSED_LOST without close service; close service works', async () => {
    const { closeOpportunityLost } = await import('@/lib/admin/crm');
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const denied = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
      reason: 'no budget',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('USE_CLOSE_SERVICE');
    expect(denied.missingCriteria).toContain('lossReason');

    const closed = await closeOpportunityLost(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      lossReason: 'NO_BUDGET',
      reason: 'no budget',
    });
    expect(closed.ok).toBe(true);
    expect(closed.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.CLOSED_LOST);
    expect(closed.tenantCreated).toBe(false);

    const reopen = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    expect(reopen.ok).toBe(false);
    expect(reopen.error).toBe('INVALID_TRANSITION');
  });

  it('retries exact transition idempotencyKey without duplicate history', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const key = 'trans-idem-1';
    const first = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
      idempotencyKey: key,
    });
    expect(first.ok).toBe(true);
    const histCount = prisma._historyStore.length;
    const second = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
      idempotencyKey: key,
    });
    expect(second.ok).toBe(true);
    expect(second.idempotent).toBe(true);
    expect(prisma._historyStore.length).toBe(histCount);
  });

  it('rejects same idempotencyKey with a different toStageCode', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const key = 'trans-idem-conflict';
    const first = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
      idempotencyKey: key,
    });
    expect(first.ok).toBe(true);

    const conflict = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
      idempotencyKey: key,
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toBe('IDEMPOTENCY_KEY_CONFLICT');
    expect(conflict.priorToStageCode).toBe(CRM_PIPELINE_STAGE.DISCOVERY);
    expect(conflict.toStageCode).toBe(CRM_PIPELINE_STAGE.CLOSED_LOST);
    expect(prisma._oppStore[0].stageCode).toBe(CRM_PIPELINE_STAGE.DISCOVERY);
  });

  it('forbids transition without transitionStages / edit permission', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-1',
          leadNumber: 'LEAD-2026-000001',
          status: 'OPPORTUNITY_READY',
          accountId: 'acc-1',
          contactId: 'con-1',
        },
      ],
    });
    const opp = await seedOpenOpportunity(prisma);
    const result = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin({
        'systemAdmin.crm.pipeline.transitionStages': false,
        'systemAdmin.crm.opportunities.edit': false,
        'systemAdmin.crm.editLeads': false,
      }),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    expect(result.ok).toBe(false);
    expect(result.forbidden).toBe(true);
  });
});

describe('CRM OPP numbering', () => {
  it('allocates OPP-YYYY-###### concurrency-safe', async () => {
    const prisma = makePrisma();
    const a = await allocateCrmNumber(prisma, {
      prefix: CRM_NUMBER_PREFIX.OPP,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    const b = await allocateCrmNumber(prisma, {
      prefix: CRM_NUMBER_PREFIX.OPP,
      now: new Date('2026-07-30T12:00:00.000Z'),
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(a.number).toMatch(CRM_OPPORTUNITY_NUMBER_RE);
    expect(a.number).toBe('OPP-2026-000001');
    expect(b.number).toBe('OPP-2026-000002');
  });
});
