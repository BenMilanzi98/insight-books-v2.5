/**
 * Phase 12 Wave 4 — Extra pipelines, duplicates/merge, import, reports, foundations.
 * Weighted UI remains dark. No false zeroes. No silent merge.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_PIPELINE_CODE,
  CRM_PIPELINE_CODES,
  CRM_PIPELINE_STAGE,
  CRM_OPPORTUNITY_STATUS,
  CRM_MERGE_ENTITY,
  WEIGHTED_PIPELINE_UI_ENABLED,
  listPipelines,
  getPipelineDefinitionByCode,
  listCataloguePipelineDefinitions,
  detectOpportunityDuplicateCandidates,
  listOpportunityDuplicateCandidates,
  requestMerge,
  approveMerge,
  executeMerge,
  previewOpportunityImport,
  confirmOpportunityImport,
  getPipelineReport,
  createPipelineReportSchedule,
  listPipelineReportSchedules,
  runPipelineReportSchedule,
  getCrmFoundations,
  computeIndicativeWeightedAmount,
} from '@/lib/admin/crm';

function makeAdmin(id = 'admin-w4-1', perms = {}) {
  return {
    id,
    role: 'CRM Agent',
    permissions: {
      'systemAdmin.crm.view': true,
      'systemAdmin.crm.viewLeads': true,
      'systemAdmin.crm.editLeads': true,
      'systemAdmin.crm.mergeLeads': true,
      'systemAdmin.crm.export': true,
      'systemAdmin.crm.pipeline.view': true,
      'systemAdmin.crm.pipeline.manageDefinitions': true,
      'systemAdmin.crm.opportunities.view': true,
      'systemAdmin.crm.opportunities.create': true,
      'systemAdmin.crm.opportunities.edit': true,
      ...perms,
    },
  };
}

function makePrisma(overrides = {}) {
  const oppStore = overrides._oppStore || [];
  const dupStore = overrides._dupStore || [];
  const mergeStore = overrides._mergeStore || [];
  const seqStore = overrides._seqStore || [];
  const historyStore = overrides._historyStore || [];
  const scheduleStore = overrides._scheduleStore || [];
  const runStore = overrides._runStore || [];
  const timelineStore = overrides._timelineStore || [];

  const prisma = {
    _oppStore: oppStore,
    _dupStore: dupStore,
    _mergeStore: mergeStore,
    _scheduleStore: scheduleStore,
    crmOpportunity: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...oppStore];
        if (where?.id?.not) rows = rows.filter((r) => r.id !== where.id.not);
        if (where?.status?.not) rows = rows.filter((r) => r.status !== where.status.not);
        if (where?.status) {
          if (typeof where.status === 'string') {
            rows = rows.filter((r) => r.status === where.status);
          }
        }
        if (where?.pipelineCode) {
          rows = rows.filter((r) => r.pipelineCode === where.pipelineCode);
        }
        if (where?.importIdempotencyKey) {
          rows = rows.filter((r) => r.importIdempotencyKey === where.importIdempotencyKey);
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return oppStore.find((r) => r.id === where.id) || null;
        if (where.opportunityNumber) {
          return oppStore.find((r) => r.opportunityNumber === where.opportunityNumber) || null;
        }
        if (where.importIdempotencyKey) {
          return (
            oppStore.find((r) => r.importIdempotencyKey === where.importIdempotencyKey) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...oppStore];
        if (where?.importIdempotencyKey) {
          rows = rows.filter((r) => r.importIdempotencyKey === where.importIdempotencyKey);
        }
        return rows[0] || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `opp-w4-${oppStore.length + 1}`,
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
    },
    crmOpportunityStageHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `hist-w4-${historyStore.length + 1}`, ...data };
        historyStore.push(row);
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        return historyStore.filter((r) => r.opportunityId === where.opportunityId).length;
      }),
    },
    crmOpportunityDuplicateCandidate: {
      findMany: vi.fn(async ({ where = {}, take } = {}) => {
        let rows = [...dupStore];
        if (where?.opportunityId) {
          rows = rows.filter((r) => r.opportunityId === where.opportunityId);
        }
        if (where?.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.opportunityId) return r.opportunityId === clause.opportunityId;
              if (clause.candidateOpportunityId) {
                return r.candidateOpportunityId === clause.candidateOpportunityId;
              }
              return false;
            })
          );
        }
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          dupStore.find(
            (r) =>
              r.opportunityId === where.opportunityId &&
              r.candidateOpportunityId === where.candidateOpportunityId &&
              r.matchType === where.matchType
          ) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return dupStore.find((r) => r.id === where.id) || null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `odup-w4-${dupStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        dupStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = dupStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmMergeRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `merge-w4-${mergeStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        mergeStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return mergeStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = mergeStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...mergeStore]),
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
    crmPipelineReportSchedule: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `sched-w4-${scheduleStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        scheduleStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ take } = {}) => {
        const rows = [...scheduleStore].sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );
        return typeof take === 'number' ? rows.slice(0, take) : rows;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return scheduleStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = scheduleStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data);
        return row;
      }),
    },
    crmPipelineReportRun: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `run-w4-${runStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        runStore.push(row);
        return row;
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-w4-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
    ...overrides,
  };

  return prisma;
}

function seedOpp(prisma, patch = {}) {
  const row = {
    id: patch.id || `opp-${prisma._oppStore.length + 1}`,
    opportunityNumber: patch.opportunityNumber || `OPP-2026-${String(prisma._oppStore.length + 1).padStart(6, '0')}`,
    pipelineCode: patch.pipelineCode || CRM_PIPELINE_CODE.NEW_BUSINESS,
    stageCode: patch.stageCode || CRM_PIPELINE_STAGE.DISCOVERY,
    status: patch.status || CRM_OPPORTUNITY_STATUS.OPEN,
    accountId: patch.accountId ?? 'acc-shared',
    contactId: patch.contactId ?? 'con-1',
    title: patch.title || 'Wave 4 opp',
    amount: patch.amount ?? null,
    currency: patch.currency ?? null,
    amountBasis: patch.amountBasis ?? null,
    probability: patch.probability ?? null,
    handoffIdempotencyKey: patch.handoffIdempotencyKey ?? null,
    importIdempotencyKey: patch.importIdempotencyKey ?? null,
    mergedIntoOpportunityId: null,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...patch,
  };
  prisma._oppStore.push(row);
  return row;
}

describe('Phase 12 Wave 4 — Extra Pipelines', () => {
  it('exposes ACTIVE EXPANSION and MRA_EIS catalogue definitions', () => {
    const all = listCataloguePipelineDefinitions();
    expect(all.map((p) => p.code).sort()).toEqual([...CRM_PIPELINE_CODES].sort());
    for (const code of [CRM_PIPELINE_CODE.EXPANSION, CRM_PIPELINE_CODE.MRA_EIS]) {
      const def = getPipelineDefinitionByCode(code);
      expect(def).toBeTruthy();
      expect(def.status).toBe('ACTIVE');
      expect(def.weightedUiEnabled).toBe(false);
      expect(def.stages.length).toBeGreaterThan(0);
      expect(def.version).toMatch(/2026-07-30/);
    }
    const expansion = getPipelineDefinitionByCode(CRM_PIPELINE_CODE.EXPANSION);
    expect(expansion.stages[0].entryCriteria).toContain('existing_account');
    const mra = getPipelineDefinitionByCode(CRM_PIPELINE_CODE.MRA_EIS);
    expect(mra.stages[0].entryCriteria).toContain('mra_eis_context');
  });

  it('listPipelines returns all three ACTIVE pipelines from catalogue', async () => {
    const prisma = makePrisma();
    const result = await listPipelines(prisma, { admin: makeAdmin() });
    expect(result.ok).toBe(true);
    expect(result.items.map((i) => i.code).sort()).toEqual([...CRM_PIPELINE_CODES].sort());
    expect(result.meta.weightedUiEnabled).toBe(false);
    expect(result.meta.catalogueCodes).toEqual(CRM_PIPELINE_CODES);
  });
});

describe('Phase 12 Wave 4 — Opportunity duplicates', () => {
  it('detects same account / overlapping commercial / same handoff key — never auto-merge', async () => {
    const prisma = makePrisma();
    const a = seedOpp(prisma, {
      id: 'opp-a',
      accountId: 'acc-1',
      amount: '1000',
      currency: 'MWK',
      handoffIdempotencyKey: 'handoff-shared',
    });
    seedOpp(prisma, {
      id: 'opp-b',
      accountId: 'acc-1',
      amount: '1000',
      currency: 'MWK',
      handoffIdempotencyKey: 'handoff-shared',
    });

    const result = await detectOpportunityDuplicateCandidates(prisma, {
      opportunityId: a.id,
    });
    expect(result.ok).toBe(true);
    expect(result.meta.autoMerge).toBe(false);
    const types = result.items.map((i) => i.matchType).sort();
    expect(types).toContain('SAME_ACCOUNT');
    expect(types).toContain('OVERLAPPING_COMMERCIAL');
    expect(types).toContain('SAME_HANDOFF_KEY');
    expect(result.created).toBeGreaterThan(0);

    const listed = await listOpportunityDuplicateCandidates(prisma, {
      admin: makeAdmin(),
      opportunityId: a.id,
    });
    expect(listed.ok).toBe(true);
    expect(listed.meta.autoMerge).toBe(false);
    expect(listed.items.length).toBeGreaterThan(0);
  });
});

describe('Phase 12 Wave 4 — Opportunity merge SoD', () => {
  it('blocks self-approve (SOD_VIOLATION) and executes with evidence', async () => {
    const prisma = makePrisma();
    const survivor = seedOpp(prisma, { id: 'surv-opp', opportunityNumber: 'OPP-2026-000101' });
    const loser = seedOpp(prisma, { id: 'lose-opp', opportunityNumber: 'OPP-2026-000102' });
    const requester = makeAdmin('req-1');
    const approver = makeAdmin('apr-1', {
      'systemAdmin.crm.mergeLeads': true,
    });

    const req = await requestMerge(prisma, {
      admin: requester,
      entityType: CRM_MERGE_ENTITY.OPPORTUNITY,
      survivorId: survivor.id,
      loserId: loser.id,
      reason: 'duplicate commercial path',
    });
    expect(req.ok).toBe(true);
    expect(req.mergeRequest.entityType).toBe('OPPORTUNITY');
    expect(req.mergeRequest.evidence).toBeTruthy();

    const selfApprove = await approveMerge(prisma, {
      admin: requester,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(selfApprove.ok).toBe(false);
    expect(selfApprove.error).toBe('SOD_VIOLATION');

    const approved = await approveMerge(prisma, {
      admin: approver,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(approved.ok).toBe(true);

    const executed = await executeMerge(prisma, {
      admin: approver,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(executed.ok).toBe(true);
    expect(executed.evidencePreserved).toBe(true);
    expect(executed.opportunityCreated).toBe(false);
    expect(executed.provisioned).toBe(false);
    expect(executed.loser.status).toBe(CRM_OPPORTUNITY_STATUS.MERGED);
    expect(loser.mergedIntoOpportunityId).toBe(survivor.id);
  });
});

describe('Phase 12 Wave 4 — Opportunity import', () => {
  it('preview fails closed on missing currency/basis and never invents successRate', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin();
    const preview = await previewOpportunityImport(prisma, {
      admin,
      rows: [
        {
          importIdempotencyKey: 'imp-1',
          title: 'Bad amount row',
          pipelineCode: 'NEW_BUSINESS',
          stageCode: CRM_PIPELINE_STAGE.DISCOVERY,
          amount: 500,
        },
      ],
    });
    expect(preview.ok).toBe(true);
    expect(preview.honesty.inventSuccessRateForbidden).toBe(true);
    expect(preview.honesty.successRate).toBeNull();
    expect(preview.preview.invalid).toBe(1);
    const codes = preview.preview.items[0].errors.map((e) => e.code);
    expect(codes).toContain('CURRENCY_REQUIRED');
    expect(codes).toContain('AMOUNT_BASIS_REQUIRED');
  });

  it('rejects terminal CLOSED_WON / CLOSED_LOST stages (use close service)', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin();
    const preview = await previewOpportunityImport(prisma, {
      admin,
      rows: [
        {
          importIdempotencyKey: 'imp-won',
          title: 'Would-be won',
          pipelineCode: 'NEW_BUSINESS',
          stageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
        },
        {
          importIdempotencyKey: 'imp-lost',
          title: 'Would-be lost',
          pipelineCode: 'NEW_BUSINESS',
          stageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
        },
      ],
    });
    expect(preview.ok).toBe(true);
    expect(preview.preview.invalid).toBe(2);
    expect(preview.preview.valid).toBe(0);
    for (const item of preview.preview.items) {
      expect(item.ok).toBe(false);
      expect(item.wouldCreate).toBe(false);
      expect(item.errors.map((e) => e.code)).toContain('TERMINAL_STAGE_USE_CLOSE_SERVICE');
    }

    const confirm = await confirmOpportunityImport(prisma, {
      admin,
      rows: [
        {
          importIdempotencyKey: 'imp-won-confirm',
          title: 'Bypass close',
          pipelineCode: 'NEW_BUSINESS',
          stageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
        },
      ],
    });
    expect(confirm.ok).toBe(false);
    expect(confirm.error).toBe('IMPORT_VALIDATION_FAILED');
    expect(prisma._oppStore.length).toBe(0);
  });

  it('rejects EXPANSION import without accountId (existing_account)', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin();
    const preview = await previewOpportunityImport(prisma, {
      admin,
      rows: [
        {
          importIdempotencyKey: 'imp-exp-no-acct',
          title: 'Expansion without account',
          pipelineCode: CRM_PIPELINE_CODE.EXPANSION,
          stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
        },
      ],
    });
    expect(preview.ok).toBe(true);
    expect(preview.preview.invalid).toBe(1);
    expect(preview.preview.items[0].errors.map((e) => e.code)).toContain(
      'EXPANSION_ACCOUNT_REQUIRED'
    );

    const withAccount = await previewOpportunityImport(prisma, {
      admin,
      rows: [
        {
          importIdempotencyKey: 'imp-exp-ok',
          title: 'Expansion with account',
          pipelineCode: CRM_PIPELINE_CODE.EXPANSION,
          stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
          accountId: 'acc-existing-1',
        },
      ],
    });
    expect(withAccount.preview.valid).toBe(1);
    expect(withAccount.preview.items[0].ok).toBe(true);
  });

  it('confirm is idempotent and maps pipeline codes', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin();
    const rows = [
      {
        importIdempotencyKey: 'imp-ok-1',
        title: 'Imported expansion',
        pipelineCode: 'MRA_EIS',
        stageCode: CRM_PIPELINE_STAGE.OPPORTUNITY_IDENTIFIED,
        amount: 2500,
        currency: 'MWK',
        amountBasis: 'ONE_TIME',
      },
    ];

    const first = await confirmOpportunityImport(prisma, { admin, rows });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(1);
    expect(first.honesty.successRate).toBeNull();
    expect(first.items.created[0].opportunity.pipelineCode).toBe('MRA_EIS');
    expect(first.provisioned).toBe(false);

    const second = await confirmOpportunityImport(prisma, { admin, rows });
    expect(second.ok).toBe(true);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(1);
    expect(prisma._oppStore.length).toBe(1);
  });

  it('rejects invalid pipeline / stage on confirm via preview gate', async () => {
    const prisma = makePrisma();
    const result = await confirmOpportunityImport(prisma, {
      admin: makeAdmin(),
      rows: [
        {
          importIdempotencyKey: 'imp-bad',
          title: 'Bad',
          pipelineCode: 'NOT_A_PIPELINE',
          stageCode: 'NOPE',
        },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('IMPORT_VALIDATION_FAILED');
  });
});

describe('Phase 12 Wave 4 — Pipeline reports + schedules', () => {
  it('returns EMPTY envelope without inventing zeroes', async () => {
    const prisma = makePrisma();
    const result = await getPipelineReport(prisma, { admin: makeAdmin() });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('EMPTY');
    expect(result.report.winCount).toBeNull();
    expect(result.report.openCount).toBeNull();
    expect(result.honesty.inventZeroesForbidden).toBe(true);
    expect(result.honesty.falseZeroes).toBe(false);
    expect(result.honesty.weightedUiEnabled).toBe(false);
  });

  it('separates open pipeline by currency; weighted unlock is indicative not Revenue', async () => {
    const prisma = makePrisma();
    seedOpp(prisma, {
      amount: '100',
      currency: 'MWK',
      probability: 50,
      status: CRM_OPPORTUNITY_STATUS.OPEN,
      stageCode: CRM_PIPELINE_STAGE.DISCOVERY,
    });
    seedOpp(prisma, {
      amount: '50',
      currency: 'USD',
      probability: 40,
      status: CRM_OPPORTUNITY_STATUS.OPEN,
      stageCode: CRM_PIPELINE_STAGE.NEED_CONFIRMED,
    });
    seedOpp(prisma, {
      status: CRM_OPPORTUNITY_STATUS.WON,
      stageCode: CRM_PIPELINE_STAGE.CLOSED_WON,
    });
    seedOpp(prisma, {
      status: CRM_OPPORTUNITY_STATUS.LOST,
      stageCode: CRM_PIPELINE_STAGE.CLOSED_LOST,
    });

    const result = await getPipelineReport(prisma, { admin: makeAdmin() });
    expect(result.ok).toBe(true);
    expect(result.status).toBe('READY');
    expect(result.report.winCount).toBe(1);
    expect(result.report.lossCount).toBe(1);
    expect(result.report.openCount).toBe(2);
    expect(result.report.openPipelineByCurrency.ok).toBe(true);
    expect(result.report.openPipelineByCurrency.grandTotal).toBeNull();
    expect(result.report.openPipelineByCurrency.fxConverted).toBe(false);
    expect(result.report.openPipelineByCurrency.totalsByCurrency.MWK).toBe(100);
    expect(result.report.openPipelineByCurrency.totalsByCurrency.USD).toBe(50);
    // Phase 16: honesty+currency gates unlock indicative weighted by currency — never Revenue / silent FX sum
    expect(result.honesty.weightedUiEnabled).toBe(true);
    expect(result.honesty.isRevenue).toBe(false);
    expect(result.report.weightedTotals.isRevenue).toBe(false);
    expect(result.report.weightedTotals.isIndicativeOnly).toBe(true);
    expect(result.report.weightedTotals.grandTotal).toBeNull();
    expect(result.report.weightedTotals.fxConverted).toBe(false);
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
  });

  it('creates and runs audited report schedules', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin();
    const created = await createPipelineReportSchedule(prisma, {
      admin,
      name: 'Weekly pipeline',
      pipelineCode: CRM_PIPELINE_CODE.NEW_BUSINESS,
      cronExpression: '0 8 * * 1',
    });
    expect(created.ok).toBe(true);
    expect(created.meta.audited).toBe(true);
    expect(created.meta.weightedUiEnabled).toBe(false);

    const listed = await listPipelineReportSchedules(prisma, { admin });
    expect(listed.ok).toBe(true);
    expect(listed.items.length).toBe(1);

    const run = await runPipelineReportSchedule(prisma, {
      admin,
      scheduleId: created.schedule.id,
    });
    expect(run.ok).toBe(true);
    expect(run.run).toBeTruthy();
    expect(run.run.status).toBe('EMPTY');
    expect(run.meta.audited).toBe(true);
  });
});

describe('Phase 12 Wave 4 — Weighted + foundations', () => {
  it('keeps weighted helper available but UI flag OFF', () => {
    expect(WEIGHTED_PIPELINE_UI_ENABLED).toBe(true);
    const w = computeIndicativeWeightedAmount({
      amount: 1000,
      probability: 50,
      currency: 'MWK',
    });
    expect(w.ok).toBe(true);
    expect(w.weightedUiEnabled).toBe(false);
    expect(w.isRevenue).toBe(false);
  });

  it('upgrades Opportunity import/reporting/pipeline foundations to READY', async () => {
    const result = await getCrmFoundations({}, { admin: makeAdmin() });
    expect(result.ok).toBe(true);
    const byKind = Object.fromEntries(result.items.map((i) => [i.kind, i]));
    expect(byKind.IMPORT.status).toBe('READY');
    expect(byKind.REPORTING.status).toBe('READY');
    expect(byKind.OPPORTUNITY_PIPELINE.status).toBe('READY');
    expect(byKind.EMAIL_INGEST.status).toBe('NOT_AVAILABLE');
    expect(byKind.WHATSAPP_INGEST.status).toBe('NOT_AVAILABLE');
    expect(result.meta.weightedUiEnabled).toBe(false);
    expect(result.meta.pipelines).toEqual([...CRM_PIPELINE_CODES]);
  });
});
