/**
 * Phase 19 Wave 2 — Milestones, value outcomes, Phase 9 evidence, Plan completion.
 * Gate fail / missing → UNKNOWN + UNAVAILABLE (never invent MET).
 * TRAINING_CERT: Program COMPLETED / valid cert — not WITH_GAPS alone.
 * Plan COMPLETED only via evaluateAdoptionPlanCompletion (critical MET|WAIVED + value review).
 * Any-one-milestone ≠ Plan COMPLETED. Value missing → UNAVAILABLE null (not false zero).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ADOPTION_PLAN_NUMBER_RE,
  ensureWave1DefaultPlanTemplateVersion,
  createManualAdoptionRequest,
  acceptAdoptionRequest,
  createCustomerAdoptionPlan,
  materialiseAdoptionMilestones,
  evaluateAdoptionMilestone,
  attestAdoptionMilestone,
  waiveAdoptionMilestone,
  recordAdoptionValueOutcome,
  signOffAdoptionValueReview,
  evaluateAdoptionPlanCompletion,
  transitionAdoptionPlanStatus,
  loadAdoptionPlanForActor,
  calculateAdoptionHealth,
  getAdoptionDomainContract,
} from '@/lib/admin/customerSuccess/adoption';

function superAdmin(id = 'super-adp-w2-1') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function viewerOnly(id = 'viewer-adp-w2-1') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
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
  const milestoneStore = overrides._milestoneStore || [];
  const evidenceStore = overrides._evidenceStore || [];
  const valueOutcomeStore = overrides._valueOutcomeStore || [];
  const trainingProgramStore = overrides._trainingProgramStore || [
    {
      id: 'trn-prog-completed',
      programNumber: 'TRN-2026-000001',
      status: 'COMPLETED',
      customerId: 'cust-1',
      tenantId: 'tenant-1',
      subscriptionId: 'sub-1',
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
  ];
  const certificateStore = overrides._certificateStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _planStore: planStore,
    _milestoneStore: milestoneStore,
    _evidenceStore: evidenceStore,
    _valueOutcomeStore: valueOutcomeStore,
    _trainingProgramStore: trainingProgramStore,
    _certificateStore: certificateStore,
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
        return null;
      }),
    },
    customerTrainingCertificate: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          certificateStore.find((c) => {
            if (where.programId && c.programId !== where.programId) return false;
            if (where.verificationStatus && c.verificationStatus !== where.verificationStatus)
              return false;
            if (where.id && c.id !== where.id) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return certificateStore.find((c) => c.id === where.id) || null;
        return null;
      }),
    },
    customerAdoptionRequest: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adr-${requestStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        requestStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return requestStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return requestStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.requestNumber) {
          return requestStore.find((r) => r.requestNumber === where.requestNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          requestStore.find((r) => {
            if (where.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) return false;
            if (where.trainingProgramId && r.trainingProgramId !== where.trainingProgramId)
              return false;
            if (where.source && r.source !== where.source) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async () => [...requestStore]),
      update: vi.fn(async ({ where, data }) => {
        const row = requestStore.find((r) => r.id === where.id);
        if (!row) throw new Error('request not found');
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
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        planStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return planStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return planStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        if (where.adoptionRequestId) {
          return planStore.find((r) => r.adoptionRequestId === where.adoptionRequestId) || null;
        }
        if (where.planNumber) {
          return planStore.find((r) => r.planNumber === where.planNumber) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          planStore.find((r) => {
            if (where.adoptionRequestId && r.adoptionRequestId !== where.adoptionRequestId)
              return false;
            if (where.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async () => [...planStore]),
      update: vi.fn(async ({ where, data }) => {
        const row = planStore.find((r) => r.id === where.id);
        if (!row) throw new Error('plan not found');
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
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          templateStore.find((t) => t.templateCode === where.templateCode) || null
        );
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `adpt-${templateStore.length + 1}`, ...data };
        templateStore.push(row);
        return row;
      }),
    },
    customerAdoptionPlanTemplateVersion: {
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          templateVersionStore.find((t) => {
            if (where.templateCode && t.templateCode !== where.templateCode) return false;
            if (where.status && t.status !== where.status) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return templateVersionStore.find((t) => t.id === where.id) || null;
        return null;
      }),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adptv-${templateVersionStore.length + 1}`,
          ...data,
        };
        templateVersionStore.push(row);
        return row;
      }),
    },
    customerAdoptionMilestone: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adm-${milestoneStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        milestoneStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return milestoneStore.filter((m) => {
          if (where.planId && m.planId !== where.planId) return false;
          if (where.planTemplateVersionId && m.planTemplateVersionId !== where.planTemplateVersionId)
            return false;
          return true;
        });
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return milestoneStore.find((m) => m.id === where.id) || null;
        if (where.planId_templateKey) {
          const { planId, templateKey } = where.planId_templateKey;
          return (
            milestoneStore.find(
              (m) => m.planId === planId && m.templateKey === templateKey
            ) || null
          );
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          milestoneStore.find((m) => {
            if (where.planId && m.planId !== where.planId) return false;
            if (where.templateKey && m.templateKey !== where.templateKey) return false;
            if (where.id && m.id !== where.id) return false;
            return true;
          }) || null
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = milestoneStore.find((m) => m.id === where.id);
        if (!row) throw new Error('milestone not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
    },
    customerAdoptionEvidenceSnapshot: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `ades-${evidenceStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
        };
        evidenceStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return evidenceStore.filter((e) => {
          if (where.planId && e.planId !== where.planId) return false;
          if (where.milestoneId && e.milestoneId !== where.milestoneId) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          evidenceStore.find((e) => {
            if (where.planId && e.planId !== where.planId) return false;
            if (where.milestoneId && e.milestoneId !== where.milestoneId) return false;
            if (where.idempotencyKey && e.idempotencyKey !== where.idempotencyKey) return false;
            return true;
          }) || null
        );
      }),
    },
    customerAdoptionValueOutcome: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `advo-${valueOutcomeStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        valueOutcomeStore.push(row);
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return valueOutcomeStore.filter((v) => {
          if (where.planId && v.planId !== where.planId) return false;
          return true;
        });
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          valueOutcomeStore.find((v) => {
            if (where.planId && v.planId !== where.planId) return false;
            if (where.idempotencyKey && v.idempotencyKey !== where.idempotencyKey) return false;
            if (where.outcomeType && v.outcomeType !== where.outcomeType) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.idempotencyKey) {
          return (
            valueOutcomeStore.find((v) => v.idempotencyKey === where.idempotencyKey) || null
          );
        }
        if (where.id) return valueOutcomeStore.find((v) => v.id === where.id) || null;
        return null;
      }),
    },
  };

  return prisma;
}

async function seedActivePlan(prisma, admin, opts = {}) {
  const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
    actorContext: { admin },
  });
  // Ensure Wave 2 milestone definitions on pinned template
  const tv = prisma._templateVersionStore.find(
    (t) => t.id === tmpl.templateVersion.id
  );
  if (tv) {
    tv.contentJson = {
      wave: 2,
      milestones: [
        {
          key: 'first_value_analytics',
          roleTarget: 'OWNER',
          evidenceMode: 'PRODUCT_ANALYTICS',
          critical: true,
          featureCode: opts.featureCode || 'invoices.post',
          metricCode:
            opts.metricCode || 'product.feature.invoices.post.count',
        },
        {
          key: 'training_cert_complete',
          roleTarget: 'ADMIN',
          evidenceMode: 'TRAINING_CERT',
          critical: true,
          requireProgramCompleted: true,
        },
        {
          key: 'cs_attestation_champion',
          roleTarget: 'CHAMPION',
          evidenceMode: 'CS_ATTESTATION',
          critical: true,
        },
        {
          key: 'mixed_activation',
          roleTarget: 'ACCOUNTANT',
          evidenceMode: 'MIXED',
          critical: false,
          requiredModes: ['PRODUCT_ANALYTICS', 'CS_ATTESTATION'],
          featureCode: opts.featureCode || 'invoices.post',
          metricCode:
            opts.metricCode || 'product.feature.invoices.post.count',
        },
      ],
    };
  }

  const created = await createManualAdoptionRequest(prisma, {
    actorContext: { admin },
    customerId: 'cust-1',
    tenantId: 'tenant-1',
    subscriptionId: 'sub-1',
    trainingProgramId: opts.trainingProgramId || 'trn-prog-completed',
    idempotencyKey: opts.requestKey || `adr-w2:${Date.now()}:${Math.random()}`,
  });
  expect(created.ok).toBe(true);

  const accepted = await acceptAdoptionRequest(prisma, {
    actorContext: { admin },
    adoptionRequestId: created.request.id,
  });
  expect(accepted.ok).toBe(true);

  const plan = await createCustomerAdoptionPlan(prisma, {
    actorContext: { admin },
    adoptionRequestId: created.request.id,
    planTemplateVersionId: tmpl.templateVersion.id,
    ownerAssignments: { csOwnerAdminId: admin.id },
    idempotencyKey: opts.planKey || `adp-w2:${Date.now()}:${Math.random()}`,
  });
  expect(plan.ok).toBe(true);
  expect(plan.plan.planNumber).toMatch(ADOPTION_PLAN_NUMBER_RE);

  return {
    plan: plan.plan,
    planRow: prisma._planStore.find((p) => p.id === plan.plan.id),
    templateVersion: tmpl.templateVersion,
    request: created.request,
  };
}

describe('Phase 19 Wave 2 — Adoption milestones / value / completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('materialises milestones from pinned template idempotently', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan, templateVersion } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-mat:1',
      planKey: 'adp-mat:1',
    });

    const first = await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-1',
    });
    expect(first.ok).toBe(true);
    expect(first.milestones?.length).toBeGreaterThanOrEqual(3);
    expect(prisma._milestoneStore.length).toBe(first.milestones.length);

    const second = await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-1-retry',
    });
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(prisma._milestoneStore.length).toBe(first.milestones.length);
    expect(
      prisma._milestoneStore.every(
        (m) => m.planTemplateVersionId === templateVersion.id
      )
    ).toBe(true);
  });

  it('PRODUCT_ANALYTICS gate fail / missing → UNKNOWN + UNAVAILABLE (never MET)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-gate:1',
      planKey: 'adp-gate:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-gate:1',
    });
    const ms = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'PRODUCT_ANALYTICS'
    );
    expect(ms).toBeTruthy();

    const result = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
      // Vitest-only inject — public HTTP must not forward these fields
      allowTestEvidenceInject: true,
      analyticsGate: { status: 'NOT_INSTRUMENTED', value: null },
      phase9Snapshot: null,
    });
    expect(result.ok).toBe(true);
    expect(result.milestone.status).toBe('UNKNOWN');
    expect(result.evidenceStatus || result.evidence?.status).toMatch(/UNAVAILABLE/i);
    expect(result.milestone.status).not.toBe('MET');
    expect(prisma._milestoneStore.find((m) => m.id === ms.id).status).toBe('UNKNOWN');
  });

  it('client analyticsGate/phase9Snapshot cannot invent PRODUCT_ANALYTICS MET without inject flag', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-inject:1',
      planKey: 'adp-inject:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-inject:1',
    });
    const ms = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'PRODUCT_ANALYTICS'
    );

    const forged = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
      // Spoofed client body — ignored without allowTestEvidenceInject
      analyticsGate: { status: 'AVAILABLE' },
      phase9Snapshot: {
        sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
        meetsDefinition: true,
        observedAt: new Date('2026-07-31T12:00:00Z').toISOString(),
      },
    });
    expect(forged.ok).toBe(true);
    expect(forged.milestone.status).not.toBe('MET');
    expect(forged.evidenceStatus || forged.evidence?.status).toMatch(
      /UNAVAILABLE|UNKNOWN/i
    );
  });

  it('TRAINING_CERT with Program COMPLETED_WITH_GAPS alone is not MET', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      trainingProgramId: 'trn-prog-gaps',
      requestKey: 'adr-gaps:1',
      planKey: 'adp-gaps:1',
    });
    prisma._planStore[0].trainingProgramId = 'trn-prog-gaps';

    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-gaps:1',
    });
    const ms = prisma._milestoneStore.find((m) => m.evidenceMode === 'TRAINING_CERT');
    expect(ms).toBeTruthy();

    const result = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
    });
    expect(result.ok).toBe(true);
    expect(result.milestone.status).not.toBe('MET');
    expect(result.milestone.status).toMatch(/UNKNOWN|NOT_STARTED|IN_PROGRESS|MISSED/i);
  });

  it('TRAINING_CERT MET when Program COMPLETED (or valid non-revoked cert)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      trainingProgramId: 'trn-prog-completed',
      requestKey: 'adr-cert:1',
      planKey: 'adp-cert:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-cert:1',
    });
    const ms = prisma._milestoneStore.find((m) => m.evidenceMode === 'TRAINING_CERT');

    const result = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
    });
    expect(result.ok).toBe(true);
    expect(result.milestone.status).toBe('MET');
  });

  it('attestation requires manage + planAccess; viewer denied', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const viewer = viewerOnly();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-attest:1',
      planKey: 'adp-attest:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-attest:1',
    });
    const ms = prisma._milestoneStore.find((m) => m.evidenceMode === 'CS_ATTESTATION');

    const denied = await attestAdoptionMilestone(prisma, {
      actorContext: { admin: viewer, tenantId: 'tenant-other' },
      planId: plan.id,
      milestoneId: ms.id,
      reason: 'looks good',
      idempotencyKey: 'attest-denied:1',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden || denied.error).toBeTruthy();

    const ok = await attestAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
      reason: 'Champion enablement verified in workshop',
      idempotencyKey: 'attest-ok:1',
    });
    expect(ok.ok).toBe(true);
    expect(ok.milestone.status).toBe('MET');
  });

  it('critical waiver SoD: attestor cannot sole-waive critical milestone', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-sod:1',
      planKey: 'adp-sod:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-sod:1',
    });
    const ms = prisma._milestoneStore.find((m) => m.evidenceMode === 'CS_ATTESTATION');
    await attestAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
      reason: 'attested by same actor',
      idempotencyKey: 'attest-sod:1',
    });

    const waived = await waiveAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
      reason: 'executive waiver attempt by same attestor',
      idempotencyKey: 'waive-sod:1',
    });
    expect(waived.ok).toBe(false);
    expect(waived.error).toMatch(/sod|separation|attestor|waiver/i);
  });

  it('value missing / gate fail → UNAVAILABLE with null value (not false zero)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-val:1',
      planKey: 'adp-val:1',
    });

    const result = await recordAdoptionValueOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      outcomeType: 'TIME_TO_FIRST_VALUE',
      allowTestEvidenceInject: true,
      analyticsGate: { status: 'UNAVAILABLE', value: null },
      measuredValue: null,
      idempotencyKey: 'val-missing:1',
    });
    expect(result.ok).toBe(true);
    expect(result.outcome.status).toMatch(/UNAVAILABLE/i);
    expect(result.outcome.value).toBeNull();
    expect(result.outcome.value).not.toBe(0);

    // Client invent without inject / CS attest → UNAVAILABLE (never invent READY)
    const forged = await recordAdoptionValueOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      outcomeType: 'TIME_TO_FIRST_VALUE',
      analyticsGate: { status: 'AVAILABLE' },
      measuredValue: 99,
      idempotencyKey: 'val-forged:1',
    });
    expect(forged.ok).toBe(true);
    expect(forged.outcome.status).toMatch(/UNAVAILABLE/i);
    expect(forged.outcome.value).toBeNull();
  });

  it('any-one-milestone MET ≠ Plan COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-one:1',
      planKey: 'adp-one:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-one:1',
    });
    const ms = prisma._milestoneStore.find((m) => m.evidenceMode === 'TRAINING_CERT');
    await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
    });
    expect(prisma._milestoneStore.find((m) => m.id === ms.id).status).toBe('MET');

    prisma._planStore[0].status = 'VALUE_REVIEW';
    const evaluation = await evaluateAdoptionPlanCompletion(prisma, {
      actorContext: { admin },
      planId: plan.id,
    });
    expect(evaluation.ok).toBe(false);
    expect(evaluation.status || evaluation.error).toMatch(
      /COMPLETION_POLICY|critical|value.?review|incomplete/i
    );

    const transition = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      adoptionPlanId: plan.id,
      toStatus: 'COMPLETED',
    });
    expect(transition.ok).toBe(false);
    expect(prisma._planStore[0].status).toBe('VALUE_REVIEW');
  });

  it('ungated COMPLETED transition rejected without evaluation pass', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-ungated:1',
      planKey: 'adp-ungated:1',
    });
    prisma._planStore[0].status = 'VALUE_REVIEW';

    const blocked = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      adoptionPlanId: plan.id,
      toStatus: 'COMPLETED',
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error || blocked.evaluation?.error).toMatch(
      /COMPLETION_POLICY|completion|critical|value.?review/i
    );
    expect(prisma._planStore[0].status).not.toBe('COMPLETED');
  });

  it('Plan COMPLETED when all critical MET|WAIVED + value review + manage + access', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const waver = superAdmin('super-adp-w2-waver');
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-done:1',
      planKey: 'adp-done:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-done:1',
    });

    // TRAINING_CERT → MET via Program COMPLETED
    const certMs = prisma._milestoneStore.find((m) => m.evidenceMode === 'TRAINING_CERT');
    await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: certMs.id,
    });

    // PRODUCT_ANALYTICS → MET via fresh Phase 9 snapshot meeting definition
    const analyticsMs = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'PRODUCT_ANALYTICS'
    );
    await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: analyticsMs.id,
      allowTestEvidenceInject: true,
      analyticsGate: { status: 'AVAILABLE' },
      phase9Snapshot: {
        sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
        featureCode: 'invoices.post',
        adoptionState: 'FIRST_VALUE_ACHIEVED',
        meetsDefinition: true,
        observedAt: new Date('2026-07-31T12:00:00Z').toISOString(),
      },
    });

    // CS_ATTESTATION → MET via attest; waive via different actor (SoD)
    const attestMs = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'CS_ATTESTATION'
    );
    // For completion path: attest MET is enough for critical; skip waive
    await attestAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: attestMs.id,
      reason: 'Champion confirmed in QBR',
      idempotencyKey: 'attest-done:1',
    });

    const signed = await signOffAdoptionValueReview(prisma, {
      actorContext: { admin },
      planId: plan.id,
      reason: 'Value outcomes reviewed — TTFV + activation acceptable',
      idempotencyKey: 'vr-done:1',
    });
    expect(signed.ok).toBe(true);

    prisma._planStore[0].status = 'VALUE_REVIEW';

    const evaluation = await evaluateAdoptionPlanCompletion(prisma, {
      actorContext: { admin },
      planId: plan.id,
    });
    expect(evaluation.ok).toBe(true);

    const completed = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      adoptionPlanId: plan.id,
      toStatus: 'COMPLETED',
    });
    expect(completed.ok).toBe(true);
    expect(completed.plan.status).toBe('COMPLETED');
    expect(waver.id).not.toBe(admin.id); // keep SoD actor distinct for future waive tests
  });

  it('writes use loadAdoptionPlanForActor (cross-tenant denied)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-x:1',
      planKey: 'adp-x:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-x:1',
    });
    const ms = prisma._milestoneStore[0];

    const denied = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
      milestoneId: ms.id,
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden === true || /cross_tenant|forbidden|scope/i.test(String(denied.error || ''))).toBe(
      true
    );

    const access = await loadAdoptionPlanForActor(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
    });
    expect(access.ok).toBe(false);
  });

  it('attest cannot MET PRODUCT_ANALYTICS or TRAINING_CERT milestones', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-attest-mode:1',
      planKey: 'adp-attest-mode:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-attest-mode:1',
    });

    const analyticsMs = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'PRODUCT_ANALYTICS'
    );
    const deniedPa = await attestAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: analyticsMs.id,
      reason: 'attempt to attest product analytics',
      idempotencyKey: 'attest-pa:1',
    });
    expect(deniedPa.ok).toBe(false);
    expect(deniedPa.error).toMatch(/attestation_mode_forbidden/i);
    expect(prisma._milestoneStore.find((m) => m.id === analyticsMs.id).status).not.toBe(
      'MET'
    );

    const certMs = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'TRAINING_CERT'
    );
    const deniedTc = await attestAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: certMs.id,
      reason: 'attempt to attest training cert',
      idempotencyKey: 'attest-tc:1',
    });
    expect(deniedTc.ok).toBe(false);
    expect(deniedTc.error).toMatch(/attestation_mode_forbidden/i);
  });

  it('value READY only via test inject or CS-attested path (not client invent)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-val-ready:1',
      planKey: 'adp-val-ready:1',
    });

    const injected = await recordAdoptionValueOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      outcomeType: 'TIME_TO_FIRST_VALUE',
      allowTestEvidenceInject: true,
      measuredValue: 12,
      analyticsGate: { status: 'AVAILABLE' },
      idempotencyKey: 'val-ready:1',
    });
    expect(injected.ok).toBe(true);
    expect(injected.outcome.status).toMatch(/READY/i);
    expect(injected.outcome.value).toBe(12);
    expect(injected.outcome.value).not.toBeNull();

    const attested = await recordAdoptionValueOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      outcomeType: 'TIME_TO_FIRST_VALUE',
      csAttested: true,
      reason: 'QBR measured TTFV attested by CS',
      measuredValue: 8,
      idempotencyKey: 'val-ready-attest:1',
    });
    expect(attested.ok).toBe(true);
    expect(attested.outcome.status).toMatch(/READY/i);
    expect(attested.outcome.value).toBe(8);
  });

  it('audited completion waiver requires planAccess (cross-tenant denied)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-waiver:1',
      planKey: 'adp-waiver:1',
    });

    const denied = await evaluateAdoptionPlanCompletion(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
      auditedCompletionWaiver: true,
      waiverReason: 'executive audited waiver',
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden === true || /cross_tenant|forbidden|scope/i.test(String(denied.error || ''))).toBe(
      true
    );

    const waived = await evaluateAdoptionPlanCompletion(prisma, {
      actorContext: { admin },
      planId: plan.id,
      auditedCompletionWaiver: true,
      waiverReason: 'executive audited waiver',
    });
    expect(waived.ok).toBe(true);
    expect(waived.waived).toBe(true);
    expect(String(waived.status || '')).toMatch(/WAIVED/i);
  });

  it('PRODUCT_ANALYTICS MET via server Phase 9 firstValue read (not client inject)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-p9:1',
      planKey: 'adp-p9:1',
    });
    await materialiseAdoptionMilestones(prisma, {
      actorContext: { admin },
      planId: plan.id,
      idempotencyKey: 'mat-p9:1',
    });
    const ms = prisma._milestoneStore.find(
      (m) => m.evidenceMode === 'PRODUCT_ANALYTICS'
    );

    prisma.productFirstValueFact = {
      findUnique: vi.fn(async () => ({
        id: 'fv-1',
        tenantId: 'tenant-1',
        featureCode: 'invoices.post',
        ruleVersion: 'first-value-2026-07-29',
        sourceId: 'evt-1',
        occurredAt: new Date('2026-07-30T10:00:00Z'),
      })),
    };
    prisma.platformFeatureEntitlement = {
      findUnique: vi.fn(async () => ({
        tenantId: 'tenant-1',
        featureCode: 'invoices.post',
        status: 'ACTIVE',
        startDate: null,
        endDate: null,
      })),
    };
    prisma.analyticsFactProductUsage = {
      findMany: vi.fn(async () => [
        {
          tenantId: 'tenant-1',
          featureCode: 'invoices.post',
          occurredAt: new Date('2026-07-30T10:00:00Z'),
        },
      ]),
    };

    const result = await evaluateAdoptionMilestone(prisma, {
      actorContext: { admin },
      planId: plan.id,
      milestoneId: ms.id,
    });
    expect(result.ok).toBe(true);
    expect(result.milestone.status).toBe('MET');
    expect(result.evidenceStatus || result.evidence?.status).toMatch(/READY/i);
  });

  it('domain contract exposes wave 2 milestone/value surface', async () => {
    const contract = getAdoptionDomainContract();
    expect(contract.phase).toBe(19);
    expect(contract.fabricateMilestoneMetForbidden).toBe(true);
    expect(contract.fabricatePlanCompletedForbidden).toBe(true);
  });

  it('health returns typed status without inventing COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-health:1',
      planKey: 'adp-health:1',
    });
    const health = await calculateAdoptionHealth(prisma, {
      actorContext: { admin },
      planId: plan.id,
    });
    expect(health.ok).toBe(true);
    expect(health.status).toBeTruthy();
    expect(health.status).not.toBe('COMPLETED');
  });
});
