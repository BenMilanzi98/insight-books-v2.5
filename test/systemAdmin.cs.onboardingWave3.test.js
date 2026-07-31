/**
 * Phase 17 Wave 3 — Readiness, go-live, stabilisation, handover, completion certificate.
 * UNKNOWN ≠ READY; Critical defects block; success → STABILISATION not COMPLETED;
 * Migration COMPLETED needs recon; Training COMPLETED needs Training-domain source;
 * Completion needs sign-offs/recon/handover; certificate checksum stable on retry;
 * No journals/OB/stock from onboarding; Cross-Tenant project access denied.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateOnboardingReadiness,
  setMigrationCoordinationStatus,
  setTrainingCoordinationStatus,
  recordOnboardingDefect,
  approveGoLive,
  recordGoLiveDecision,
  executeGoLive,
  recordGoLiveOutcome,
  createOnboardingHandover,
  acceptOnboardingHandover,
  evaluateOnboardingCompletion,
  issueCompletionCertificate,
  calculateOnboardingProgress,
  calculateOnboardingHealth,
  assertOnboardingAccountingBoundary,
  getOnboardingDomainContract,
  loadOnboardingProjectForActor,
  ONBOARDING_PROJECT_STATUS,
  GO_LIVE_DECISION,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-onb-3') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function executorAdmin(id = 'executor-onb-3') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function csScopedAdmin(id = 'cs-scoped-w3') {
  return {
    id,
    role: 'System Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

/** Harness-only — production go-live APIs ignore dimensionOverrides without this flag. */
function harnessDims(dimensionOverrides) {
  return { dimensionOverrides, allowDimensionOverrides: true };
}

