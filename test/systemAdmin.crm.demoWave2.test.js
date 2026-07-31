/**
 * Phase 14 Wave 2 — Agenda / Script / Scenario / Content versioning.
 * ACTIVE immutable in place; SoD approve; restricted Script never on Customer/invitation;
 * Demo pins version ids historically.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  CRM_DEMO_VERSION_STATUS,
  CRM_DEMO_CONTENT_CLASSIFICATION,
  CRM_DEMO_CONTENT_KIND,
  CRM_DEMO_PROJECTION_SURFACE,
  createAgendaVersion,
  updateAgendaVersion,
  requestAgendaApproval,
  approveAgendaVersion,
  pinAgendaToDemo,
  projectAgendaForSurface,
  createScriptVersion,
  updateScriptVersion,
  requestScriptApproval,
  approveScriptVersion,
  pinScriptToDemo,
  projectScriptForSurface,
  createScenarioVersion,
  approveScenarioVersion,
  requestScenarioApproval,
  pinScenarioToDemo,
  createContentVersion,
  requestContentApproval,
  approveContentVersion,
  pinContentToDemo,
  createDemo,
  getDemo,
  evaluateDemoReadiness,
  getDemoDomainContract,
} from '@/lib/admin/crm';

function makeAdmin(id, crmPerms = {}, role = 'Platform Support') {
  return {
    id,
    role,
    permissions: {
      systemAdmin: {
        crm: {
          view: true,
          viewLeads: true,
          editLeads: true,
          mergeLeads: true,
          activities: { view: true, edit: true },
          opportunities: { view: true, edit: true },
          ...crmPerms,
        },
      },
    },
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const demoStore = overrides._demoStore || [];
  const agendaStore = overrides._agendaStore || [];
  const scriptStore = overrides._scriptStore || [];
  const scenarioStore = overrides._scenarioStore || [];
  const contentStore = overrides._contentStore || [];
  const timelineStore = overrides._timelineStore || [];
  const demoParticipantStore = overrides._demoParticipantStore || [];
  const meetingStore = overrides._meetingStore || [];
  const calendarStore = overrides._calendarStore || [];

  const versionCrud = (store, prefix) => ({
    findUnique: vi.fn(async ({ where = {} } = {}) => {
      if (where.id) return store.find((r) => r.id === where.id) || null;
      if (where.code_version) {
        return (
          store.find(
            (r) =>
              r.code === where.code_version.code &&
              r.version === where.code_version.version
          ) || null
        );
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {}, orderBy } = {}) => {
      let rows = [...store];
      if (where.code) rows = rows.filter((r) => r.code === where.code);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (orderBy?.version === 'desc') rows.sort((a, b) => b.version - a.version);
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {}, take, orderBy } = {}) => {
      let rows = [...store];
      if (where.code) rows = rows.filter((r) => r.code === where.code);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (orderBy?.[0]?.version === 'desc' || orderBy?.version === 'desc') {
        rows.sort((a, b) => b.version - a.version);
      }
      if (typeof take === 'number') rows = rows.slice(0, take);
      return rows;
    }),
    create: vi.fn(async ({ data }) => {
      const row = {
        id: data.id || `${prefix}-${store.length + 1}`,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        approvedAt: data.approvedAt ?? null,
        approvedByAdminId: data.approvedByAdminId ?? null,
        ...data,
      };
      store.push(row);
      return row;
    }),
    update: vi.fn(async ({ where, data }) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    updateMany: vi.fn(async ({ where, data }) => {
      let count = 0;
      for (const row of store) {
        if (where.code && row.code !== where.code) continue;
        if (where.status && row.status !== where.status) continue;
        Object.assign(row, data);
        count += 1;
      }
      return { count };
    }),
  });

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _agendaStore: agendaStore,
    _scriptStore: scriptStore,
    _scenarioStore: scenarioStore,
    _contentStore: contentStore,
    _demoStore: demoStore,
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
    crmDemoAgenda: versionCrud(agendaStore, 'agenda'),
    crmDemoScript: versionCrud(scriptStore, 'script'),
    crmDemoScenario: versionCrud(scenarioStore, 'scenario'),
    crmDemoContent: versionCrud(contentStore, 'content'),
    crmDemo: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return demoStore.find((r) => r.id === where.id) || null;
        if (where.demoNumber) {
          return demoStore.find((r) => r.demoNumber === where.demoNumber) || null;
        }
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `demo-${demoStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          readinessStatus: data.readinessStatus || 'NOT_READY',
          readinessJson: data.readinessJson ?? null,
          pinnedAgendaId: data.pinnedAgendaId ?? null,
          pinnedScriptId: data.pinnedScriptId ?? null,
          pinnedScenarioId: data.pinnedScenarioId ?? null,
          pinnedContentId: data.pinnedContentId ?? null,
          ...data,
        };
        demoStore.push(row);
        return row;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = demoStore.find((r) => r.id === where.id);
        if (!row) throw Object.assign(new Error('not found'), { code: 'P2025' });
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async () => [...demoStore]),
    },
    crmDemoParticipant: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...demoParticipantStore];
        if (where.demoId) rows = rows.filter((r) => r.demoId === where.demoId);
        return rows;
      }),
    },
    crmMeeting: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        return meetingStore.find((r) => r.id === where.id) || null;
      }),
    },
    crmCalendarEvent: {
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...calendarStore];
        if (where.meetingId) rows = rows.filter((r) => r.meetingId === where.meetingId);
        return rows;
      }),
    },
    crmTimelineEvent: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `tl-${timelineStore.length + 1}`, ...data };
        timelineStore.push(row);
        return row;
      }),
    },
  };

  return prisma;
}

async function activateAgenda(prisma, author, approver, fields = {}) {
  const created = await createAgendaVersion(prisma, {
    admin: author,
    code: fields.code || 'STD_AGENDA',
    name: fields.name || 'Standard Agenda',
    itemsJson: fields.itemsJson || [{ title: 'Intro', minutes: 5 }],
    customerSafeSummary: fields.customerSafeSummary || 'Intro and product walkthrough',
  });
  expect(created.ok).toBe(true);
  await requestAgendaApproval(prisma, { admin: author, agendaId: created.agenda.id });
  const approved = await approveAgendaVersion(prisma, {
    admin: approver,
    agendaId: created.agenda.id,
  });
  expect(approved.ok).toBe(true);
  return approved.agenda;
}

async function activateScript(prisma, author, approver, fields = {}) {
  const created = await createScriptVersion(prisma, {
    admin: author,
    code: fields.code || 'STD_SCRIPT',
    name: fields.name || 'Standard Script',
    classification: fields.classification || CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL,
    bodyInternal: fields.bodyInternal || 'Internal talking track',
    bodyCustomerSafe: fields.bodyCustomerSafe || 'Customer-safe talking points',
    labelsJson: fields.labelsJson || {
      en: { opener: 'Welcome' },
      ny: { opener: 'Takulandirani' },
    },
  });
  expect(created.ok).toBe(true);
  await requestScriptApproval(prisma, { admin: author, scriptId: created.script.id });
  const approved = await approveScriptVersion(prisma, {
    admin: approver,
    scriptId: created.script.id,
  });
  expect(approved.ok).toBe(true);
  return approved.script;
}

describe('Phase 14 Wave 2 — Agenda versioning + SoD', () => {
  it('creates versions; ACTIVE not directly editable; SoD blocks self-approve', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('author-1');
    const approver = makeAdmin('approver-1');

    const created = await createAgendaVersion(prisma, {
      admin: author,
      code: 'AGENDA_A',
      name: 'Agenda A',
      itemsJson: [{ title: 'Welcome', minutes: 3 }],
      customerSafeSummary: 'Welcome and overview',
    });
    expect(created.ok).toBe(true);
    expect(created.agenda.status).toBe(CRM_DEMO_VERSION_STATUS.DRAFT);
    expect(created.agenda.activeDirectlyEditable).toBe(false);
    expect(created.meta.sodRequired).toBe(true);

    const selfReq = await requestAgendaApproval(prisma, {
      admin: author,
      agendaId: created.agenda.id,
    });
    expect(selfReq.ok).toBe(true);
    expect(selfReq.agenda.status).toBe(CRM_DEMO_VERSION_STATUS.PENDING_APPROVAL);

    const selfApprove = await approveAgendaVersion(prisma, {
      admin: author,
      agendaId: created.agenda.id,
    });
    expect(selfApprove.ok).toBe(false);
    expect(selfApprove.error).toBe('demo_content_self_approval_blocked');

    const approved = await approveAgendaVersion(prisma, {
      admin: approver,
      agendaId: created.agenda.id,
    });
    expect(approved.ok).toBe(true);
    expect(approved.agenda.status).toBe(CRM_DEMO_VERSION_STATUS.ACTIVE);

    const blocked = await updateAgendaVersion(prisma, {
      admin: author,
      agendaId: created.agenda.id,
      patch: { name: 'Changed' },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('active_demo_content_not_directly_editable');

    const v2 = await createAgendaVersion(prisma, {
      admin: author,
      code: 'AGENDA_A',
      name: 'Agenda A v2',
      itemsJson: [{ title: 'Welcome', minutes: 4 }],
      customerSafeSummary: 'Updated welcome',
    });
    expect(v2.ok).toBe(true);
    expect(v2.agenda.version).toBe(2);

    await requestAgendaApproval(prisma, { admin: author, agendaId: v2.agenda.id });
    await approveAgendaVersion(prisma, { admin: approver, agendaId: v2.agenda.id });

    const prior = prisma._agendaStore.find((r) => r.id === created.agenda.id);
    expect(prior.status).toBe(CRM_DEMO_VERSION_STATUS.RETIRED);
  });

  it('rejects executable template expressions in agenda text', async () => {
    const prisma = makePrisma();
    const bad = await createAgendaVersion(prisma, {
      admin: makeAdmin('a1'),
      code: 'BAD_AGENDA',
      customerSafeSummary: '${process.env.SECRET}',
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe('executable_template_expressions_forbidden');
  });
});

describe('Phase 14 Wave 2 — Script restricted projection + en/ny', () => {
  it('never exposes RESTRICTED script on Customer/invitation surfaces', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('author-s');
    const approver = makeAdmin('approver-s');

    const script = await activateScript(prisma, author, approver, {
      code: 'RESTRICTED_SCRIPT',
      classification: CRM_DEMO_CONTENT_CLASSIFICATION.RESTRICTED,
      bodyInternal: 'Never show externally',
      bodyCustomerSafe: 'Should not leak via restricted class',
      labelsJson: {
        en: { tip: 'Internal tip' },
        ny: { tip: 'Uthenga wa mkati' },
      },
    });
    expect(script.classification).toBe(CRM_DEMO_CONTENT_CLASSIFICATION.RESTRICTED);
    expect(script.labelsJson.en.tip).toBe('Internal tip');
    expect(script.labelsJson.ny.tip).toBe('Uthenga wa mkati');

    const customer = projectScriptForSurface(script, {
      surface: CRM_DEMO_PROJECTION_SURFACE.CUSTOMER,
    });
    expect(customer.ok).toBe(true);
    expect(customer.allowed).toBe(false);
    expect(customer.script).toBeNull();
    expect(customer.reason).toBe('restricted_script_forbidden_on_customer_surface');

    const invitation = projectScriptForSurface(script, {
      surface: CRM_DEMO_PROJECTION_SURFACE.INVITATION,
    });
    expect(invitation.allowed).toBe(false);
    expect(invitation.script).toBeNull();

    const internal = projectScriptForSurface(script, {
      surface: CRM_DEMO_PROJECTION_SURFACE.INTERNAL,
      canViewRestricted: true,
    });
    expect(internal.allowed).toBe(true);
    expect(internal.script.bodyInternal).toBe('Never show externally');

    const internalNoPriv = projectScriptForSurface(script, {
      surface: CRM_DEMO_PROJECTION_SURFACE.INTERNAL,
      canViewRestricted: false,
    });
    expect(internalNoPriv.allowed).toBe(false);
  });

  it('projects customer-safe script bodies for CUSTOMER surface', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('author-cs');
    const approver = makeAdmin('approver-cs');
    const script = await activateScript(prisma, author, approver, {
      code: 'SAFE_SCRIPT',
      classification: CRM_DEMO_CONTENT_CLASSIFICATION.CUSTOMER_SAFE,
      bodyInternal: 'Internal only',
      bodyCustomerSafe: 'Safe talking points',
    });

    const projected = projectScriptForSurface(script, {
      surface: CRM_DEMO_PROJECTION_SURFACE.CUSTOMER,
    });
    expect(projected.allowed).toBe(true);
    expect(projected.script.bodyCustomerSafe).toBe('Safe talking points');
    expect(projected.script.bodyInternal).toBeUndefined();
  });

  it('blocks direct ACTIVE script edit; create new version instead', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('a1');
    const approver = makeAdmin('a2');
    const script = await activateScript(prisma, author, approver, { code: 'EDIT_SCRIPT' });

    const blocked = await updateScriptVersion(prisma, {
      admin: author,
      scriptId: script.id,
      patch: { bodyInternal: 'changed' },
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toBe('active_demo_content_not_directly_editable');
  });
});

describe('Phase 14 Wave 2 — Scenario / Content versioning + Demo pins', () => {
  it('pins ACTIVE agenda/script/scenario/content ids; historical pin retained', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('pin-author');
    const approver = makeAdmin('pin-approver');

    const demoCreated = await createDemo(prisma, {
      admin: author,
      title: 'Pin Demo',
      contactId: 'con-1',
    });
    expect(demoCreated.ok).toBe(true);
    const demoId = demoCreated.demo.id;

    const agenda = await activateAgenda(prisma, author, approver, { code: 'PIN_AGENDA' });
    const script = await activateScript(prisma, author, approver, {
      code: 'PIN_SCRIPT',
      classification: CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL,
    });

    const scenarioDraft = await createScenarioVersion(prisma, {
      admin: author,
      code: 'PIN_SCENARIO',
      name: 'Retail walkthrough',
      bodyJson: { steps: ['login', 'sale'] },
    });
    await requestScenarioApproval(prisma, {
      admin: author,
      scenarioId: scenarioDraft.scenario.id,
    });
    const scenario = (
      await approveScenarioVersion(prisma, {
        admin: approver,
        scenarioId: scenarioDraft.scenario.id,
      })
    ).scenario;

    const contentDraft = await createContentVersion(prisma, {
      admin: author,
      code: 'PIN_CONTENT',
      name: 'Slide pack',
      kind: CRM_DEMO_CONTENT_KIND.SLIDE_PACK,
      assetRef: 'slides/retail-v1',
      classification: CRM_DEMO_CONTENT_CLASSIFICATION.INTERNAL,
    });
    await requestContentApproval(prisma, {
      admin: author,
      contentId: contentDraft.content.id,
    });
    const content = (
      await approveContentVersion(prisma, {
        admin: approver,
        contentId: contentDraft.content.id,
      })
    ).content;

    const pinA = await pinAgendaToDemo(prisma, {
      admin: author,
      demoId,
      agendaId: agenda.id,
    });
    expect(pinA.ok).toBe(true);
    expect(pinA.demo.pinnedAgendaId).toBe(agenda.id);

    const pinS = await pinScriptToDemo(prisma, {
      admin: author,
      demoId,
      scriptId: script.id,
    });
    expect(pinS.ok).toBe(true);

    const pinSc = await pinScenarioToDemo(prisma, {
      admin: author,
      demoId,
      scenarioId: scenario.id,
    });
    expect(pinSc.ok).toBe(true);

    const pinC = await pinContentToDemo(prisma, {
      admin: author,
      demoId,
      contentId: content.id,
    });
    expect(pinC.ok).toBe(true);

    // New ACTIVE agenda version must not rewrite historical Demo pin
    const agendaV2Draft = await createAgendaVersion(prisma, {
      admin: author,
      code: 'PIN_AGENDA',
      name: 'Agenda v2',
      itemsJson: [{ title: 'New', minutes: 10 }],
      customerSafeSummary: 'New summary',
    });
    await requestAgendaApproval(prisma, {
      admin: author,
      agendaId: agendaV2Draft.agenda.id,
    });
    await approveAgendaVersion(prisma, {
      admin: approver,
      agendaId: agendaV2Draft.agenda.id,
    });

    const demo = await getDemo(prisma, { admin: author, demoId });
    expect(demo.ok).toBe(true);
    expect(demo.demo.pinnedAgendaId).toBe(agenda.id);
    expect(demo.demo.pinnedScriptId).toBe(script.id);
    expect(demo.demo.pinnedScenarioId).toBe(scenario.id);
    expect(demo.demo.pinnedContentId).toBe(content.id);
  });

  it('refuses to pin non-ACTIVE versions', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('a1');
    const demoCreated = await createDemo(prisma, {
      admin: author,
      title: 'Draft pin',
      contactId: 'con-1',
    });
    const draft = await createAgendaVersion(prisma, {
      admin: author,
      code: 'DRAFT_ONLY',
      name: 'Draft',
      customerSafeSummary: 'Draft summary',
    });
    const pin = await pinAgendaToDemo(prisma, {
      admin: author,
      demoId: demoCreated.demo.id,
      agendaId: draft.agenda.id,
    });
    expect(pin.ok).toBe(false);
    expect(pin.error).toBe('demo_content_not_active');
  });
});

describe('Phase 14 Wave 2 — Agenda customer-safe projection + readiness pins', () => {
  it('customer/invitation agenda projection omits internal itemsJson', async () => {
    const agenda = {
      id: 'ag-1',
      code: 'A',
      version: 1,
      status: CRM_DEMO_VERSION_STATUS.ACTIVE,
      itemsJson: [{ title: 'Internal cue', minutes: 5 }],
      customerSafeSummary: 'Public summary',
    };
    const projected = projectAgendaForSurface(agenda, {
      surface: CRM_DEMO_PROJECTION_SURFACE.INVITATION,
    });
    expect(projected.allowed).toBe(true);
    expect(projected.agenda.customerSafeSummary).toBe('Public summary');
    expect(projected.agenda.itemsJson).toBeUndefined();
  });

  it('readiness marks agenda/script pins when present', async () => {
    const prisma = makePrisma();
    const author = makeAdmin('r-author');
    const approver = makeAdmin('r-approver');
    const demoCreated = await createDemo(prisma, {
      admin: author,
      title: 'Ready pins',
      contactId: 'con-1',
    });
    const agenda = await activateAgenda(prisma, author, approver, { code: 'RDY_AG' });
    const script = await activateScript(prisma, author, approver, { code: 'RDY_SC' });
    await pinAgendaToDemo(prisma, {
      admin: author,
      demoId: demoCreated.demo.id,
      agendaId: agenda.id,
    });
    await pinScriptToDemo(prisma, {
      admin: author,
      demoId: demoCreated.demo.id,
      scriptId: script.id,
    });

    const readiness = await evaluateDemoReadiness(prisma, {
      admin: author,
      demoId: demoCreated.demo.id,
      persist: false,
      timeline: false,
    });
    expect(readiness.ok).toBe(true);
    const agendaItem = readiness.items.find((i) => i.key === 'agenda_version');
    const scriptItem = readiness.items.find((i) => i.key === 'script_version');
    expect(agendaItem.ok).toBe(true);
    expect(scriptItem.ok).toBe(true);
  });

  it('domain contract advances with Wave 4 honesty flags', () => {
    const contract = getDemoDomainContract();
    expect(contract.wave).toBe(4);
    expect(contract.restrictedScriptOnCustomerForbidden).toBe(true);
    expect(contract.activeDirectlyEditable).toBe(false);
    expect(contract.mraEisSandboxEqualsDemoEnvironment).toBe(false);
    expect(contract.inventEnvironmentReadyForbidden).toBe(true);
  });
});
