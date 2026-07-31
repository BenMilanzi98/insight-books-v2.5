/**
 * Phase 19 Wave 3 — Champions, dormancy recovery, Phase 8 intervention links, expansion handoffs.
 * Champions: verified contact; no fabricated engagement scores.
 * Dormancy: VALUE_THEN_INACTIVE / inactive-class; analytics missing → UNAVAILABLE (not healthy zero).
 * RECOVERED requires usage-return snapshot and/or attested outreach.
 * Expansion: DRAFT→HANDED_OFF→ACKNOWLEDGED; no Subscription/entitlement/invoice/GL writes.
 * Idempotent expansion; writes via loadAdoptionPlanForActor.
 * Intervention link requires real Phase 8 intervention id.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  ADOPTION_PLAN_NUMBER_RE,
  ensureWave1DefaultPlanTemplateVersion,
  createManualAdoptionRequest,
  acceptAdoptionRequest,
  createCustomerAdoptionPlan,
  upsertAdoptionChampion,
  listDormancyRiskQueue,
  openDormancyRecoveryCase,
  linkPhase8Intervention,
  attestDormancyOutcome,
  createExpansionHandoff,
  acknowledgeExpansionHandoff,
  loadAdoptionPlanForActor,
  transitionAdoptionPlanStatus,
  getAdoptionDomainContract,
} from '@/lib/admin/customerSuccess/adoption';

function superAdmin(id = 'super-adp-w3-1') {
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
  const championStore = overrides._championStore || [];
  const dormancyStore = overrides._dormancyStore || [];
  const interventionLinkStore = overrides._interventionLinkStore || [];
  const expansionStore = overrides._expansionStore || [];
  const contactStore = overrides._contactStore || [
    {
      id: 'contact-verified-1',
      verificationStatus: 'VERIFIED',
      email: 'champ@example.com',
      name: 'Verified Champion',
    },
    {
      id: 'contact-unverified-1',
      verificationStatus: 'PENDING',
      email: 'pending@example.com',
      name: 'Pending Contact',
    },
  ];
  const csInterventionStore = overrides._csInterventionStore || [
    {
      id: 'cs-int-1',
      tenantId: 'tenant-1',
      type: 'OUTREACH_CALL',
      notes: 'Phase 8 intervention',
      performedAt: new Date('2026-07-30T10:00:00Z'),
      createdAt: new Date('2026-07-30T10:00:00Z'),
    },
  ];
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
  ];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _requestStore: requestStore,
    _planStore: planStore,
    _championStore: championStore,
    _dormancyStore: dormancyStore,
    _interventionLinkStore: interventionLinkStore,
    _expansionStore: expansionStore,
    _contactStore: contactStore,
    _csInterventionStore: csInterventionStore,
    _templateVersionStore: templateVersionStore,
    accountSubscription: {
      update: vi.fn(async () => {
        throw new Error('FORBIDDEN_subscription_mutate');
      }),
      create: vi.fn(async () => {
        throw new Error('FORBIDDEN_subscription_mutate');
      }),
    },
    platformFeatureEntitlement: {
      update: vi.fn(async () => {
        throw new Error('FORBIDDEN_entitlement_mutate');
      }),
      create: vi.fn(async () => {
        throw new Error('FORBIDDEN_entitlement_mutate');
      }),
    },
    platformInvoice: {
      create: vi.fn(async () => {
        throw new Error('FORBIDDEN_invoice_mutate');
      }),
      update: vi.fn(async () => {
        throw new Error('FORBIDDEN_invoice_mutate');
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
    customerTrainingProgram: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return trainingProgramStore.find((r) => r.id === where.id) || null;
        return null;
      }),
    },
    crmContact: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((c) => c.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return contactStore.find((c) => c.id === where.id) || null;
        return null;
      }),
    },
    csIntervention: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return csInterventionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return csInterventionStore.find((r) => r.id === where.id) || null;
        return null;
      }),
      findMany: vi.fn(async () => [...csInterventionStore]),
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `cs-int-${csInterventionStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
        };
        csInterventionStore.push(row);
        return row;
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
        return templateStore.find((t) => t.templateCode === where.templateCode) || null;
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
    customerAdoptionChampion: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adch-${championStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        championStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          championStore.find((c) => {
            if (where.planId && c.planId !== where.planId) return false;
            if (where.contactId && c.contactId !== where.contactId) return false;
            if (where.role && c.role !== where.role) return false;
            if (where.id && c.id !== where.id) return false;
            return true;
          }) || null
        );
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return championStore.find((c) => c.id === where.id) || null;
        if (where.planId_contactId_role) {
          const { planId, contactId, role } = where.planId_contactId_role;
          return (
            championStore.find(
              (c) => c.planId === planId && c.contactId === contactId && c.role === role
            ) || null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = championStore.find((c) => c.id === where.id);
        if (!row) throw new Error('champion not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return championStore.filter((c) => {
          if (where.planId && c.planId !== where.planId) return false;
          return true;
        });
      }),
    },
    customerAdoptionDormancyCase: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `addr-${dormancyStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        dormancyStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return dormancyStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return dormancyStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          dormancyStore.find((r) => {
            if (where.planId && r.planId !== where.planId) return false;
            if (where.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) return false;
            if (where.signalIdentity && r.signalIdentity !== where.signalIdentity) return false;
            if (where.id && r.id !== where.id) return false;
            return true;
          }) || null
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = dormancyStore.find((r) => r.id === where.id);
        if (!row) throw new Error('dormancy case not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return dormancyStore.filter((r) => {
          if (where.planId && r.planId !== where.planId) return false;
          if (where.tenantId && r.tenantId !== where.tenantId) return false;
          return true;
        });
      }),
    },
    customerAdoptionInterventionLink: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `adil-${interventionLinkStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
        };
        interventionLinkStore.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          interventionLinkStore.find((r) => {
            if (where.dormancyCaseId && r.dormancyCaseId !== where.dormancyCaseId) return false;
            if (where.interventionId && r.interventionId !== where.interventionId) return false;
            return true;
          }) || null
        );
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return interventionLinkStore.filter((r) => {
          if (where.dormancyCaseId && r.dormancyCaseId !== where.dormancyCaseId) return false;
          return true;
        });
      }),
    },
    customerAdoptionExpansionHandoff: {
      create: vi.fn(async ({ data }) => {
        if (
          data.idempotencyKey &&
          expansionStore.some((r) => r.idempotencyKey === data.idempotencyKey)
        ) {
          const err = new Error('Unique constraint failed on idempotencyKey');
          err.code = 'P2002';
          throw err;
        }
        const row = {
          id: data.id || `adeh-${expansionStore.length + 1}`,
          ...data,
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
        };
        expansionStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return expansionStore.find((r) => r.id === where.id) || null;
        if (where.idempotencyKey) {
          return expansionStore.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
        }
        return null;
      }),
      findFirst: vi.fn(async ({ where = {} } = {}) => {
        return (
          expansionStore.find((r) => {
            if (where.planId && r.planId !== where.planId) return false;
            if (where.idempotencyKey && r.idempotencyKey !== where.idempotencyKey) return false;
            if (where.id && r.id !== where.id) return false;
            return true;
          }) || null
        );
      }),
      update: vi.fn(async ({ where, data }) => {
        const row = expansionStore.find((r) => r.id === where.id);
        if (!row) throw new Error('expansion handoff not found');
        Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
        return row;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        return expansionStore.filter((r) => {
          if (where.planId && r.planId !== where.planId) return false;
          return true;
        });
      }),
    },
  };

  return prisma;
}

async function seedActivePlan(prisma, admin, opts = {}) {
  const tmpl = await ensureWave1DefaultPlanTemplateVersion(prisma, {
    actorContext: { admin },
  });
  const created = await createManualAdoptionRequest(prisma, {
    actorContext: { admin },
    customerId: 'cust-1',
    tenantId: 'tenant-1',
    subscriptionId: 'sub-1',
    trainingProgramId: opts.trainingProgramId || 'trn-prog-completed',
    idempotencyKey: opts.requestKey || `adr-w3:${Date.now()}:${Math.random()}`,
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
    idempotencyKey: opts.planKey || `adp-w3:${Date.now()}:${Math.random()}`,
  });
  expect(plan.ok).toBe(true);
  expect(plan.plan.planNumber).toMatch(ADOPTION_PLAN_NUMBER_RE);

  // Move to COMPLETED for handoff tests when requested
  if (opts.markCompleted) {
    const row = prisma._planStore.find((p) => p.id === plan.plan.id);
    row.status = 'COMPLETED';
  } else {
    const row = prisma._planStore.find((p) => p.id === plan.plan.id);
    if (row.status === 'DRAFT') row.status = 'ACTIVE';
  }

  return {
    plan: plan.plan,
    planRow: prisma._planStore.find((p) => p.id === plan.plan.id),
    templateVersion: tmpl.templateVersion,
    request: created.request,
  };
}

describe('Phase 19 Wave 3 — Champions / dormancy / interventions / expansion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upsertAdoptionChampion requires verified contact and rejects engagement scores', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-champ:1',
      planKey: 'adp-champ:1',
    });

    const unverified = await upsertAdoptionChampion(prisma, {
      actorContext: { admin },
      planId: plan.id,
      contactId: 'contact-unverified-1',
      role: 'CHAMPION',
      enablementStatus: 'IDENTIFIED',
    });
    expect(unverified.ok).toBe(false);
    expect(String(unverified.error || '')).toMatch(/CONTACT_NOT_VERIFIED/i);

    const withScore = await upsertAdoptionChampion(prisma, {
      actorContext: { admin },
      planId: plan.id,
      contactId: 'contact-verified-1',
      role: 'CHAMPION',
      enablementStatus: 'ENABLED',
      engagementScore: 87,
    });
    expect(withScore.ok).toBe(false);
    expect(String(withScore.error || '')).toMatch(/engagement_score_forbidden|fabricated/i);

    const ok = await upsertAdoptionChampion(prisma, {
      actorContext: { admin },
      planId: plan.id,
      contactId: 'contact-verified-1',
      role: 'CHAMPION',
      enablementStatus: 'ENABLED',
      lastEvidenceRef: 'ades-1',
      idempotencyKey: 'champ:1',
    });
    expect(ok.ok).toBe(true);
    expect(ok.champion.contactId).toBe('contact-verified-1');
    expect(ok.champion.engagementScore).toBeUndefined();
    expect(ok.champion).not.toHaveProperty('engagementScore');
  });

  it('listDormancyRiskQueue: analytics missing → UNAVAILABLE (not healthy zero)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-dorm-q:1',
      planKey: 'adp-dorm-q:1',
    });

    const missing = await listDormancyRiskQueue(prisma, {
      actorContext: { admin },
      planId: plan.id,
      tenantId: 'tenant-1',
      analyticsAvailable: false,
    });
    expect(missing.ok).toBe(true);
    expect(missing.status).toMatch(/UNAVAILABLE/i);
    expect(missing.items).toEqual([]);
    expect(missing.healthyEmpty).not.toBe(true);
    expect(missing.totalRiskCount).toBeNull();

    // Live HTTP path: no analyticsAvailable/signals inject — missing Phase 9
    // fact/first-value delegates must be UNAVAILABLE, never READY+healthyEmpty.
    expect(prisma.analyticsFactProductUsage).toBeUndefined();
    expect(prisma.productFirstValueFact).toBeUndefined();
    const liveMissingPlane = await listDormancyRiskQueue(prisma, {
      actorContext: { admin },
      planId: plan.id,
      tenantId: 'tenant-1',
    });
    expect(liveMissingPlane.ok).toBe(true);
    expect(liveMissingPlane.status).toMatch(/UNAVAILABLE/i);
    expect(liveMissingPlane.healthyEmpty).toBe(false);
    expect(liveMissingPlane.totalRiskCount).toBeNull();
    expect(String(liveMissingPlane.reasonCode || '')).toMatch(
      /phase9_fact_plane|analytics_unavailable/i
    );

    const withSignals = await listDormancyRiskQueue(prisma, {
      actorContext: { admin },
      planId: plan.id,
      tenantId: 'tenant-1',
      analyticsAvailable: true,
      allowTestSignalInject: true,
      signals: [
        {
          identity: 'psig:tenant-1:product.value_then_inactive:invoices.post',
          code: 'product.value_then_inactive',
          featureCode: 'invoices.post',
          severity: 'HIGH',
          kind: 'risk',
        },
      ],
    });
    expect(withSignals.ok).toBe(true);
    expect(withSignals.status).toMatch(/READY|AVAILABLE/i);
    expect(withSignals.items.length).toBe(1);
    expect(withSignals.items[0].code).toMatch(/value_then_inactive/i);
  });

  it('dormancy RECOVERED without usage-return or attested outreach fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-dorm:1',
      planKey: 'adp-dorm:1',
    });

    const opened = await openDormancyRecoveryCase(prisma, {
      actorContext: { admin },
      planId: plan.id,
      signalIdentity: 'psig:tenant-1:product.value_then_inactive:invoices.post',
      signalCode: 'product.value_then_inactive',
      featureCode: 'invoices.post',
      idempotencyKey: 'dorm:1',
    });
    expect(opened.ok).toBe(true);
    expect(opened.case.status).toBe('OPEN');

    const bad = await attestDormancyOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      outcome: 'RECOVERED',
      reason: 'looks fine now',
    });
    expect(bad.ok).toBe(false);
    expect(String(bad.error || '')).toMatch(/RECOVERED_EVIDENCE_REQUIRED|usage.?return|outreach/i);
    expect(prisma._dormancyStore.find((c) => c.id === opened.case.id).status).not.toBe(
      'RECOVERED'
    );

    // Client-forged usageReturnSnapshot without inject must not unlock RECOVERED
    const forged = await attestDormancyOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      outcome: 'RECOVERED',
      usageReturnSnapshot: {
        sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
        observedAt: new Date('2026-07-31T12:00:00Z').toISOString(),
        returned: true,
        featureCode: 'invoices.post',
      },
      reason: 'forged client snapshot',
    });
    expect(forged.ok).toBe(false);
    expect(String(forged.error || '')).toMatch(/RECOVERED_EVIDENCE_REQUIRED|usage.?return|outreach/i);

    const recovered = await attestDormancyOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      outcome: 'RECOVERED',
      allowTestEvidenceInject: true,
      usageReturnSnapshot: {
        sourceSystem: 'PHASE_9_PRODUCT_ANALYTICS',
        observedAt: new Date('2026-07-31T12:00:00Z').toISOString(),
        returned: true,
        featureCode: 'invoices.post',
      },
      reason: 'usage returned',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.case.status).toBe('RECOVERED');
  });

  it('dormancy RECOVERED via attested outreach + reason (manage+planAccess)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-dorm-out:1',
      planKey: 'adp-dorm-out:1',
    });
    const opened = await openDormancyRecoveryCase(prisma, {
      actorContext: { admin },
      planId: plan.id,
      signalCode: 'product.value_then_inactive',
      featureCode: 'invoices.post',
      idempotencyKey: 'dorm-out:1',
    });
    expect(opened.ok).toBe(true);

    const noReason = await attestDormancyOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      outcome: 'RECOVERED',
      outreachAttested: true,
    });
    expect(noReason.ok).toBe(false);

    const recovered = await attestDormancyOutcome(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      outcome: 'RECOVERED',
      outreachAttested: true,
      reason: 'Customer confirmed return-to-usage on call',
    });
    expect(recovered.ok).toBe(true);
    expect(recovered.case.status).toBe('RECOVERED');
  });

  it('dormancy queue denies foreign tenantId (with/without planId)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const agent = {
      id: 'agent-dorm-scope',
      role: 'Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    };
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-dorm-scope:1',
      planKey: 'adp-dorm-scope:1',
    });

    const foreignOnly = await listDormancyRiskQueue(prisma, {
      actorContext: { admin: agent },
      tenantId: 'tenant-foreign',
      portfolioTenantIds: ['tenant-owned'],
      allowTestSignalInject: true,
      signals: [
        {
          identity: 'psig:tenant-foreign:product.value_then_inactive:invoices.post',
          code: 'product.value_then_inactive',
        },
      ],
    });
    expect(foreignOnly.ok).toBe(false);
    expect(
      foreignOnly.forbidden === true ||
        /out_of_scope|forbidden|mismatch/i.test(String(foreignOnly.error || ''))
    ).toBe(true);

    const coverPlan = await listDormancyRiskQueue(prisma, {
      actorContext: { admin: agent },
      planId: plan.id,
      tenantId: 'tenant-foreign',
      portfolioTenantIds: ['tenant-1'],
      allowTestSignalInject: true,
      signals: [
        {
          identity: 'psig:tenant-foreign:product.value_then_inactive:invoices.post',
          code: 'product.value_then_inactive',
        },
      ],
    });
    expect(coverPlan.ok).toBe(false);
    expect(
      coverPlan.forbidden === true ||
        /mismatch|out_of_scope|forbidden/i.test(String(coverPlan.error || ''))
    ).toBe(true);
  });

  it('linkPhase8Intervention requires a real Phase 8 intervention id', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-int:1',
      planKey: 'adp-int:1',
    });

    const opened = await openDormancyRecoveryCase(prisma, {
      actorContext: { admin },
      planId: plan.id,
      signalIdentity: 'psig:tenant-1:product.value_then_inactive:invoices.post',
      signalCode: 'product.value_then_inactive',
      featureCode: 'invoices.post',
      idempotencyKey: 'dorm-int:1',
    });
    expect(opened.ok).toBe(true);

    const missing = await linkPhase8Intervention(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      interventionId: 'does-not-exist',
    });
    expect(missing.ok).toBe(false);
    expect(String(missing.error || '')).toMatch(
      /intervention_not_found|PHASE_8_INTERVENTION|invalid_intervention/i
    );

    const linked = await linkPhase8Intervention(prisma, {
      actorContext: { admin },
      planId: plan.id,
      dormancyCaseId: opened.case.id,
      interventionId: 'cs-int-1',
    });
    expect(linked.ok).toBe(true);
    expect(linked.case.status).toBe('INTERVENTION_LINKED');
    expect(linked.link.interventionId).toBe('cs-int-1');
  });

  it('expansion handoff is idempotent and stops at ACKNOWLEDGED without billing writes', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const ackAdmin = superAdmin('super-adp-w3-ack');
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-exp:1',
      planKey: 'adp-exp:1',
      markCompleted: true,
    });

    const first = await createExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      targetQueue: 'RENEWALS',
      signalPackage: { reason: 'expansion candidate', evidenceRefs: ['ades-1'] },
      idempotencyKey: 'exp:1',
    });
    expect(first.ok).toBe(true);
    expect(first.handoff.status).toBe('DRAFT');
    expect(first.handoff.targetQueue).toBe('RENEWALS');
    expect(first.meta?.mutatesSubscription).toBe(false);
    expect(first.meta?.mutatesEntitlement).toBe(false);
    expect(first.meta?.mutatesInvoice).toBe(false);

    const retry = await createExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      targetQueue: 'RENEWALS',
      signalPackage: { reason: 'expansion candidate', evidenceRefs: ['ades-1'] },
      idempotencyKey: 'exp:1',
    });
    expect(retry.ok).toBe(true);
    expect(retry.handoff.id).toBe(first.handoff.id);
    expect(retry.alreadyExists || retry.idempotentReplay).toBe(true);
    expect(prisma._expansionStore.length).toBe(1);

    // Concurrent race: pre-check misses, create hits P2002 unique → replay existing.
    prisma.customerAdoptionExpansionHandoff.findUnique.mockResolvedValueOnce(null);
    prisma.customerAdoptionExpansionHandoff.findFirst.mockResolvedValueOnce(null);
    const raced = await createExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      targetQueue: 'RENEWALS',
      signalPackage: { reason: 'expansion candidate', evidenceRefs: ['ades-1'] },
      idempotencyKey: 'exp:1',
    });
    expect(raced.ok).toBe(true);
    expect(raced.handoff.id).toBe(first.handoff.id);
    expect(raced.alreadyExists || raced.idempotentReplay).toBe(true);
    expect(prisma._expansionStore.length).toBe(1);

    const handed = await acknowledgeExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      handoffId: first.handoff.id,
      action: 'hand_off',
    });
    expect(handed.ok).toBe(true);
    expect(handed.handoff.status).toBe('HANDED_OFF');

    const ack = await acknowledgeExpansionHandoff(prisma, {
      actorContext: { admin: ackAdmin },
      planId: plan.id,
      handoffId: first.handoff.id,
    });
    expect(ack.ok).toBe(true);
    expect(ack.handoff.status).toBe('ACKNOWLEDGED');

    expect(prisma.accountSubscription.update).not.toHaveBeenCalled();
    expect(prisma.accountSubscription.create).not.toHaveBeenCalled();
    expect(prisma.platformFeatureEntitlement.update).not.toHaveBeenCalled();
    expect(prisma.platformInvoice.create).not.toHaveBeenCalled();
  });

  it('expansion ACK SoD denies creator acknowledger by default', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-sod:1',
      planKey: 'adp-sod:1',
      markCompleted: true,
    });

    const created = await createExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      targetQueue: 'RENEWALS',
      idempotencyKey: 'exp-sod:1',
    });
    expect(created.ok).toBe(true);

    const handed = await acknowledgeExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      handoffId: created.handoff.id,
      action: 'hand_off',
    });
    expect(handed.ok).toBe(true);

    const selfAck = await acknowledgeExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      handoffId: created.handoff.id,
      enforceCreatorAckSoD: false, // client opt-out must be ignored
    });
    expect(selfAck.ok).toBe(false);
    expect(String(selfAck.error || '')).toMatch(/sod_creator_cannot_acknowledge/i);

    const other = superAdmin('super-adp-w3-sod-ack');
    const ack = await acknowledgeExpansionHandoff(prisma, {
      actorContext: { admin: other },
      planId: plan.id,
      handoffId: created.handoff.id,
    });
    expect(ack.ok).toBe(true);
    expect(ack.handoff.status).toBe('ACKNOWLEDGED');
  });

  it('expansion create/ack writes use loadAdoptionPlanForActor (cross-tenant denied)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-x:1',
      planKey: 'adp-x:1',
      markCompleted: true,
    });

    const denied = await createExpansionHandoff(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
      targetQueue: 'SALES',
      idempotencyKey: 'exp-x:1',
    });
    expect(denied.ok).toBe(false);
    expect(
      denied.forbidden === true || /cross_tenant|forbidden|scope/i.test(String(denied.error || ''))
    ).toBe(true);

    const access = await loadAdoptionPlanForActor(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
    });
    expect(access.ok).toBe(false);

    const champDenied = await upsertAdoptionChampion(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      planId: plan.id,
      contactId: 'contact-verified-1',
      role: 'CHAMPION',
    });
    expect(champDenied.ok).toBe(false);
  });

  it('HANDED_TO_RENEWALS allowed after expansion handoff HANDED_OFF|ACKNOWLEDGED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { plan } = await seedActivePlan(prisma, admin, {
      requestKey: 'adr-htr:1',
      planKey: 'adp-htr:1',
      markCompleted: true,
    });

    const blocked = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      planId: plan.id,
      toStatus: 'HANDED_TO_RENEWALS',
    });
    expect(blocked.ok).toBe(false);
    expect(String(blocked.error || '')).toMatch(/HANDOFF_POLICY_REQUIRED/i);

    const handoff = await createExpansionHandoff(prisma, {
      actorContext: { admin },
      planId: plan.id,
      targetQueue: 'RENEWALS',
      status: 'HANDED_OFF',
      idempotencyKey: 'exp-htr:1',
    });
    expect(handoff.ok).toBe(true);
    expect(handoff.handoff.status).toBe('HANDED_OFF');

    const ok = await transitionAdoptionPlanStatus(prisma, {
      actorContext: { admin },
      planId: plan.id,
      toStatus: 'HANDED_TO_RENEWALS',
    });
    expect(ok.ok).toBe(true);
    expect(ok.plan.status).toBe('HANDED_TO_RENEWALS');
  });

  it('domain contract exposes wave 3 dormancy/expansion surface', async () => {
    const contract = getAdoptionDomainContract();
    expect(contract.phase).toBe(19);
    expect(contract.wave).toBeGreaterThanOrEqual(3);
    expect(contract.fabricateEngagementScoreForbidden).toBe(true);
    expect(contract.expansionMutatesBillingForbidden).toBe(true);
    expect(contract.dormancyRecoveredWithoutEvidenceForbidden).toBe(true);
  });
});
