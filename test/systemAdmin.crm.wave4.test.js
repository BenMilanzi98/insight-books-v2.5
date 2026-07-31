/**
 * Phase 11 Wave 4 — timeline / notes / tasks / merge SoD / opportunity readiness.
 * Never creates Opportunity. Keep Waves 1–3 contracts intact.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  CRM_LEAD_STATUS,
  CRM_MERGE_STATUS,
  CRM_NOTE_VISIBILITY,
  CRM_READINESS_STATUS,
  CRM_TASK_STATUS,
  appendTimelineEvent,
  listTimeline,
  createNote,
  listNotes,
  projectNotesForViewer,
  createTask,
  completeTask,
  requestMerge,
  approveMerge,
  executeMerge,
  evaluateOpportunityReadiness,
  assertNoOpportunityCreate,
  getCrmFoundations,
  applyCrmReconHonesty,
  CRM_RELIABILITY_STATUS,
} from '@/lib/admin/crm';

function makeAdmin(id, crmPerms = {}, role = 'Platform Support') {
  return {
    id,
    role,
    permissions: {
      systemAdmin: {
        crm: { ...crmPerms },
      },
    },
  };
}

function superAdmin(id = 'super-1') {
  return { id, role: 'Super Admin', permissions: {} };
}

function makePrisma(overrides = {}) {
  const leadStore = overrides._leadStore || [];
  const historyStore = overrides._historyStore || [];
  const timelineStore = overrides._timelineStore || [];
  const noteStore = overrides._noteStore || [];
  const taskStore = overrides._taskStore || [];
  const mergeStore = overrides._mergeStore || [];
  const dupStore = overrides._duplicateStore || [];
  const qualStore = overrides._qualStore || [];
  const scoreStore = overrides._scoreStore || [];
  const consentStore = overrides._consentStore || [];
  const dncStore = overrides._dncStore || [];

  const prisma = {
    crmLead: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return leadStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = leadStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      count: vi.fn(async () => leadStore.length),
    },
    crmLeadStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `hist-${historyStore.length + 1}`, ...data };
        historyStore.push(row);
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        return historyStore.filter((h) => !where.leadId || h.leadId === where.leadId)
          .length;
      }),
      findMany: vi.fn(async () => [...historyStore]),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `tl-${timelineStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          ...data,
        };
        timelineStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip, cursor, orderBy } = {}) => {
        let rows = [...timelineStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        if (orderBy?.at === 'desc') {
          rows.sort((a, b) => new Date(b.at) - new Date(a.at));
        }
        let start = 0;
        if (cursor?.id) {
          const idx = rows.findIndex((r) => r.id === cursor.id);
          start = idx >= 0 ? idx + 1 : 0;
        }
        if (typeof skip === 'number') start += skip;
        const limit = typeof take === 'number' ? take : rows.length;
        return rows.slice(start, start + limit);
      }),
    },
    crmNote: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `note-${noteStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        noteStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {}, take, skip } = {}) => {
        let rows = [...noteStore];
        if (where.subjectType) rows = rows.filter((r) => r.subjectType === where.subjectType);
        if (where.subjectId) rows = rows.filter((r) => r.subjectId === where.subjectId);
        rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const start = typeof skip === 'number' ? skip : 0;
        return rows.slice(start, start + (take || rows.length));
      }),
    },
    crmTask: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `task-${taskStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        taskStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return taskStore.find((r) => r.id === where.id) || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = taskStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...taskStore]),
    },
    crmMergeRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: `merge-${mergeStore.length + 1}`,
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
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = mergeStore.find((r) => r.id === where.id);
        Object.assign(row, data);
        return row;
      }),
      findMany: vi.fn(async () => [...mergeStore]),
    },
    crmDuplicateCandidate: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...dupStore];
        if (where.OR) {
          rows = rows.filter((r) =>
            where.OR.some((clause) => {
              if (clause.leadId) return r.leadId === clause.leadId;
              if (clause.candidateLeadId) return r.candidateLeadId === clause.candidateLeadId;
              return false;
            })
          );
        }
        if (where.status?.in) {
          const set = new Set(where.status.in);
          rows = rows.filter((r) => set.has(r.status));
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = dupStore.find((r) => r.id === where.id);
        if (row) Object.assign(row, data);
        return row;
      }),
    },
    crmQualificationResponse: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return qualStore.filter(
          (r) =>
            (!where.leadId || r.leadId === where.leadId) &&
            (!where.definitionVersionId ||
              r.definitionVersionId === where.definitionVersionId)
        );
      }),
    },
    crmScoreEvaluation: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        const rows = scoreStore.filter((r) => !where.leadId || r.leadId === where.leadId);
        return rows[0] || null;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        return scoreStore.filter((r) => !where.leadId || r.leadId === where.leadId).length;
      }),
    },
    crmConsentRecord: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `c-${consentStore.length + 1}`, ...data };
        consentStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        const key = where.contactId_purpose;
        if (!key) return null;
        return (
          consentStore.find(
            (r) => r.contactId === key.contactId && r.purpose === key.purpose
          ) || null
        );
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          consentStore.find(
            (r) =>
              (!where.contactId || r.contactId === where.contactId) &&
              (!where.purpose || r.purpose === where.purpose)
          ) || null
        );
      }),
    },
    crmDoNotContact: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `dnc-${dncStore.length + 1}`, ...data };
        dncStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return dncStore.filter(
          (r) =>
            (!where.contactId || r.contactId === where.contactId) &&
            (where.active === undefined || r.active === where.active)
        );
      }),
    },
    crmCommunicationPreference: {
      findMany: vi.fn(async () => []),
    },
    _stores: {
      leadStore,
      historyStore,
      timelineStore,
      noteStore,
      taskStore,
      mergeStore,
      dupStore,
      qualStore,
      scoreStore,
      consentStore,
    },
  };

  return prisma;
}

describe('CRM Wave 4 — timeline pagination', () => {
  it('pages timeline events with limit/offset', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    for (let i = 0; i < 5; i += 1) {
      await appendTimelineEvent(prisma, {
        subjectType: 'LEAD',
        subjectId: 'lead-1',
        eventType: 'SYSTEM',
        summary: `event-${i}`,
        actorAdminId: admin.id,
        at: new Date(Date.UTC(2026, 6, 30, 12, i)),
      });
    }

    const page1 = await listTimeline(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      limit: 2,
      offset: 0,
    });
    expect(page1.ok).toBe(true);
    expect(page1.items).toHaveLength(2);
    expect(page1.meta.limit).toBe(2);

    const page2 = await listTimeline(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      limit: 2,
      offset: 2,
    });
    expect(page2.items).toHaveLength(2);
    expect(page2.items[0].id).not.toBe(page1.items[0].id);
  });
});

describe('CRM Wave 4 — notes restricted projection', () => {
  it('omits RESTRICTED notes for viewers without restricted permission', async () => {
    const prisma = makePrisma();
    const editor = makeAdmin('ed-1', { viewLeads: true, editLeads: true });
    const viewer = makeAdmin('vw-1', { viewLeads: true });

    await createNote(prisma, {
      admin: editor,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      body: 'internal ok',
      visibility: CRM_NOTE_VISIBILITY.INTERNAL,
    });

    const restrictedAdmin = superAdmin('sec-1');
    await createNote(prisma, {
      admin: restrictedAdmin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      body: 'secret restricted',
      visibility: CRM_NOTE_VISIBILITY.RESTRICTED,
    });

    const listed = await listNotes(prisma, {
      admin: viewer,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
    });
    expect(listed.ok).toBe(true);
    expect(listed.items.every((n) => n.visibility !== CRM_NOTE_VISIBILITY.RESTRICTED)).toBe(
      true
    );
    expect(listed.items.some((n) => n.body === 'internal ok')).toBe(true);

    const projected = projectNotesForViewer(
      [
        { visibility: 'INTERNAL', body: 'a' },
        { visibility: 'RESTRICTED', body: 'b' },
      ],
      { canViewRestricted: false, mode: 'omit' }
    );
    expect(projected).toHaveLength(1);
  });
});

describe('CRM Wave 4 — tasks TODO→COMPLETED', () => {
  it('completes a TODO task', async () => {
    const prisma = makePrisma();
    const admin = makeAdmin('ed-1', { viewLeads: true, editLeads: true });
    const created = await createTask(prisma, {
      admin,
      subjectType: 'LEAD',
      subjectId: 'lead-1',
      title: 'Call prospect',
    });
    expect(created.ok).toBe(true);
    expect(created.task.status).toBe(CRM_TASK_STATUS.TODO);

    const done = await completeTask(prisma, { admin, taskId: created.task.id });
    expect(done.ok).toBe(true);
    expect(done.task.status).toBe(CRM_TASK_STATUS.COMPLETED);
  });
});

describe('CRM Wave 4 — merge SoD + evidence', () => {
  let prisma;
  beforeEach(() => {
    prisma = makePrisma({
      _leadStore: [
        {
          id: 'surv-1',
          leadNumber: 'LEAD-2026-000001',
          status: CRM_LEAD_STATUS.QUALIFIED,
          source: 'MANUAL',
          sourceIdempotencyKey: 'surv-key',
          accountId: 'acc-1',
          contactId: 'con-1',
          title: 'Survivor',
        },
        {
          id: 'lose-1',
          leadNumber: 'LEAD-2026-000002',
          status: CRM_LEAD_STATUS.NEW,
          source: 'WEB_FORM',
          sourceIdempotencyKey: 'lose-key',
          accountId: null,
          contactId: null,
          title: 'Loser',
        },
      ],
      _duplicateStore: [
        {
          id: 'dup-1',
          leadId: 'surv-1',
          candidateLeadId: 'lose-1',
          status: 'LIKELY_DUPLICATE',
          confidence: 'HIGH',
        },
      ],
    });
  });

  it('blocks self-approval (requester ≠ approver)', async () => {
    const requester = makeAdmin('req-1', {
      viewLeads: true,
      editLeads: true,
      mergeLeads: true,
    });
    const req = await requestMerge(prisma, {
      admin: requester,
      survivorId: 'surv-1',
      loserId: 'lose-1',
      reason: 'same company',
    });
    expect(req.ok).toBe(true);
    expect(req.mergeRequest.status).toBe(CRM_MERGE_STATUS.PENDING);
    expect(req.mergeRequest.evidence?.preservedIds?.loserLeadId).toBe('lose-1');

    const selfApprove = await approveMerge(prisma, {
      admin: requester,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(selfApprove.ok).toBe(false);
    expect(selfApprove.error).toBe('SOD_VIOLATION');
  });

  it('executes merge with evidence preserved and no Opportunity', async () => {
    const requester = makeAdmin('req-1', { viewLeads: true, editLeads: true });
    const approver = makeAdmin('apr-1', { viewLeads: true, mergeLeads: true });

    const req = await requestMerge(prisma, {
      admin: requester,
      survivorId: 'surv-1',
      loserId: 'lose-1',
    });
    const appr = await approveMerge(prisma, {
      admin: approver,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(appr.ok).toBe(true);

    const exec = await executeMerge(prisma, {
      admin: approver,
      mergeRequestId: req.mergeRequest.id,
    });
    expect(exec.ok).toBe(true);
    expect(exec.opportunityCreated).toBe(false);
    expect(exec.evidencePreserved).toBe(true);
    expect(exec.loser.status).toBe(CRM_LEAD_STATUS.MERGED);
    expect(prisma._stores.leadStore.find((l) => l.id === 'lose-1').mergedIntoLeadId).toBe(
      'surv-1'
    );
    expect(prisma._stores.historyStore.some((h) => h.toStatus === 'MERGED')).toBe(true);
  });
});

describe('CRM Wave 4 — opportunity readiness (no Opportunity create)', () => {
  it('returns READY handoff without creating Opportunity', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-ready',
          leadNumber: 'LEAD-2026-000010',
          status: CRM_LEAD_STATUS.QUALIFIED,
          source: 'REQUEST_DEMO',
          channel: 'WEB_FORM',
          accountId: 'acc-1',
          contactId: 'con-1',
          title: 'Ready lead',
        },
      ],
      _qualStore: [
        {
          leadId: 'lead-ready',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'FIT',
          state: 'YES',
        },
        {
          leadId: 'lead-ready',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'NEED',
          state: 'YES',
        },
      ],
      _scoreStore: [
        {
          id: 'eval-1',
          leadId: 'lead-ready',
          definitionVersionId: 'score-lead-fit-v1',
          createdAt: new Date(),
        },
      ],
      _consentStore: [
        {
          contactId: 'con-1',
          purpose: 'SALES_CONTACT',
          status: 'GRANTED',
        },
      ],
    });

    const admin = superAdmin();
    const result = await evaluateOpportunityReadiness(prisma, {
      admin,
      leadId: 'lead-ready',
    });

    expect(result.ok).toBe(true);
    expect(result.readinessStatus).toBe(CRM_READINESS_STATUS.READY);
    expect(result.opportunityCreated).toBe(false);
    expect(result.handoffPayload.opportunityId).toBeNull();
    expect(result.handoffPayload.opportunityCreated).toBe(false);
    expect(result.handoffPayload.leadId).toBe('lead-ready');
    expect(result.handoffPayload.idempotencyKey).toContain('opp-ready:lead-ready');
    expect(assertNoOpportunityCreate(result)).toBe(true);
  });

  it('UNKNOWN consent blocks READY', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-unk',
          leadNumber: 'LEAD-2026-000011',
          status: CRM_LEAD_STATUS.QUALIFIED,
          accountId: 'acc-1',
          contactId: 'con-2',
          source: 'MANUAL',
          title: 'Unknown consent',
        },
      ],
      _qualStore: [
        {
          leadId: 'lead-unk',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'FIT',
          state: 'YES',
        },
      ],
    });

    const result = await evaluateOpportunityReadiness(prisma, {
      admin: superAdmin(),
      leadId: 'lead-unk',
    });
    expect(result.ok).toBe(true);
    expect(result.readinessStatus).not.toBe(CRM_READINESS_STATUS.READY);
    expect(result.checklist.find((c) => c.key === 'consent_eligibility')?.ok).toBe(false);
    expect(result.opportunityCreated).toBe(false);
  });

  it('EXPIRED consent and DNC block READY (eligibilityOk gate)', async () => {
    const expiredPrisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-exp',
          leadNumber: 'LEAD-2026-000012',
          status: CRM_LEAD_STATUS.QUALIFIED,
          accountId: 'acc-1',
          contactId: 'con-exp',
          source: 'MANUAL',
          title: 'Expired consent',
        },
      ],
      _qualStore: [
        {
          leadId: 'lead-exp',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'FIT',
          state: 'YES',
        },
      ],
      _consentStore: [
        { contactId: 'con-exp', purpose: 'SALES_CONTACT', status: 'EXPIRED' },
      ],
    });

    const expired = await evaluateOpportunityReadiness(expiredPrisma, {
      admin: superAdmin(),
      leadId: 'lead-exp',
    });
    expect(expired.ok).toBe(true);
    expect(expired.readinessStatus).not.toBe(CRM_READINESS_STATUS.READY);
    expect(expired.checklist.find((c) => c.key === 'consent_eligibility')?.ok).toBe(false);
    expect(expired.checklist.find((c) => c.key === 'consent_eligibility')?.detail).toMatch(
      /EXPIRED|not_eligible|consent_expired/i
    );

    const dncPrisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-dnc',
          leadNumber: 'LEAD-2026-000013',
          status: CRM_LEAD_STATUS.QUALIFIED,
          accountId: 'acc-1',
          contactId: 'con-dnc',
          source: 'MANUAL',
          title: 'DNC blocked',
        },
      ],
      _qualStore: [
        {
          leadId: 'lead-dnc',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'FIT',
          state: 'YES',
        },
      ],
      _consentStore: [
        { contactId: 'con-dnc', purpose: 'SALES_CONTACT', status: 'GRANTED' },
      ],
      _dncStore: [
        { contactId: 'con-dnc', flag: 'DO_NOT_CONTACT_ALL', active: true },
      ],
    });

    const dnc = await evaluateOpportunityReadiness(dncPrisma, {
      admin: superAdmin(),
      leadId: 'lead-dnc',
    });
    expect(dnc.ok).toBe(true);
    expect(dnc.readinessStatus).not.toBe(CRM_READINESS_STATUS.READY);
    expect(dnc.checklist.find((c) => c.key === 'consent_eligibility')?.ok).toBe(false);
    expect(dnc.opportunityCreated).toBe(false);
  });

  it('handoff omits invented scoreVersionId when no evaluation exists', async () => {
    const prisma = makePrisma({
      _leadStore: [
        {
          id: 'lead-noscore',
          leadNumber: 'LEAD-2026-000014',
          status: CRM_LEAD_STATUS.QUALIFIED,
          accountId: 'acc-1',
          contactId: 'con-ns',
          source: 'MANUAL',
          title: 'No score',
        },
      ],
      _qualStore: [
        {
          leadId: 'lead-noscore',
          definitionVersionId: 'qual-small-business-standard-v1',
          criterionKey: 'FIT',
          state: 'YES',
        },
      ],
      _consentStore: [
        { contactId: 'con-ns', purpose: 'SALES_CONTACT', status: 'GRANTED' },
      ],
    });

    const result = await evaluateOpportunityReadiness(prisma, {
      admin: superAdmin(),
      leadId: 'lead-noscore',
    });
    expect(result.ok).toBe(true);
    expect(result.handoffPayload.scoreEvaluationId).toBeNull();
    expect(result.handoffPayload.scoreVersionId).toBeNull();
    expect(result.handoffPayload.idempotencyKey).toContain(':none');
  });
});

describe('CRM Wave 4 — foundations + recon honesty', () => {
  it('reports import/reporting READY (Wave 4) and Email/WhatsApp NOT_AVAILABLE', async () => {
    const result = await getCrmFoundations({}, { admin: superAdmin() });
    expect(result.ok).toBe(true);
    const byKind = Object.fromEntries(result.items.map((i) => [i.kind, i]));
    expect(byKind.IMPORT.status).toBe('READY');
    expect(byKind.EMAIL_INGEST.status).toBe('NOT_AVAILABLE');
    expect(byKind.WHATSAPP_INGEST.status).toBe('NOT_AVAILABLE');
    expect(byKind.OPPORTUNITY_PIPELINE.opportunityId).toBeNull();
    expect(byKind.OPPORTUNITY_PIPELINE.status).toBe('READY');
  });

  it('recon honesty nulls KPIs on failure', () => {
    const honesty = applyCrmReconHonesty({
      status: CRM_RELIABILITY_STATUS.RECONCILIATION_FAILED,
      reconOk: false,
      leadCount: 0,
    });
    expect(honesty.kpiSafe).toBe(false);
    expect(honesty.leadCount).toBeNull();
  });
});
