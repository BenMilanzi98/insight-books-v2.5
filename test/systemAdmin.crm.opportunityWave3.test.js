/**
 * Phase 12 Wave 3 — Board, risks/tasks/timeline, win/loss, proposal/conversion readiness.
 * Weighted UI remains dark. No Tenant/Subscription/Invoice provision.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_PIPELINE_STAGE,
  CRM_OPPORTUNITY_STATUS,
  WEIGHTED_PIPELINE_UI_ENABLED,
  BOARD_COLUMN_PAGE_SIZE,
  getPipelineBoard,
  transitionOpportunityStage,
  closeOpportunityWon,
  closeOpportunityLost,
  reopenOpportunity,
  assertNoProvision,
  evaluateOpportunityRisks,
  computeOpportunityRiskSignals,
  createOpportunityTask,
  listOpportunityTasks,
  listOpportunityTimeline,
  evaluateProposalReadiness,
  assertNoProposalCreate,
  evaluateConversionReadiness,
  assertNoConversionExecute,
  createOpportunityFromHandoff,
  CRM_AMOUNT_BASIS,
  setOpportunityCommercial,
} from '@/lib/admin/crm';

function makeAdmin(perms = {}) {
  return {
    id: 'admin-w3-1',
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
  const seqStore = overrides._seqStore || [];
  const taskStore = overrides._taskStore || [];
  const timelineStore = overrides._timelineStore || [];
  const riskStore = overrides._riskStore || [];
  const productStore = overrides._productStore || [];
  const roleStore = overrides._roleStore || [];
  const leadStore = overrides._leadStore || [
    {
      id: 'lead-w3-1',
      leadNumber: 'LEAD-2026-000030',
      status: 'OPPORTUNITY_READY',
      accountId: 'acc-w3',
      contactId: 'con-w3',
      title: 'Wave 3 lead',
      source: 'MANUAL',
      channel: 'ADMIN_MANUAL',
    },
  ];

  const prisma = {
    _oppStore: oppStore,
    _historyStore: historyStore,
    _taskStore: taskStore,
    _timelineStore: timelineStore,
    _riskStore: riskStore,
    crmOpportunity: {
      findMany: vi.fn(async ({ where = {}, take, skip, orderBy } = {}) => {
        let rows = [...oppStore];
        if (where?.stageCode) rows = rows.filter((r) => r.stageCode === where.stageCode);
        if (where?.ownerAdminId) rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        if (orderBy?.updatedAt === 'desc') {
          rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        }
        if (orderBy?.createdAt === 'desc') {
          rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        const start = typeof skip === 'number' ? skip : 0;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...oppStore];
        if (where?.stageCode) rows = rows.filter((r) => r.stageCode === where.stageCode);
        if (where?.ownerAdminId) rows = rows.filter((r) => r.ownerAdminId === where.ownerAdminId);
        return rows.length;
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
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `opp-w3-${oppStore.length + 1}`,
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
        for (const row of rows) Object.assign(row, data);
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
      findMany: vi.fn(async ({ where = {}, orderBy, take } = {}) => {
        let rows = [...historyStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        if (orderBy?.at === 'desc') {
          rows.sort((a, b) => new Date(b.at) - new Date(a.at));
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
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
          id: data.id || `hist-w3-${historyStore.length + 1}`,
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
    },
    crmNumberSeq: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.prefix_year || where;
        return seqStore.find((r) => r.prefix === key.prefix && r.year === key.year) || null;
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
      findMany: vi.fn(async () => [...leadStore]),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => data),
      findMany: vi.fn(async () => []),
    },
    crmTask: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...taskStore];
        if (where?.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where?.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (where?.status) rows = rows.filter((r) => r.status === where.status);
        return rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return taskStore.find((r) => r.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `task-w3-${taskStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = taskStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    crmTimelineEvent: {
      findMany: vi.fn(async ({ where = {}, orderBy, take } = {}) => {
        let rows = [...timelineStore];
        if (where?.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where?.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (orderBy?.at === 'desc') {
          rows.sort((a, b) => new Date(b.at) - new Date(a.at));
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tl-w3-${timelineStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        timelineStore.push(row);
        return row;
      }),
    },
    crmOpportunityRisk: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...riskStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        return rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.opportunityId_code) {
          return (
            riskStore.find(
              (r) =>
                r.opportunityId === where.opportunityId_code.opportunityId &&
                r.code === where.opportunityId_code.code
            ) || null
          );
        }
        return riskStore.find((r) => r.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `risk-w3-${riskStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        riskStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = riskStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    crmOpportunityProduct: {
      count: vi.fn(async ({ where = {} } = {}) => {
        return productStore.filter((r) => r.opportunityId === where.opportunityId).length;
      }),
      findMany: vi.fn(async () => productStore),
      create: vi.fn(async ({ data }) => {
        const row = { id: `prod-${productStore.length + 1}`, ...data };
        productStore.push(row);
        return row;
      }),
    },
    crmOpportunityContactRole: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          roleStore.find(
            (r) =>
              r.opportunityId === where.opportunityId &&
              (!where.role || r.role === where.role)
          ) || null
        );
      }),
      findMany: vi.fn(async () => roleStore),
      create: vi.fn(async ({ data }) => {
        const row = { id: `role-${roleStore.length + 1}`, ...data };
        roleStore.push(row);
        return row;
      }),
    },
    crmOpportunityAmountHistory: {
      create: vi.fn(async ({ data }) => data),
    },
    crmOpportunityProbabilityHistory: {
      create: vi.fn(async ({ data }) => data),
    },
  };

  return prisma;
}

async function seedOpp(prisma, extra = {}) {
  const created = await createOpportunityFromHandoff(prisma, {
    admin: makeAdmin(),
    handoffPayload: {
      type: 'CRM_OPPORTUNITY_HANDOFF',
      readinessStatus: 'READY',
      leadId: 'lead-w3-1',
      accountId: 'acc-w3',
      contactId: 'con-w3',
      idempotencyKey: extra.idempotencyKey || `w3-${Date.now()}-${Math.random()}`,
      opportunityId: null,
      opportunityCreated: false,
    },
    title: 'Wave 3 opportunity',
  });
  expect(created.ok).toBe(true);
  if (extra.ownerAdminId) {
    await prisma.crmOpportunity.update({
      where: { id: created.opportunity.id },
      data: { ownerAdminId: extra.ownerAdminId },
    });
  }
  return created.opportunity;
}

describe('Phase 12 Wave 3 — board / close / readiness', () => {
  it('keeps weighted pipeline UI dark', () => {
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
    expect(BOARD_COLUMN_PAGE_SIZE).toBe(25);
  });

  it('returns bounded board columns with meta truncation flags', async () => {
    const prisma = makePrisma();
    await seedOpp(prisma, { idempotencyKey: 'board-1' });
    const board = await getPipelineBoard(prisma, { admin: makeAdmin() });
    expect(board.ok).toBe(true);
    expect(board.columns.length).toBeGreaterThan(5);
    expect(board.meta.columnLimit).toBe(BOARD_COLUMN_PAGE_SIZE);
    expect(board.meta.weightedUiEnabled).toBe(false);
    expect(board.meta.boardDragPersistForbidden).toBe(true);
    const identified = board.columns.find(
      (c) => c.stageCode === CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED
    );
    expect(identified.items.length).toBe(1);
  });

  it('denies board-style terminal stage POST without close service', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'deny-term' });
    const denied = await transitionOpportunityStage({
      prisma,
      admin: makeAdmin(),
      opportunityId: opp.id,
      toStageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toBe('USE_CLOSE_SERVICE');
    expect(denied.missingCriteria).toContain('evidence');
  });

  it('requires Closed Won evidence + win reason + decision date; never provisions', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'won-1' });

    const missing = await closeOpportunityWon(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-30',
    });
    expect(missing.ok).toBe(false);
    expect(missing.error).toBe('CLOSED_WON_EVIDENCE_REQUIRED');

    const won = await closeOpportunityWon(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-30',
      evidence: ['contract:REF-1'],
    });
    expect(won.ok).toBe(true);
    expect(won.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.CLOSED_WON);
    expect(won.opportunity.status).toBe(CRM_OPPORTUNITY_STATUS.WON);
    expect(won.tenantCreated).toBe(false);
    expect(won.subscriptionCreated).toBe(false);
    expect(won.invoiceCreated).toBe(false);
    expect(assertNoProvision(won).ok).toBe(true);
  });

  it('requires Closed Lost loss reason', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'lost-1' });
    const missing = await closeOpportunityLost(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(missing.ok).toBe(false);
    expect(missing.error).toBe('LOSS_REASON_REQUIRED');

    const lost = await closeOpportunityLost(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      lossReason: 'NO_BUDGET',
    });
    expect(lost.ok).toBe(true);
    expect(lost.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.CLOSED_LOST);
    expect(lost.provisionCheck.ok).toBe(true);
  });

  it('reopens terminal opportunity with reason', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'reopen-1' });
    await closeOpportunityLost(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      lossReason: 'TIMING',
    });
    const reopened = await reopenOpportunity(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      reopenReason: 'customer revived',
    });
    expect(reopened.ok).toBe(true);
    expect(reopened.opportunity.stageCode).toBe(CRM_PIPELINE_STAGE.CUSTOMER_DECISION);
    expect(reopened.opportunity.status).toBe(CRM_OPPORTUNITY_STATUS.OPEN);
  });

  it('computes deterministic risk signals and Opportunity tasks', async () => {
    const signals = computeOpportunityRiskSignals({
      contactId: null,
      amount: null,
      currency: null,
      amountBasis: null,
      ownerAdminId: null,
      status: 'OPEN',
      expectedCloseDate: new Date('2020-01-01'),
    });
    expect(signals.some((s) => s.code === 'MISSING_PRIMARY_CONTACT')).toBe(true);
    expect(signals.some((s) => s.code === 'MISSING_COMMERCIAL')).toBe(true);
    expect(signals.every((s) => s.isMl === false)).toBe(true);

    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'risk-1' });
    const evaluated = await evaluateOpportunityRisks(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      persist: true,
    });
    expect(evaluated.ok).toBe(true);
    expect(evaluated.meta.deterministic).toBe(true);

    const task = await createOpportunityTask(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      title: 'Call economic buyer',
    });
    expect(task.ok).toBe(true);
    expect(task.leadTaskCloned).toBe(false);
    const listed = await listOpportunityTasks(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(listed.items.length).toBe(1);

    const tl = await listOpportunityTimeline(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(tl.ok).toBe(true);
    expect(tl.meta.supportThreadProjected).toBe(false);
  });

  it('proposal readiness returns handoff only — never creates Proposal', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'prop-1' });
    await setOpportunityCommercial(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      amount: 1200,
      currency: 'MWK',
      amountBasis: CRM_AMOUNT_BASIS.FIRST_YEAR_TOTAL,
    });
    // advance toward proposal-ready-ish: seed PRIMARY via contactId already
    const result = await evaluateProposalReadiness(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(result.ok).toBe(true);
    expect(result.proposalCreated).toBe(false);
    expect(result.handoffPayload.proposalId).toBeNull();
    expect(assertNoProposalCreate(result)).toBe(true);
  });

  it('conversion readiness never executes Tenant conversion', async () => {
    const prisma = makePrisma();
    const opp = await seedOpp(prisma, { idempotencyKey: 'conv-1' });
    await closeOpportunityWon(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
      winReason: 'BEST_FIT',
      decisionDate: '2026-07-30',
      evidence: [{ type: 'EMAIL', value: 'msg-1' }],
    });
    const result = await evaluateConversionReadiness(prisma, {
      admin: makeAdmin(),
      opportunityId: opp.id,
    });
    expect(result.ok).toBe(true);
    expect(result.conversionExecuted).toBe(false);
    expect(result.tenantCreated).toBe(false);
    expect(result.handoffPayload.tenantId).toBeNull();
    expect(assertNoConversionExecute(result)).toBe(true);
    expect(assertNoProvision(result).ok).toBe(true);
  });
});