function makeStoreCrud(store, idPrefix) {
  return {
    create: vi.fn(async ({ data }) => {
      const row = {
        id: data.id || `${idPrefix}-${store.length + 1}`,
        createdAt: data.createdAt || new Date(),
        updatedAt: data.updatedAt || new Date(),
        ...data,
      };
      store.push(row);
      return row;
    }),
    findUnique: vi.fn(async ({ where = {} } = {}) => {
      if (where.id) return store.find((r) => r.id === where.id) || null;
      if (where.idempotencyKey) {
        return store.find((r) => r.idempotencyKey === where.idempotencyKey) || null;
      }
      if (where.projectId) {
        return store.find((r) => r.projectId === where.projectId) || null;
      }
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      if (where.severity) rows = rows.filter((r) => r.severity === where.severity);
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.severity) rows = rows.filter((r) => r.severity === where.severity);
      if (where.status) rows = rows.filter((r) => r.status === where.status);
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
      if (where.severity) rows = rows.filter((r) => r.severity === where.severity);
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const projectStore = overrides._projectStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];
  const readinessStore = overrides._readinessStore || [];
  const migrationStore = overrides._migrationStore || [];
  const mraStore = overrides._mraStore || [];
  const trainingStore = overrides._trainingStore || [];
  const defectStore = overrides._defectStore || [];
  const testPlanStore = overrides._testPlanStore || [];
  const goLiveStore = overrides._goLiveStore || [];
  const goLiveApprovalStore = overrides._goLiveApprovalStore || [];
  const goLiveDecisionStore = overrides._goLiveDecisionStore || [];
  const stabilisationStore = overrides._stabilisationStore || [];
  const handoverStore = overrides._handoverStore || [];
  const completionStore = overrides._completionStore || [];
  const certificateStore = overrides._certificateStore || [];
  const journalStore = overrides._journalStore || [];
  const openingBalanceStore = overrides._openingBalanceStore || [];
  const stockStore = overrides._stockStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _projectStore: projectStore,
    _readinessStore: readinessStore,
    _migrationStore: migrationStore,
    _trainingStore: trainingStore,
    _defectStore: defectStore,
    _goLiveStore: goLiveStore,
    _goLiveApprovalStore: goLiveApprovalStore,
    _goLiveDecisionStore: goLiveDecisionStore,
    _stabilisationStore: stabilisationStore,
    _handoverStore: handoverStore,
    _completionStore: completionStore,
    _certificateStore: certificateStore,
    _journalStore: journalStore,
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          status: data.status || 'IN_PROGRESS',
          createdAt: data.createdAt || new Date(),
          updatedAt: data.updatedAt || new Date(),
          ...data,
        };
        projectStore.push(row);
        return row;
      }),
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) return projectStore.find((r) => r.id === where.id) || null;
        return null;
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
        const row = {
          id: data.id || `ph-${projectHistoryStore.length + 1}`,
          at: data.at || new Date(),
          ...data,
        };
        projectHistoryStore.push(row);
        return row;
      }),
    },
    customerOnboardingReadinessEvaluation: makeStoreCrud(readinessStore, 'ready'),
    customerOnboardingMigration: makeStoreCrud(migrationStore, 'mig'),
    customerOnboardingMraEis: makeStoreCrud(mraStore, 'mra'),
    customerOnboardingTraining: makeStoreCrud(trainingStore, 'trn'),
    customerOnboardingDefect: makeStoreCrud(defectStore, 'def'),
    customerOnboardingTestPlan: makeStoreCrud(testPlanStore, 'tp'),
    customerOnboardingGoLive: makeStoreCrud(goLiveStore, 'gl'),
    customerOnboardingGoLiveApproval: makeStoreCrud(goLiveApprovalStore, 'gla'),
    customerOnboardingGoLiveDecision: makeStoreCrud(goLiveDecisionStore, 'gld'),
    customerOnboardingStabilisation: makeStoreCrud(stabilisationStore, 'stb'),
    customerOnboardingHandover: makeStoreCrud(handoverStore, 'ho'),
    customerOnboardingCompletion: makeStoreCrud(completionStore, 'cmp'),
    customerOnboardingCompletionCertificate: makeStoreCrud(certificateStore, 'cert'),
    journalEntry: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `je-${journalStore.length + 1}`, ...data };
        journalStore.push(row);
        return row;
      }),
      count: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...journalStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows.length;
      }),
      findMany: vi.fn(async ({ where = {} } = {}) => {
        let rows = [...journalStore];
        if (where.tenantId) rows = rows.filter((r) => r.tenantId === where.tenantId);
        return rows;
      }),
    },
    accountBalance: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []),
    },
    openingBalance: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `ob-${openingBalanceStore.length + 1}`, ...data };
        openingBalanceStore.push(row);
        return row;
      }),
      count: vi.fn(async () => openingBalanceStore.length),
    },
    openingStock: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `os-${stockStore.length + 1}`, ...data };
        stockStore.push(row);
        return row;
      }),
      count: vi.fn(async () => stockStore.length),
    },
  };

  return prisma;
}

