/**
 * Phase 19 Wave 1 — Customer Adoption Request + Plan spine.
 * Auto Request ONLY when Training Program aggregate is COMPLETED.
 * COMPLETED_WITH_GAPS / IN_PROGRESS / partial → no Request.
 * Handover attach ≠ invent Training COMPLETED. No milestones / Tenant GL.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ADOPTION_REQUEST_NUMBER_RE,
  ADOPTION_PLAN_NUMBER_RE,
  consumeTrainingCompletionForAdoption,
  createManualAdoptionRequest,
  validateAdoptionRequest,
  acceptAdoptionRequest,
  createCustomerAdoptionPlan,
  attachOnboardingHandoverToAdoption,
  transitionAdoptionRequestStatus,
  transitionAdoptionPlanStatus,
  listAdoptionRequests,
  listAdoptionPlans,
  loadAdoptionPlanForActor,
  getAdoptionDomainContract,
  ensureWave1DefaultPlanTemplateVersion,
} from '@/lib/admin/customerSuccess/adoption';

function superAdmin(id = 'super-adp-1') {
  return {
    id,
    role: 'Super Admin',
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
  const planStore = overrides._planStore || [];
  const planHistoryStore = overrides._planHistoryStore || [];
  const templateStore = overrides._templateStore || [];
  const templateVersionStore = overrides._templateVersionStore || [];
  const trainingProgramStore = overrides._trainingProgramStore || [
    {
      id: 'trn-prog-completed',
      programNumber: 'TRN-2026-000001',
      status: 'COMPLETED',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      conversionId: 'cvn-1',
      onboardingProjectId: 'onb-1',
      handoffId: 'handoff-trn-1',
      curriculumVersionId: 'currv-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
    {
      id: 'trn-prog-gaps',
      programNumber: 'TRN-2026-000002',
      status: 'COMPLETED_WITH_GAPS',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
    {
      id: 'trn-prog-progress',
      programNumber: 'TRN-2026-000003',
      status: 'IN_PROGRESS',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      createdAt: new Date('2026-07-31T10:00:00Z'),
      updatedAt: new Date('2026-07-31T10:00:00Z'),
    },
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _planStore: planStore,
    _trainingProgramStore: trainingProgramStore,
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
    customerTrainingProgram: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return trainingProgramStore.find((r) => r.id === where.id) || null;
        if (where.programNumber) {
          return (
            trainingProgramStore.find((r) => r.programNumber === where.programNumber) ||
            null
          );
        }
        return null;
      }),
    },
    customerAdoptionRequest: {
      create: vi.fn(async ({ data }) => {
        if (
          data.idempotencyKey &&
          requestStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          throw err;
        }
        if (
          data.trainingProgramId &&
          data.source === 'PHASE_18_TRAINING_COMPLETED' &&
          requestStore.some(
            (r) =>
              r.trainingProgramId === data.trainingProgramId &&
              r.source === 'PHASE_18_TRAINING_COMPLETED'
          )
        ) {
          const err = new Error(
            'Unique constraint failed on trainingProgramId auto source'
          );
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `adr-${requestStore.length + 1}`,
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
        if (where.trainingProgramId) {
          rows = rows.filter((r) => r.trainingProgramId === where.trainingProgramId);
        }
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
    customerAdoptionRequestStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `adrh-${requestHistoryStore.length + 1}`, ...data };
        requestHistoryStore.push(row);
        return row;
      }),
    },
    customerAdoptionPlan: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adp-${planStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        planStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return planStore.find((r) => r.id === where.id) || null;
        if (where.planNumber) {
          return planStore.find((r) => r.planNumber === where.planNumber) || null;
        }
        if (where.idempotencyKey) {
          return planStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.adoptionRequestId) {
          return (
            planStore.find((r) => r.adoptionRequestId === where.adoptionRequestId) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...planStore];
        if (where.adoptionRequestId) {
          rows = rows.filter((r) => r.adoptionRequestId === where.adoptionRequestId);
        }
        return rows[0] || null;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...planStore];
        if (where.tenantId?.in) {
          rows = rows.filter((r) => where.tenantId.in.includes(r.tenantId));
        } else if (where.tenantId) {
          rows = rows.filter((r) => r.tenantId === where.tenantId);
        }
        return rows;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row = planStore.find((r) => r.id === where.id);
        if (!row) throw new Error('not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerAdoptionPlanStatusHistory: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `adph-${planHistoryStore.length + 1}`, ...data };
        planHistoryStore.push(row);
        return row;
      }),
    },
    customerAdoptionPlanTemplate: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adpt-${templateStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateStore];
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        return rows[0] || null;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateStore.find((r) => r.id === where.id) || null;
        if (where.templateCode) {
          return templateStore.find((r) => r.templateCode === where.templateCode) || null;
        }
        return null;
      }),
    },
    customerAdoptionPlanTemplateVersion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adptv-${templateVersionStore.length + 1}`,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        templateVersionStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...templateVersionStore];
        if (where.templateCode) {
          rows = rows.filter((r) => r.templateCode === where.templateCode);
        }
        if (where.status) rows = rows.filter((r) => r.status === where.status);
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

async function seedAcceptedRequest(prisma, admin, opts = {}) {
  const consumed = await consumeTrainingCompletionForAdoption(prisma, {
    actorContext: { admin },
    programId: opts.programId || 'trn-prog-completed',
    idempotencyKey: opts.idempotencyKey || 'adr-seed:1',
  });
  expect(consumed.ok).toBe(true);
  await validateAdoptionRequest(prisma, {
    actorContext: { admin },
    adoptionRequestId: consumed.request.id,
  });
  const accepted = await acceptAdoptionRequest(prisma, {
    actorContext: { admin },
    adoptionRequestId: consumed.request.id,
  });
  expect(accepted.ok).toBe(true);
  return { request: accepted.request || consumed.request, consumed };
}

describe('Phase 19 Wave 1 — Adoption Request + Plan spine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Training Program COMPLETED consume creates one ADR- Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-from-trn:completed-1',
    });
    expect(result.ok).toBe(true);
    expect(result.request.requestNumber).toMatch(ADOPTION_REQUEST_NUMBER_RE);
    expect(result.request.customerId).toBe('cust-1');
    expect(result.request.tenantId).toBe('tenant-1');
    expect(result.request.subscriptionId).toBe('sub-1');
    expect(result.request.trainingProgramId).toBe('trn-prog-completed');
    expect(result.request.source).toMatch(/TRAINING_COMPLETED|PHASE_18/i);
    expect(getAdoptionDomainContract().surface).toContain('adoption');
    expect(prisma._requestStore.length).toBe(1);
  });

  it('exact Training COMPLETED retry returns same Request (no duplicate)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const args = {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-from-trn:retry-1',
    };
    const first = await consumeTrainingCompletionForAdoption(prisma, args);
    expect(first.ok).toBe(true);
    const second = await consumeTrainingCompletionForAdoption(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
  });

  it('COMPLETED_WITH_GAPS does not create Adoption Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-gaps',
      idempotencyKey: 'adr-from-trn:gaps-1',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/COMPLETED_WITH_GAPS|not.?eligible|aggregate|COMPLETED/i);
    expect(prisma._requestStore.length).toBe(0);
  });

  it('IN_PROGRESS / partial Training does not create Adoption Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const result = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-progress',
      idempotencyKey: 'adr-from-trn:progress-1',
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/IN_PROGRESS|not.?eligible|aggregate|COMPLETED/i);
    expect(prisma._requestStore.length).toBe(0);
  });

  it('accept → convert creates one ADP- Plan; second convert returns same (one Request → one Plan)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    expect(tmpl.ok).toBe(true);

    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-convert:1',
    });

    const plan = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-create:1',
    });
    expect(plan.ok).toBe(true);
    expect(plan.plan.planNumber).toMatch(ADOPTION_PLAN_NUMBER_RE);
    expect(plan.plan.planTemplateVersionId || plan.plan.templateVersionId).toBe(
      tmpl.templateVersion.id
    );
    expect(prisma._requestStore[0].status).toBe('CONVERTED_TO_PLAN');

    const second = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-create:1',
    });
    expect(second.ok).toBe(true);
    expect(
      second.alreadyExists ||
        second.idempotentReplay ||
        second.plan.id === plan.plan.id
    ).toBe(true);
    expect(prisma._planStore.length).toBe(1);
  });

  it('exact plan create retry returns same Plan', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-retry-plan:1',
    });
    const args = {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-exact:1',
    };
    const first = await createCustomerAdoptionPlan(prisma, args);
    const second = await createCustomerAdoptionPlan(prisma, args);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.plan.id).toBe(first.plan.id);
    expect(prisma._planStore.length).toBe(1);
  });

  it('conflicting idempotency payload fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-conflict:1',
    });

    const first = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-conflict:1',
    });
    expect(first.ok).toBe(true);

    const conflict = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: 'other-admin' },
      idempotencyKey: 'adp-conflict:1',
    });
    expect(conflict.ok).toBe(false);
    expect(conflict.error).toMatch(/conflict|idempotency/i);
    expect(prisma._planStore.length).toBe(1);
  });

  it('invalid request status transition is rejected (throws)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const consumed = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-bad-status:1',
    });
    expect(consumed.ok).toBe(true);

    await expect(
      transitionAdoptionRequestStatus(prisma, {
        actorContext: { admin },
        adoptionRequestId: consumed.request.id,
        toStatus: 'CONVERTED_TO_PLAN',
      })
    ).rejects.toThrow(/invalid_status_transition/i);
  });

  it('Request without Customer/Tenant fails validation', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const created = await createManualAdoptionRequest(prisma, {
      actorContext: { admin },
      customerId: null,
      tenantId: null,
      subscriptionId: null,
      idempotencyKey: 'adr-incomplete:1',
      allowIncompletePins: true,
    });
    expect(created.ok).toBe(true);

    const validated = await validateAdoptionRequest(prisma, {
      actorContext: { admin },
      adoptionRequestId: created.request.id,
    });
    expect(validated.ok).toBe(false);
    expect(validated.error).toMatch(/customer|tenant/i);
  });

  it('planTemplateVersionId pin is required for Plan create', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-no-tmpl:1',
    });

    const missing = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-no-tmpl:1',
    });
    expect(missing.ok).toBe(false);
    expect(missing.error).toMatch(/template/i);
    expect(prisma._planStore.length).toBe(0);
  });

  it('COMPLETED / HANDED_TO_RENEWALS plan status blocked until completion evaluation', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-completion-block:1',
    });
    const created = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-completion-block:1',
    });
    expect(created.ok).toBe(true);

    prisma._planStore[0].status = 'VALUE_REVIEW';

    const blocked = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      adoptionPlanId: created.plan.id,
      toStatus: 'COMPLETED',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/COMPLETION_POLICY_REQUIRED|completion.?policy/i);
    expect(prisma._planStore[0].status).toBe('VALUE_REVIEW');

    const renewalsBlocked = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      adoptionPlanId: created.plan.id,
      toStatus: 'HANDED_TO_RENEWALS',
    });
    expect(renewalsBlocked.ok).toBe(false);
    expect(renewalsBlocked.error).toMatch(
      /COMPLETION_POLICY_REQUIRED|completion.?policy|handoff.?policy/i
    );
  });

  it('onboarding handover attach does not invent Training COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const consumed = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-handover:1',
    });
    expect(consumed.ok).toBe(true);

    const attached = await attachOnboardingHandoverToAdoption(prisma, {
      actorContext: { admin },
      handoverId: 'handover-onb-1',
      requestId: consumed.request.id,
      idempotencyKey: 'adr-handover-attach:1',
    });
    expect(attached.ok).toBe(true);
    expect(attached.request.onboardingHandoverId || attached.handoverId).toBeTruthy();
    expect(attached.trainingCompleted).not.toBe(true);
    expect(attached.fabricatedTrainingCompleted).not.toBe(true);
    expect(prisma._trainingProgramStore.find((p) => p.id === 'trn-prog-gaps').status).toBe(
      'COMPLETED_WITH_GAPS'
    );
  });

  it('portfolio empty list returns [] (fail-closed)', async () => {
    const prisma = makePrisma();
    const admin = {
      id: 'agent-scoped',
      role: 'Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    };
    await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin: superAdmin() },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-portfolio:1',
    });

    const listed = await listAdoptionRequests(prisma, {
      actorContext: { admin },
      portfolioTenantIds: [],
    });
    expect(listed.ok).toBe(true);
    expect(listed.requests).toEqual([]);
    expect(listed.meta?.failClosed || listed.reason).toBeTruthy();

    const plans = await listAdoptionPlans(prisma, {
      actorContext: { admin },
      portfolioTenantIds: [],
    });
    expect(plans.ok).toBe(true);
    expect(plans.plans).toEqual([]);
  });

  it('cross-tenant plan load denied', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-xtenant:1',
    });
    const created = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: admin.id },
      idempotencyKey: 'adp-xtenant:1',
    });
    expect(created.ok).toBe(true);

    const denied = await loadAdoptionPlanForActor(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: created.plan.id,
      tenantId: 'tenant-other',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/cross.?tenant|denied|isolation|out_of_scope/i);
  });

  it('plan create + handover attach deny cross-portfolio writes-by-id', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const agent = {
      id: 'agent-portfolio',
      role: 'Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    };
    const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
      actorContext: { admin },
    });
    const { request } = await seedAcceptedRequest(prisma, admin, {
      idempotencyKey: 'adr-write-scope:1',
    });

    const planDenied = await createCustomerAdoptionPlan(prisma, {
      actorContext: { admin: agent },
      adoptionRequestId: request.id,
      planTemplateVersionId: tmpl.templateVersion.id,
      ownerAssignments: { csOwnerAdminId: agent.id },
      idempotencyKey: 'adp-write-scope:1',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(planDenied.ok).toBe(false);
    expect(planDenied.forbidden || planDenied.notFound).toBeTruthy();
    expect(planDenied.error || planDenied.reason).toMatch(
      /out.?of.?scope|forbidden|denied|portfolio/i
    );
    expect(prisma._planStore.length).toBe(0);

    const attachDenied = await attachOnboardingHandoverToAdoption(prisma, {
      actorContext: { admin: agent },
      handoverId: 'handover-scope-1',
      requestId: request.id,
      idempotencyKey: 'adr-handover-scope:1',
      portfolioTenantIds: [],
    });
    expect(attachDenied.ok).toBe(false);
    expect(attachDenied.forbidden || attachDenied.notFound).toBeTruthy();
    expect(attachDenied.error || attachDenied.reason).toMatch(
      /out.?of.?scope|forbidden|denied|portfolio/i
    );
    expect(prisma._requestStore[0].onboardingHandoverId).toBeFalsy();
  });

  it('Training→ADR race with different idempotency keys recovers same Request', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const first = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-from-trn:race-a',
    });
    expect(first.ok).toBe(true);

    // Simulate concurrent race window: pre-create byProgram miss, create hits unique.
    prisma.customerAdoptionRequest.findFirst.mockResolvedValueOnce(null);

    const second = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-from-trn:race-b',
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.request.id).toBe(first.request.id);
    expect(prisma._requestStore.length).toBe(1);
  });

  it('manual create / training consume deny cross-portfolio tenant writes', async () => {
    const prisma = makePrisma();
    const agent = {
      id: 'agent-create-scope',
      role: 'Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    };

    const manualDenied = await createManualAdoptionRequest(prisma, {
      actorContext: { admin: agent },
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      idempotencyKey: 'adr-manual-scope:1',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(manualDenied.ok).toBe(false);
    expect(manualDenied.forbidden || manualDenied.notFound).toBeTruthy();
    expect(String(manualDenied.error || manualDenied.reason || '')).toMatch(
      /out.?of.?scope|forbidden|denied|portfolio/i
    );
    expect(prisma._requestStore.length).toBe(0);

    const consumeDenied = await consumeTrainingCompletionForAdoption(prisma, {
      actorContext: { admin: agent },
      programId: 'trn-prog-completed',
      idempotencyKey: 'adr-consume-scope:1',
      portfolioTenantIds: ['tenant-other'],
    });
    expect(consumeDenied.ok).toBe(false);
    expect(consumeDenied.forbidden || consumeDenied.notFound).toBeTruthy();
    expect(String(consumeDenied.error || consumeDenied.reason || '')).toMatch(
      /out.?of.?scope|forbidden|denied|portfolio/i
    );
    expect(prisma._requestStore.length).toBe(0);
  });

  it('validate/accept early returns still require loadAdoptionRequestForActor scope', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const agent = {
      id: 'agent-validate-scope',
      role: 'Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    };

    const created = await createManualAdoptionRequest(prisma, {
      actorContext: { admin },
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
      idempotencyKey: 'adr-validate-scope:1',
    });
    expect(created.ok).toBe(true);

    const validated = await validateAdoptionRequest(prisma, {
      actorContext: { admin },
      adoptionRequestId: created.request.id,
    });
    expect(validated.ok).toBe(true);
    expect(validated.request.status).toMatch(/READY/i);

    // Idempotent validate must not leak cross-portfolio ADR payload
    const validateDenied = await validateAdoptionRequest(prisma, {
      actorContext: { admin: agent },
      adoptionRequestId: created.request.id,
      portfolioTenantIds: ['tenant-other'],
    });
    expect(validateDenied.ok).toBe(false);
    expect(validateDenied.forbidden || validateDenied.notFound).toBeTruthy();
    expect(validateDenied.request).toBeFalsy();

    const accepted = await acceptAdoptionRequest(prisma, {
      actorContext: { admin },
      adoptionRequestId: created.request.id,
    });
    expect(accepted.ok).toBe(true);

    const acceptDenied = await acceptAdoptionRequest(prisma, {
      actorContext: { admin: agent },
      adoptionRequestId: created.request.id,
      portfolioTenantIds: ['tenant-other'],
    });
    expect(acceptDenied.ok).toBe(false);
    expect(acceptDenied.forbidden || acceptDenied.notFound).toBeTruthy();
    expect(acceptDenied.request).toBeFalsy();
  });
});
