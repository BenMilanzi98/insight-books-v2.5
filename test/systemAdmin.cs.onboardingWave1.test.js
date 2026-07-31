/**
 * Phase 17 Wave 1 — Customer Onboarding Request + Project spine.
 * Consumes Phase 16 ONBOARDING handoff; never fabricates onboarding complete.
 * No Workstream materialisation / Tenant GL / Training completion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ONBOARDING_REQUEST_NUMBER_RE,
  ONBOARDING_PROJECT_NUMBER_RE,
  consumeOnboardingHandoff,
  validateOnboardingRequest,
  acceptOnboardingRequest,
  createOnboardingProject,
  transitionOnboardingRequestStatus,
  getOnboardingDomainContract,
  ensureWave1StandardTemplateVersion,
  listOnboardingProjects,
  listOnboardingRequests,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-onb-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function noPermAdmin(id = 'viewer-onb-1') {
  return {
    id,
    role: 'System Admin',
    permissions: {},
  };
}

function csScopedAdmin(id = 'cs-scoped-1') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function makePrisma(overrides = {}) {
  const seqStore = overrides._seqStore || [];
  const requestStore = overrides._requestStore || [];
  const requestHistoryStore = overrides._requestHistoryStore || [];
  const projectStore = overrides._projectStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];
  const templateVersionStore = overrides._templateVersionStore || [];
  const handoffStore = overrides._handoffStore || [
    {
      id: 'handoff-onb-1',
      conversionId: 'cvn-1',
      tenantId: 'tenant-1',
      handoffType: 'ONBOARDING',
      status: 'EMITTED',
      executionStatus: 'NOT_STARTED',
      idempotencyKey: 'onboarding-handoff:cvn-1',
      payloadJson: {
        type: 'CRM_ONBOARDING_HANDOFF',
        conversionId: 'cvn-1',
        customerId: 'cust-1',
        tenantId: 'tenant-1',
        subscriptionId: 'sub-1',
        onboardingCompleted: false,
        fabricatedComplete: false,
        executionComplete: false,
        executionStatus: 'NOT_STARTED',
      },
      checksumSha256: null,
      createdByAdminId: 'super-onb-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _projectStore: projectStore,
    _handoffStore: handoffStore,
    _templateVersionStore: templateVersionStore,
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
    crmConversionDomainHandoff: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `handoff-${handoffStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        handoffStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return handoffStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return handoffStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...handoffStore];
        if (where.handoffType) {
          rows = rows.filter((r) => r.handoffType === where.handoffType);
        }
        if (where.conversionId) {
          rows = rows.filter((r) => r.conversionId === where.conversionId);
        }
        return rows[0] || null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = handoffStore.find((r) => r.id === where.id);
        if (!row) throw new Error('handoff_not_found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onr-${requestStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        requestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.requestNumber) {
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.handoffId) rows = rows.filter((r) => r.handoffId === where.handoffId);
        if (where.source) rows = rows.filter((r) => r.source === where.source);
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...requestStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onrh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        projectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return projectStore.find((r) => r.id === where.id) || null;
        if (where.onboardingNumber) {
          return projectStore.find((r) => r.onboardingNumber === where.onboardingNumber) || null;
        }
        if (where.idempotencyKey) {
          return projectStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.onboardingRequestId) {
          return (
            projectStore.find((r) => r.onboardingRequestId === where.onboardingRequestId) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.onboardingRequestId) {
          rows = rows.filter((r) => r.onboardingRequestId === where.onboardingRequestId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...projectStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = projectStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerOnboardingProjectStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `onbh-${projectHistoryStore.length + 1}`, ...data };
        projectHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingTemplateVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `tmplv-${templateVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateVersionStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateVersionStore];
        if (where.onboardingType) {
          rows = rows.filter((r) => r.onboardingType === where.onboardingType);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateVersionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
  };

  return prisma;
}

describe('Phase 17 Wave 1 — Onboarding Request + Project spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Phase 16 ONBOARDING handoff consume creates one ONR- Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-from-handoff:handoff-onb-1',
    });
    expect(result.ok).toBe(true);
    expect(result.request.requestNumber).toMatch(ONBOARDING_REQUEST_NUMBER_RE);
    expect(result.request.customerId).toBe('cust-1');
    expect(result.request.tenantId).toBe('tenant-1');
    expect(result.request.subscriptionId).toBe('sub-1');
    expect(result.request.handoffId).toBe('handoff-onb-1');
    expect(result.onboardingCompleted).not.toBe(true);
    expect(getOnboardingDomainContract().surface).toContain('onboarding');
    expect(prisma._requestStore.length).toBe(1);
  });

  it('exact handoff retry returns same Request (no duplicate)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-from-handoff:handoff-onb-1',
    };
    const first = await consumeOnboardingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    const second = await consumeOnboardingHandoff(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
  });

  it('replay consume repairs handoff to IN_PROGRESS when Request exists and handoff still NOT_STARTED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-from-handoff:handoff-stuck:1',
    };
    const first = await consumeOnboardingHandoff(prisma, args);
    expect(first.ok).toBe(true);
    expect(prisma._requestStore.length).toBe(1);

    // Simulate failed first ack: Request exists but handoff stuck at NOT_STARTED
    prisma._handoffStore[0].executionStatus = 'NOT_STARTED';

    const replay = await consumeOnboardingHandoff(prisma, args);
    expect(replay.ok).toBe(true);
    expect(replay.alreadyExists || replay.idempotentReplay).toBe(true);
    expect(replay.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
    expect(String(prisma._handoffStore[0].executionStatus).toUpperCase()).toBe(
      'IN_PROGRESS'
    );
    expect(replay.onboardingCompleted).not.toBe(true);
    expect(String(prisma._handoffStore[0].executionStatus).toUpperCase()).not.toBe(
      'COMPLETED'
    );
  });

  it('accept → convert creates one ONB- Project; second convert returns same or fails duplicate', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    expect(tmpl.ok).toBe(true);

    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-convert:1',
    });
    expect(consumed.ok).toBe(true);

    const validated = await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    expect(validated.ok).toBe(true);

    const accepted = await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.request.status).toBe('ACCEPTED');

    const project = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-create:1',
    });
    expect(project.ok).toBe(true);
    expect(project.project.onboardingNumber).toMatch(ONBOARDING_PROJECT_NUMBER_RE);
    expect(project.project.templateVersionId).toBe(tmpl.templateVersion.id);
    // My Work owner pins must be persisted (not only ownerAssignmentsJson)
    expect(project.project.csOwnerAdminId).toBe(admin.id);
    expect(project.project.ownerAdminId).toBe(admin.id);
    expect(prisma._projectStore[0].csOwnerAdminId).toBe(admin.id);
    expect(prisma._projectStore[0].ownerAdminId).toBe(admin.id);
    expect(prisma._requestStore[0].status).toBe('CONVERTED_TO_PROJECT');

    const second = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-create:1',
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay || second.project.id === project.project.id).toBe(
      true
    );
    expect(prisma._projectStore.length).toBe(1);
  });

  it('exact project create retry returns same Project', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-retry-proj:1',
    });
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    const args = {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-exact:1',
    };
    const first = await createOnboardingProject(prisma, args);
    const second = await createOnboardingProject(prisma, args);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.project.id).toBe(first.project.id);
    expect(prisma._projectStore.length).toBe(1);
  });

  it('project create retry repairs Request to CONVERTED_TO_PROJECT when Project already exists', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-repair-convert:1',
    });
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });

    const args = {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-repair-convert:1',
    };
    const first = await createOnboardingProject(prisma, args);
    expect(first.ok).toBe(true);
    expect(prisma._projectStore.length).toBe(1);

    // Simulate failed status transition after Project create
    prisma._requestStore[0].status = 'ACCEPTED';
    prisma._requestStore[0].projectId = null;

    const retry = await createOnboardingProject(prisma, args);
    expect(retry.ok).toBe(true);
    expect(retry.alreadyExists || retry.idempotentReplay).toBe(true);
    expect(retry.project.id).toBe(first.project.id);
    expect(prisma._projectStore.length).toBe(1);
    expect(prisma._requestStore[0].status).toBe('CONVERTED_TO_PROJECT');
    expect(retry.onboardingCompleted).not.toBe(true);
  });

  it('conflicting idempotency payload fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-conflict:1',
    });
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });

    const first = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-conflict:1',
    });
    expect(first.ok).toBe(true);

    const conflict = await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-20',
      targetGoLiveDate: '2026-10-01',
      ownerAssignments: { csOwnerAdminId: 'other-admin' },
      idempotencyKey: 'onb-conflict:1',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/conflict|idempotency/i);
    expect(prisma._projectStore.length).toBe(1);
  });

  it('invalid status transition is rejected (throws)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-bad-status:1',
    });
    expect(consumed.ok).toBe(true);

    await expect(
      transitionOnboardingRequestStatus(prisma, {
        actorContext: { admin },
        onboardingRequestId: consumed.request.id,
        toStatus: 'CONVERTED_TO_PROJECT',
      })
    ).rejects.toThrow(/invalid_status_transition/i);
  });

  it('listOnboardingProjects/Requests deny unauthorized and fail-closed without portfolio scope', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1StandardTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-onb-1',
      idempotencyKey: 'onr-list-authz:1',
    });
    await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    await acceptOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    await createOnboardingProject(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
      onboardingTemplateVersionId: tmpl.templateVersion.id,
      targetKickoffDate: '2026-08-10',
      targetGoLiveDate: '2026-09-01',
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'onb-list-authz:1',
    });

    // Seed a second tenant project to prove unscoped fleet denial
    await prisma.customerOnboardingProject.create({
      data: {
        id: 'onb-other-tenant',
        onboardingNumber: 'ONB-2026-009999',
        status: 'IN_PROGRESS',
        tenantId: 'tenant-other',
        customerId: 'cust-other',
        subscriptionId: 'sub-other',
        templateVersionId: tmpl.templateVersion.id,
      },
    });
    await prisma.customerOnboardingRequest.create({
      data: {
        id: 'onr-other-tenant',
        requestNumber: 'ONR-2026-009999',
        status: 'NEW',
        tenantId: 'tenant-other',
        customerId: 'cust-other',
        subscriptionId: 'sub-other',
      },
    });

    const denied = await listOnboardingProjects(prisma, {
      admin: noPermAdmin(),
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden).toBe(true);
    expect(denied.projects || []).toEqual([]);

    const deniedReq = await listOnboardingRequests(prisma, {
      admin: noPermAdmin(),
    });
    expect(deniedReq.ok).toBe(false);
    expect(deniedReq.forbidden).toBe(true);
    expect(deniedReq.requests || []).toEqual([]);

    // Authenticated CS without portfolio scope must not enumerate fleet
    const scopedEmpty = await listOnboardingProjects(prisma, {
      admin: csScopedAdmin(),
    });
    expect(scopedEmpty.ok).toBe(true);
    expect(scopedEmpty.projects).toEqual([]);
    expect(scopedEmpty.meta?.failClosed || scopedEmpty.reason).toBeTruthy();

    const scoped = await listOnboardingProjects(prisma, {
      admin: csScopedAdmin(),
      portfolioTenantIds: ['tenant-1'],
    });
    expect(scoped.ok).toBe(true);
    expect(scoped.projects.every((p) => p.tenantId === 'tenant-1')).toBe(true);
    expect(scoped.projects.some((p) => p.id === 'onb-other-tenant')).toBe(false);

    const scopedReq = await listOnboardingRequests(prisma, {
      admin: csScopedAdmin(),
      portfolioTenantIds: ['tenant-1'],
    });
    expect(scopedReq.ok).toBe(true);
    expect(scopedReq.requests.every((r) => r.tenantId === 'tenant-1')).toBe(true);
    expect(scopedReq.requests.some((r) => r.id === 'onr-other-tenant')).toBe(false);

    // Super Admin with explicit permission may list broadly
    const broad = await listOnboardingProjects(prisma, { admin });
    expect(broad.ok).toBe(true);
    expect(broad.projects.length).toBeGreaterThanOrEqual(2);
  });

  it('Request without Customer/Tenant/Subscription fails validation', async () => {
    const prisma = makePrisma({
      _handoffStore: [
        {
          id: 'handoff-incomplete',
          conversionId: 'cvn-2',
          tenantId: null,
          handoffType: 'ONBOARDING',
          status: 'EMITTED',
          executionStatus: 'NOT_STARTED',
          idempotencyKey: 'onboarding-handoff:cvn-2',
          payloadJson: {
            type: 'CRM_ONBOARDING_HANDOFF',
            conversionId: 'cvn-2',
            onboardingCompleted: false,
          },
          createdByAdminId: 'super-onb-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
    const admin = superAdmin();
    const consumed = await consumeOnboardingHandoff(prisma, {
      actorContext: { admin },
      handoffId: 'handoff-incomplete',
      idempotencyKey: 'onr-incomplete:1',
      // Allow create with missing pins for validation gate test
      allowIncompletePins: true,
    });
    expect(consumed.ok).toBe(true);

    const validated = await validateOnboardingRequest(prisma, {
      actorContext: { admin },
      onboardingRequestId: consumed.request.id,
    });
    expect(validated.ok).toBe(false);
    expect(validated.error).toMatch(/customer|tenant|subscription/i);
  });
});