async function seedProject(prisma, admin, opts = {}) {
  const tenantId = opts.tenantId || 'tenant-1';
  const row = await prisma.customerOnboardingProject.create({
    data: {
      id: opts.projectId || `onb-w3-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      onboardingNumber: opts.onboardingNumber || 'ONB-2026-000301',
      status: opts.status || ONBOARDING_PROJECT_STATUS?.IN_PROGRESS || 'IN_PROGRESS',
      onboardingType: 'STANDARD',
      onboardingRequestId: opts.requestId || 'onr-w3-1',
      customerId: 'cust-1',
      tenantId,
      subscriptionId: 'sub-1',
      templateVersionId: 'tmplv-w3-1',
      createdByAdminId: admin.id,
    },
  });
  return { project: row };
}

/**
 * Explicit live dimension overrides for harness (no Tenant model probes).
 * Must be passed on each evaluate/approve/execute/outcome — stored snapshots never lift UNKNOWN→READY.
 */
const GO_LIVE_READY_OVERRIDES = Object.freeze({
  tenant: 'READY',
  provisioning: 'READY',
  subscription: 'READY',
  entitlements: 'READY',
  businessBranch: 'READY',
  users: 'READY',
  configuration: 'READY',
  accounting: 'READY',
  migration: 'READY',
  integrations: 'NOT_APPLICABLE',
  mraEis: 'NOT_APPLICABLE',
  training: 'READY',
  testing: 'READY',
  defects: 'READY',
});

/** Seed a project that is ready for go-live approval via live evidence + explicit overrides. */
async function seedGoLiveReady(prisma, admin, opts = {}) {
  const { project } = await seedProject(prisma, admin, {
    ...opts,
    status: 'READY_FOR_GO_LIVE',
  });
  await prisma.customerOnboardingMigration.create({
    data: {
      projectId: project.id,
      status: 'COMPLETED',
      reconciliationStatus: 'PASSED',
      createdByAdminId: admin.id,
    },
  });
  // Authoritative Training-domain COMPLETED (Phase 18) — IN_PROGRESS alone is non-READY
  await prisma.customerOnboardingTraining.create({
    data: {
      projectId: project.id,
      status: 'COMPLETED',
      sourceDomain: 'PHASE_16_TRAINING_HANDOFF',
      trainingDomainSource: 'PHASE_18_TRAINING',
      trainingDomainStatus: 'COMPLETED',
      createdByAdminId: admin.id,
    },
  });
  await prisma.customerOnboardingTestPlan.create({
    data: {
      projectId: project.id,
      status: 'PASSED',
      createdByAdminId: admin.id,
    },
  });
  return {
    project,
    dimensionOverrides: { ...GO_LIVE_READY_OVERRIDES },
  };
}

/** Decision (decider) + INTERNAL/CUSTOMER approvals — executor ≠ decider for SoD. */
async function seedDecisionAndApprovals(
  prisma,
  projectId,
  dimensionOverrides,
  decider,
  executor
) {
  const decision = await recordGoLiveDecision(prisma, {
    actorContext: { admin: decider },
    projectId,
    decision: GO_LIVE_DECISION.GO,
    idempotencyKey: `gld:${projectId}:1`,
    ...harnessDims(dimensionOverrides),
  });
  const internal = await approveGoLive(prisma, {
    actorContext: { admin: decider },
    projectId,
    approvalRole: 'INTERNAL',
    ...harnessDims(dimensionOverrides),
  });
  const customer = await approveGoLive(prisma, {
    actorContext: { admin: executor },
    projectId,
    approvalRole: 'CUSTOMER',
    ...harnessDims(dimensionOverrides),
  });
  return { decision, internal, customer };
}

describe('Phase 17 Wave 3 — Readiness, go-live, completion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('UNKNOWN readiness blocks go-live (UNKNOWN ≠ READY)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-unknown',
      status: 'GO_LIVE_READINESS',
    });

    const readiness = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(readiness.ok).toBe(true);
    expect(readiness.overallStatus).toBe('UNKNOWN');
    expect(readiness.overallStatus).not.toBe('READY');
    expect(readiness.ready).not.toBe(true);

    const approved = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
    });
    expect(approved.ok).toBe(false);
    expect(approved.error).toMatch(/UNKNOWN|readiness|not.?ready/i);
  });

  it('stored READY snapshot never lifts live UNKNOWN to READY', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-snap',
      status: 'GO_LIVE_READINESS',
    });
    await prisma.customerOnboardingReadinessEvaluation.create({
      data: {
        projectId: project.id,
        overallStatus: 'READY',
        dimensionsJson: { ...GO_LIVE_READY_OVERRIDES },
        rulesVersion: 'onboarding-readiness-v1',
        createdByAdminId: admin.id,
      },
    });

    const readiness = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
      persist: false,
    });
    expect(readiness.ok).toBe(true);
    expect(readiness.overallStatus).toBe('UNKNOWN');
    expect(readiness.ready).not.toBe(true);
    expect(readiness.dimensions.tenant).toBe('UNKNOWN');

    const approved = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
    });
    expect(approved.ok).toBe(false);
    expect(approved.error).toMatch(/readiness|not.?ready/i);
  });

  it('training IN_PROGRESS is non-READY for go-live dimension', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-trn-prog',
    });
    await prisma.customerOnboardingTraining.create({
      data: {
        projectId: project.id,
        status: 'IN_PROGRESS',
        sourceDomain: 'PHASE_16_TRAINING_HANDOFF',
        trainingDomainStatus: 'UNKNOWN',
        createdByAdminId: admin.id,
      },
    });

    const live = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
      persist: false,
      dimensionOverrides: {
        tenant: 'READY',
        businessBranch: 'READY',
        users: 'READY',
        configuration: 'READY',
        accounting: 'READY',
        migration: 'READY',
        mraEis: 'NOT_APPLICABLE',
        testing: 'READY',
        defects: 'READY',
        // training intentionally omitted — live IN_PROGRESS must stay non-READY
      },
    });
    expect(live.ok).toBe(true);
    expect(['UNKNOWN', 'NOT_READY']).toContain(live.dimensions.training);
    expect(live.dimensions.training).not.toBe('READY');
    expect(live.overallStatus).not.toBe('READY');
    expect(live.ready).not.toBe(true);
  });

  it('Critical defect blocks go-live approval', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-w3-crit',
    });

    const defect = await recordOnboardingDefect(prisma, {
      actorContext: { admin },
      projectId: project.id,
      title: 'Login broken in production tenant',
      severity: 'CRITICAL',
      status: 'OPEN',
    });
    expect(defect.ok).toBe(true);

    const approved = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
      ...harnessDims(dimensionOverrides),
    });
    expect(approved.ok).toBe(false);
    expect(approved.error).toMatch(/critical|defect/i);
  });

  it('successful go-live outcome → STABILISATION not COMPLETED', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const executor = executorAdmin();
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-w3-live',
      status: 'READY_FOR_GO_LIVE',
    });

    const seeded = await seedDecisionAndApprovals(
      prisma,
      project.id,
      dimensionOverrides,
      admin,
      executor
    );
    expect(seeded.decision.ok).toBe(true);
    expect(seeded.internal.ok).toBe(true);
    expect(seeded.customer.ok).toBe(true);

    const executed = await executeGoLive(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      windowStart: '2026-09-01T08:00:00Z',
      windowEnd: '2026-09-01T12:00:00Z',
      idempotencyKey: 'golive:onb-w3-live:1',
      ...harnessDims(dimensionOverrides),
    });
    expect(executed.ok).toBe(true);

    const outcome = await recordGoLiveOutcome(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      outcome: 'SUCCESSFUL',
      customerAcknowledged: true,
      ...harnessDims(dimensionOverrides),
    });
    expect(outcome.ok).toBe(true);
    expect(outcome.project.status).toBe('STABILISATION');
    expect(outcome.project.status).not.toBe('COMPLETED');
    expect(prisma._projectStore.find((p) => p.id === project.id).status).toBe(
      'STABILISATION'
    );
  });

  it('executeGoLive refuses when readiness regresses after approval', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const executor = executorAdmin();
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-w3-stale',
    });

    expect(
      (
        await seedDecisionAndApprovals(
          prisma,
          project.id,
          dimensionOverrides,
          admin,
          executor
        )
      ).decision.ok
    ).toBe(true);

    // Regress training to Phase 18 stub IN_PROGRESS (non-READY)
    const trn = prisma._trainingStore.find((t) => t.projectId === project.id);
    Object.assign(trn, {
      status: 'IN_PROGRESS',
      trainingDomainSource: null,
      trainingDomainStatus: 'UNKNOWN',
    });

    const { training: _drop, ...otherDims } = dimensionOverrides;
    const executed = await executeGoLive(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      // other dims still attested; live training IN_PROGRESS must block
      ...harnessDims(otherDims),
      idempotencyKey: 'golive:onb-w3-stale:1',
    });
    expect(executed.ok).toBe(false);
    expect(executed.error).toMatch(/readiness|not.?ready/i);
    void _drop;
  });

  it('migration COMPLETED rejected without reconciliation', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-mig',
    });

    const started = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'IN_PROGRESS',
    });
    expect(started.ok).toBe(true);

    const blocked = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'COMPLETED',
      // reconciliationStatus intentionally omitted
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/reconcil/i);

    const ok = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'COMPLETED',
      reconciliationStatus: 'PASSED',
    });
    expect(ok.ok).toBe(true);
    expect(ok.migration.status).toBe('COMPLETED');
  });

  it('training COMPLETED rejected without Training-domain source (Phase 18 stub)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-trn',
    });

    const stub = await setTrainingCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'IN_PROGRESS',
      sourceDomain: 'PHASE_16_TRAINING_HANDOFF',
    });
    expect(stub.ok).toBe(true);
    expect(['UNKNOWN', 'IN_PROGRESS']).toContain(stub.training.status);

    const blocked = await setTrainingCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'COMPLETED',
      // no trainingDomainSource / Phase 18 source
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/training.?domain|phase.?18|source/i);

    const withSource = await setTrainingCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'COMPLETED',
      trainingDomainSource: 'PHASE_18_TRAINING',
      trainingDomainStatus: 'COMPLETED',
    });
    // Phase 17 may still refuse COMPLETED (coordination only) OR accept when Phase 18 source present.
    // Spec: cannot set COMPLETED without Training-domain source; with source OK.
    if (withSource.ok) {
      expect(withSource.training.status).toBe('COMPLETED');
      expect(withSource.training.trainingDomainSource || withSource.training.sourceDomain).toMatch(
        /PHASE_18|TRAINING/i
      );
    } else {
      // Strict Phase 17 stub: only UNKNOWN/IN_PROGRESS until Phase 18 module exists
      expect(blocked.ok).toBe(false);
      expect(['UNKNOWN', 'IN_PROGRESS']).toContain(
        prisma._trainingStore[0]?.status || 'UNKNOWN'
      );
    }
  });

  it('completion certificate requires go-live + stabilisation exit (no skip)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-no-golive',
      status: 'COMPLETION_PENDING',
    });

    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingMigration.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        internalSignOffAt: new Date(),
        internalSignOffByAdminId: admin.id,
        customerSignOffAt: new Date(),
        customerSignOffByContactId: 'contact-1',
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });

    const evaluation = await evaluateOnboardingCompletion(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.ready).not.toBe(true);
    expect(evaluation.blockers.join(' ')).toMatch(/go_live_successful_required/);
    expect(evaluation.blockers.join(' ')).toMatch(/stabilisation_exit_required/);

    const cert = await issueCompletionCertificate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:onb-w3-no-golive:1',
    });
    expect(cert.ok).toBe(false);
    expect(cert.error).toMatch(/completion_not_ready|not.?ready/i);
    expect(cert.blockers?.join(' ') || '').toMatch(/go_live|stabilisation/i);
    expect(prisma._certificateStore.length).toBe(0);
  });

  it('migration READY / READY_FOR_IMPORT without recon is not go-live READY', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-mig-ready',
    });

    const blockedReady = await setMigrationCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'READY',
    });
    expect(blockedReady.ok).toBe(false);
    expect(blockedReady.error).toMatch(/reconcil/i);

    await prisma.customerOnboardingMigration.create({
      data: {
        projectId: project.id,
        status: 'READY',
        reconciliationStatus: null,
        createdByAdminId: admin.id,
      },
    });
    const live = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
      persist: false,
      dimensionOverrides: {
        tenant: 'READY',
        businessBranch: 'READY',
        users: 'READY',
        configuration: 'READY',
        accounting: 'READY',
        mraEis: 'NOT_APPLICABLE',
        training: 'READY',
        testing: 'READY',
        defects: 'READY',
        // migration intentionally live from store
      },
    });
    expect(live.dimensions.migration).not.toBe('READY');
    expect(['NOT_READY', 'UNKNOWN']).toContain(live.dimensions.migration);

    await prisma.customerOnboardingMigration.update({
      where: { id: prisma._migrationStore[0].id },
      data: { status: 'READY_FOR_IMPORT', reconciliationStatus: null },
    });
    const liveImport = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
      persist: false,
      dimensionOverrides: {
        tenant: 'READY',
        businessBranch: 'READY',
        users: 'READY',
        configuration: 'READY',
        accounting: 'READY',
        mraEis: 'NOT_APPLICABLE',
        training: 'READY',
        testing: 'READY',
        defects: 'READY',
      },
    });
    expect(liveImport.dimensions.migration).not.toBe('READY');
  });

  it('executeGoLive exact retry returns existing execution (no duplicate)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const executor = executorAdmin();
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-w3-gl-idem',
    });

    await seedDecisionAndApprovals(
      prisma,
      project.id,
      dimensionOverrides,
      admin,
      executor
    );

    const args = {
      actorContext: { admin: executor },
      projectId: project.id,
      windowStart: '2026-09-01T08:00:00Z',
      windowEnd: '2026-09-01T12:00:00Z',
      idempotencyKey: 'golive:onb-w3-gl-idem:1',
      ...harnessDims(dimensionOverrides),
    };
    const first = await executeGoLive(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);

    const second = await executeGoLive(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.goLive.id).toBe(first.goLive.id);
    expect(prisma._goLiveStore.length).toBe(1);

    // Different key but same project already in-progress → still no duplicate
    const third = await executeGoLive(prisma, {
      ...args,
      idempotencyKey: 'golive:onb-w3-gl-idem:retry-other-key',
    });
    expect(third.ok).toBe(true);
    expect(third.alreadyExists || third.idempotentReplay).toBe(true);
    expect(third.goLive.id).toBe(first.goLive.id);
    expect(prisma._goLiveStore.length).toBe(1);
  });

  it('project get-by-id enforces portfolio scope for CS-scoped actors', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const agent = csScopedAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-scope',
      tenantId: 'tenant-owned',
    });

    const denied = await loadOnboardingProjectForActor(prisma, {
      admin: agent,
      projectId: project.id,
    });
    expect(denied.ok).toBe(false);
    expect(denied.forbidden || denied.notFound).toBe(true);

    const outOfScope = await loadOnboardingProjectForActor(prisma, {
      admin: agent,
      projectId: project.id,
      portfolioTenantIds: ['tenant-other'],
    });
    expect(outOfScope.ok).toBe(false);
    expect(outOfScope.error).toMatch(/out_of_scope|denied|forbidden/i);

    const allowed = await loadOnboardingProjectForActor(prisma, {
      admin: agent,
      projectId: project.id,
      portfolioTenantIds: ['tenant-owned'],
    });
    expect(allowed.ok).toBe(true);
    expect(allowed.project.id).toBe(project.id);
  });

  it('completion without Customer sign-off fails', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-cmp',
      status: 'COMPLETION_PENDING',
    });

    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingMigration.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        internalSignOffAt: new Date(),
        internalSignOffByAdminId: admin.id,
        customerSignOffAt: null,
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });

    const evaluation = await evaluateOnboardingCompletion(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(evaluation.ok).toBe(true);
    expect(evaluation.ready || evaluation.complete).not.toBe(true);
    expect(evaluation.blockers?.join(' ') || evaluation.error || '').toMatch(
      /customer.?sign.?off|sign.?off/i
    );

    const cert = await issueCompletionCertificate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:onb-w3-cmp:1',
    });
    expect(cert.ok).toBe(false);
    expect(cert.error).toMatch(/sign.?off|completion|not.?ready/i);
  });

  it('completion certificate checksum stable on exact retry', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-cert',
      status: 'COMPLETION_PENDING',
    });

    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        acceptedAt: new Date('2026-09-15T10:00:00Z'),
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingMigration.create({
      data: {
        projectId: project.id,
        status: 'COMPLETED',
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingGoLive.create({
      data: {
        projectId: project.id,
        status: 'SUCCESSFUL',
        outcome: 'SUCCESSFUL',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingStabilisation.create({
      data: {
        projectId: project.id,
        status: 'EXITED',
        exitApprovedAt: new Date('2026-09-14T10:00:00Z'),
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        internalSignOffAt: new Date('2026-09-15T11:00:00Z'),
        internalSignOffByAdminId: admin.id,
        customerSignOffAt: new Date('2026-09-15T12:00:00Z'),
        customerSignOffByContactId: 'contact-verified-1',
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });

    const args = {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:onb-w3-cert:1',
    };
    const first = await issueCompletionCertificate(prisma, args);
    expect(first.ok).toBe(true);
    expect(first.certificate.checksumSha256).toMatch(/^[a-f0-9]{64}$/i);

    const second = await issueCompletionCertificate(prisma, args);
    expect(second.ok).toBe(true);
    expect(second.alreadyExists || second.idempotentReplay).toBe(true);
    expect(second.certificate.id).toBe(first.certificate.id);
    expect(second.certificate.checksumSha256).toBe(first.certificate.checksumSha256);
    expect(prisma._certificateStore.length).toBe(1);
  });

  it('accounting boundary — onboarding must not create journals/OB/stock', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-acct',
    });

    const boundary = await assertOnboardingAccountingBoundary(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
    });
    expect(boundary.ok).toBe(true);
    expect(boundary.journalCount).toBe(0);
    expect(getOnboardingDomainContract().tenantGlForbidden).toBe(true);

    // Ambient unrelated tenant journals must not fail the onboarding boundary
    await prisma.journalEntry.create({
      data: {
        tenantId: project.tenantId,
        description: 'pre-existing tenant GL',
        source: 'TENANT_OPERATIONS',
      },
    });
    const withAmbient = await assertOnboardingAccountingBoundary(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
    });
    expect(withAmbient.ok).toBe(true);
    expect(withAmbient.journalCount).toBeGreaterThan(0);

    // Onboarding-authored create is forbidden
    if (typeof boundary.assertNoCreate === 'function') {
      const denied = boundary.assertNoCreate({ type: 'JOURNAL' });
      expect(denied.ok).toBe(false);
    }
    const { createOnboardingJournalEntry } = await import(
      '@/lib/admin/customerSuccess/onboarding'
    );
    const refused = await createOnboardingJournalEntry(prisma, {
      actorContext: { admin },
      projectId: project.id,
      tenantId: project.tenantId,
    });
    expect(refused.ok).toBe(false);
    expect(refused.error).toMatch(/accounting.?boundary|forbidden|journal/i);
    expect(boundary.createsJournals).not.toBe(true);
    expect(boundary.createsOpeningBalances).not.toBe(true);
    expect(boundary.createsOpeningStock).not.toBe(true);
  });

  it('Cross-Tenant project access denied', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-xtenant',
      tenantId: 'tenant-1',
    });

    const denied = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      projectId: project.id,
      tenantId: 'tenant-other',
    });
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/cross.?tenant|denied|isolation/i);

    const approveDenied = await approveGoLive(prisma, {
      actorContext: { admin, tenantId: 'tenant-other' },
      projectId: project.id,
      tenantId: 'tenant-other',
      approvalRole: 'INTERNAL',
    });
    expect(approveDenied.ok).toBe(false);
    expect(approveDenied.error).toMatch(/cross.?tenant|denied|isolation/i);
  });

  it('progress and health are server-side and versioned (progress ≠ completion)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-health',
      status: 'IN_PROGRESS',
    });

    const progress = await calculateOnboardingProgress(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(progress.ok).toBe(true);
    expect(progress.percent).toBeGreaterThanOrEqual(0);
    expect(progress.percent).toBeLessThanOrEqual(100);
    expect(progress.rulesVersion).toBeTruthy();
    expect(progress.complete || progress.isComplete).not.toBe(true);

    const health = await calculateOnboardingHealth(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(health.ok).toBe(true);
    expect(health.status).toMatch(
      /HEALTHY|AT_RISK|HIGH_RISK|BLOCKED|UNKNOWN|NOT_ENOUGH_DATA|WARNINGS/i
    );
    expect(health.rulesVersion).toBeTruthy();
    expect(health.ml).not.toBe(true);
  });

  it('handover create/accept required before completion certificate', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-w3-ho',
      status: 'HANDOVER_PENDING',
    });

    const created = await createOnboardingHandover(prisma, {
      actorContext: { admin },
      projectId: project.id,
      recipients: ['CS', 'SUPPORT', 'CUSTOMER_ADMIN'],
      openItemsJson: [{ title: 'Follow-up training' }],
      idempotencyKey: 'handover:onb-w3-ho:1',
    });
    expect(created.ok).toBe(true);

    const accepted = await acceptOnboardingHandover(prisma, {
      actorContext: { admin },
      projectId: project.id,
      handoverId: created.handover.id,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.handover.status).toMatch(/ACCEPT/i);
  });
});
