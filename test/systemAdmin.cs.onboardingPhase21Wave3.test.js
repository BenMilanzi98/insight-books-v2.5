/**
 * Phase 21 Wave 3 — Go-live / stabilisation / completion / CS handover / Phase 22 Training handoff.
 * G21-15…G21-22: UNKNOWN≠READY; Critical/High block; decision SoD; execution≠schedule;
 * rollback preserves evidence; completion evidence chain; COMPLETED_WITH_GAPS;
 * certificate checksum idempotent; CS handover ≠ Customer Health overwrite;
 * Phase 22 Training handoff checksum/idempotent — never Programs/Sessions/attendance/certs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  evaluateOnboardingReadiness,
  approveGoLive,
  recordGoLiveDecision,
  scheduleGoLive,
  executeGoLive,
  recordGoLiveOutcome,
  recordCutoverCoordination,
  assertCutoverDistinctFromGoLiveSuccess,
  recordStabilisationCheck,
  approveStabilisationExit,
  createOnboardingHandover,
  acceptOnboardingHandover,
  computeOnboardingHandoverChecksum,
  assertHandoverDoesNotOverwriteCustomerHealth,
  evaluateOnboardingCompletion,
  issueCompletionCertificate,
  computeOnboardingCompletionChecksum,
  setTrainingCoordinationStatus,
  emitPhase22TrainingHandoff,
  computePhase22TrainingHandoffChecksum,
  refusePhase22TrainingDelivery,
  listOpenBlockingDefects,
  ONBOARDING_PROJECT_STATUS,
  GO_LIVE_DECISION,
  PHASE22_TRAINING_HANDOFF_STATUS,
} from '@/lib/admin/customerSuccess/onboarding';

function superAdmin(id = 'super-p21-w3') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
}

function otherAdmin(id = 'approver-p21-w3') {
  return {
    id,
    role: 'Super Admin',
    permissions: {
      'systemAdmin.customerSuccess.read': true,
      'systemAdmin.customerSuccess.manageCases': true,
    },
  };
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
      return null;
    }),
    findFirst: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.idempotencyKey) {
        rows = rows.filter((r) => r.idempotencyKey === where.idempotencyKey);
      }
      if (where.status) {
        const st = where.status;
        if (typeof st === 'string') rows = rows.filter((r) => r.status === st);
        else if (st?.in) rows = rows.filter((r) => st.in.includes(r.status));
      }
      if (where.severity) {
        const sev = where.severity;
        if (typeof sev === 'string') rows = rows.filter((r) => r.severity === sev);
        else if (sev?.in) rows = rows.filter((r) => sev.in.includes(r.severity));
      }
      return rows[0] || null;
    }),
    findMany: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      if (where.severity) {
        const sev = where.severity;
        if (typeof sev === 'string') rows = rows.filter((r) => r.severity === sev);
        else if (sev?.in) rows = rows.filter((r) => sev.in.includes(r.severity));
      }
      if (where.status) {
        const st = where.status;
        if (typeof st === 'string') rows = rows.filter((r) => r.status === st);
        else if (st?.in) rows = rows.filter((r) => st.in.includes(r.status));
        else if (st?.notIn) rows = rows.filter((r) => !st.notIn.includes(r.status));
      }
      return rows;
    }),
    update: vi.fn(async ({ where = {}, data = {} } = {}) => {
      const row = store.find((r) => r.id === where.id);
      if (!row) throw new Error('not found');
      Object.assign(row, data, { updatedAt: data.updatedAt || new Date() });
      return row;
    }),
    delete: vi.fn(async ({ where = {} } = {}) => {
      const idx = store.findIndex((r) => r.id === where.id);
      if (idx < 0) throw new Error('not found');
      const [removed] = store.splice(idx, 1);
      return removed;
    }),
    count: vi.fn(async ({ where = {} } = {}) => {
      let rows = [...store];
      if (where.projectId) rows = rows.filter((r) => r.projectId === where.projectId);
      return rows.length;
    }),
  };
}

function makePrisma(overrides = {}) {
  const projectStore = overrides._projectStore || [];
  const projectHistoryStore = overrides._projectHistoryStore || [];
  const readinessStore = overrides._readinessStore || [];
  const migrationStore = overrides._migrationStore || [];
  const trainingStore = overrides._trainingStore || [];
  const defectStore = overrides._defectStore || [];
  const testPlanStore = overrides._testPlanStore || [];
  const goLiveStore = overrides._goLiveStore || [];
  const goLiveApprovalStore = overrides._goLiveApprovalStore || [];
  const goLiveDecisionStore = overrides._goLiveDecisionStore || [];
  const cutoverStore = overrides._cutoverStore || [];
  const stabilisationStore = overrides._stabilisationStore || [];
  const handoverStore = overrides._handoverStore || [];
  const completionStore = overrides._completionStore || [];
  const certificateStore = overrides._certificateStore || [];
  const phase22HandoffStore = overrides._phase22HandoffStore || [];
  const healthSnapshotStore = overrides._healthSnapshotStore || [];
  const programStore = overrides._programStore || [];
  const sessionStore = overrides._sessionStore || [];

  const prisma = {
    $transaction: vi.fn(async (fn) => fn(prisma)),
    _projectStore: projectStore,
    _goLiveStore: goLiveStore,
    _goLiveDecisionStore: goLiveDecisionStore,
    _cutoverStore: cutoverStore,
    _handoverStore: handoverStore,
    _certificateStore: certificateStore,
    _phase22HandoffStore: phase22HandoffStore,
    _healthSnapshotStore: healthSnapshotStore,
    _programStore: programStore,
    _sessionStore: sessionStore,
    _defectStore: defectStore,
    customerOnboardingProject: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: data.id || `onb-${projectStore.length + 1}`,
          status: data.status || 'IN_PROGRESS',
          onboardingNumber: data.number || data.onboardingNumber || null,
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
    customerOnboardingTraining: makeStoreCrud(trainingStore, 'trn'),
    customerOnboardingDefect: makeStoreCrud(defectStore, 'def'),
    customerOnboardingTestPlan: makeStoreCrud(testPlanStore, 'tp'),
    customerOnboardingGoLive: makeStoreCrud(goLiveStore, 'gl'),
    customerOnboardingGoLiveApproval: makeStoreCrud(goLiveApprovalStore, 'gla'),
    customerOnboardingGoLiveDecision: makeStoreCrud(goLiveDecisionStore, 'gld'),
    customerOnboardingCutover: makeStoreCrud(cutoverStore, 'cut'),
    customerOnboardingStabilisation: makeStoreCrud(stabilisationStore, 'stb'),
    customerOnboardingHandover: makeStoreCrud(handoverStore, 'ho'),
    customerOnboardingCompletion: makeStoreCrud(completionStore, 'cmp'),
    customerOnboardingCompletionCertificate: makeStoreCrud(certificateStore, 'cert'),
    customerOnboardingPhase22TrainingHandoff: makeStoreCrud(
      phase22HandoffStore,
      'p22'
    ),
    customerHealthSnapshot: {
      findUnique: vi.fn(async ({ where = {} } = {}) => {
        if (where.id) {
          return healthSnapshotStore.find((r) => r.id === where.id) || null;
        }
        if (where.customerId) {
          return (
            healthSnapshotStore.find((r) => r.customerId === where.customerId) ||
            null
          );
        }
        return null;
      }),
      update: vi.fn(async ({ where = {}, data = {} } = {}) => {
        const row =
          healthSnapshotStore.find((r) => r.id === where.id) ||
          healthSnapshotStore.find((r) => r.customerId === where.customerId);
        if (!row) throw new Error('health not found');
        Object.assign(row, data);
        return row;
      }),
      create: vi.fn(async ({ data }) => {
        const row = { id: data.id || `chs-${healthSnapshotStore.length + 1}`, ...data };
        healthSnapshotStore.push(row);
        return row;
      }),
    },
    customerTrainingProgram: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `prog-${programStore.length + 1}`, ...data };
        programStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => programStore),
    },
    customerTrainingSession: {
      create: vi.fn(async ({ data }) => {
        const row = { id: `sess-${sessionStore.length + 1}`, ...data };
        sessionStore.push(row);
        return row;
      }),
      findMany: vi.fn(async () => sessionStore),
    },
    ...overrides,
  };
  return prisma;
}

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

async function seedProject(prisma, admin, opts = {}) {
  const row = await prisma.customerOnboardingProject.create({
    data: {
      id: opts.projectId || 'onb-p21-w3-1',
      number: opts.number || 'ONB-2026-000321',
      tenantId: opts.tenantId || 'tenant-p21-w3',
      customerId: opts.customerId || 'cust-p21-w3',
      subscriptionId: opts.subscriptionId || 'sub-p21-w3',
      status: opts.status || 'READY_FOR_GO_LIVE',
      onboardingRequestId: opts.onboardingRequestId || 'req-p21-w3',
      ownerAssignmentsJson: opts.ownerAssignmentsJson || {},
      createdByAdminId: admin.id,
    },
  });
  return { project: row };
}

async function seedGoLiveReady(prisma, admin, opts = {}) {
  const { project } = await seedProject(prisma, admin, {
    ...opts,
    status: opts.status || 'READY_FOR_GO_LIVE',
  });
  await prisma.customerOnboardingMigration.create({
    data: {
      projectId: project.id,
      status: 'COMPLETED',
      reconciliationStatus: 'PASSED',
      createdByAdminId: admin.id,
    },
  });
  await prisma.customerOnboardingTraining.create({
    data: {
      projectId: project.id,
      status: 'COMPLETED',
      sourceDomain: 'PHASE_16_TRAINING_HANDOFF',
      trainingDomainSource: 'PHASE_22_TRAINING',
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
  return { project, dimensionOverrides: { ...GO_LIVE_READY_OVERRIDES } };
}

/** Harness-only readiness overrides — production go-live APIs ignore without this flag. */
function harnessDims(dimensionOverrides) {
  return { dimensionOverrides, allowDimensionOverrides: true };
}

async function seedApprovals(prisma, projectId, dimensionOverrides, admins) {
  const [internalAdmin, customerAdmin] = admins;
  const a = await approveGoLive(prisma, {
    actorContext: { admin: internalAdmin },
    projectId,
    approvalRole: 'INTERNAL',
    ...harnessDims(dimensionOverrides),
  });
  const b = await approveGoLive(prisma, {
    actorContext: { admin: customerAdmin },
    projectId,
    approvalRole: 'CUSTOMER',
    ...harnessDims(dimensionOverrides),
  });
  return { a, b };
}

describe('Phase 21 Wave 3 — Go-live / completion / CS handover / Phase 22 Training', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('G21-15: UNKNOWN readiness ≠ READY and blocks go-live decision/approve', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-unknown',
      status: 'GO_LIVE_READINESS',
    });

    const readiness = await evaluateOnboardingReadiness(prisma, {
      actorContext: { admin },
      projectId: project.id,
      persist: false,
    });
    expect(readiness.ok).toBe(true);
    expect(readiness.overallStatus).toBe('UNKNOWN');
    expect(readiness.overallStatus).not.toBe('READY');

    const decision = await recordGoLiveDecision(prisma, {
      actorContext: { admin },
      projectId: project.id,
      decision: GO_LIVE_DECISION.GO,
      idempotencyKey: 'gld:unknown:1',
    });
    expect(decision.ok).toBe(false);
    expect(decision.error).toMatch(/UNKNOWN|readiness|not.?ready/i);

    const approved = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
    });
    expect(approved.ok).toBe(false);
    expect(approved.error).toMatch(/UNKNOWN|readiness|not.?ready/i);

    // Public fabricate-READY seam closed without harness flag
    const forged = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
      dimensionOverrides: { ...GO_LIVE_READY_OVERRIDES },
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/UNKNOWN|readiness|not.?ready/i);
  });

  it('G21-15: Critical and High open defects block go-live', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-p21-w3-defects',
    });

    await prisma.customerOnboardingDefect.create({
      data: {
        projectId: project.id,
        title: 'High severity blocker',
        severity: 'HIGH',
        status: 'OPEN',
        createdByAdminId: admin.id,
      },
    });

    const blocking = await listOpenBlockingDefects(prisma, project.id);
    expect(blocking.some((d) => d.severity === 'HIGH')).toBe(true);

    // Keep dimensionOverrides.defects READY so the explicit defect gate (not readiness dims) is exercised.
    const approved = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
      ...harnessDims(dimensionOverrides),
    });
    expect(approved.ok).toBe(false);
    expect(approved.error).toMatch(/high|critical|defect/i);

    await prisma.customerOnboardingDefect.create({
      data: {
        projectId: project.id,
        title: 'Critical blocker',
        severity: 'CRITICAL',
        status: 'OPEN',
        createdByAdminId: admin.id,
      },
    });
    const criticalBlock = await approveGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      approvalRole: 'INTERNAL',
      ...harnessDims(dimensionOverrides),
    });
    expect(criticalBlock.ok).toBe(false);
    expect(criticalBlock.error).toMatch(/critical|defect|high/i);
  });

  it('G21-16: decision SoD — executor cannot be sole decision recorder', async () => {
    const prisma = makePrisma();
    const decider = superAdmin('decider-p21');
    const executor = otherAdmin('executor-p21');
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, {
      id: 'seed-admin',
      role: 'Super Admin',
      permissions: {
        'systemAdmin.customerSuccess.read': true,
        'systemAdmin.customerSuccess.manageCases': true,
      },
    }, { projectId: 'onb-p21-w3-sod' });

    const decision = await recordGoLiveDecision(prisma, {
      actorContext: { admin: decider },
      projectId: project.id,
      decision: GO_LIVE_DECISION.GO,
      idempotencyKey: 'gld:sod:1',
      ...harnessDims(dimensionOverrides),
    });
    expect(decision.ok).toBe(true);
    expect(decision.decision.decision).toBe(GO_LIVE_DECISION.GO);

    await seedApprovals(prisma, project.id, dimensionOverrides, [decider, executor]);

    const sameActor = await executeGoLive(prisma, {
      actorContext: { admin: decider },
      projectId: project.id,
      idempotencyKey: 'gl:sod:same',
      ...harnessDims(dimensionOverrides),
    });
    expect(sameActor.ok).toBe(false);
    expect(sameActor.error).toMatch(/sod|separation|decision|executor/i);

    const okExec = await executeGoLive(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      idempotencyKey: 'gl:sod:ok',
      ...harnessDims(dimensionOverrides),
    });
    expect(okExec.ok).toBe(true);
  });

  it('G21-16: omitting decision blocks schedule/execute (no SoD bypass)', async () => {
    const prisma = makePrisma();
    const admin = superAdmin('no-decision');
    const executor = otherAdmin('exec-no-decision');
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-p21-w3-nodec',
    });
    await seedApprovals(prisma, project.id, dimensionOverrides, [admin, executor]);

    const scheduled = await scheduleGoLive(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'gl-sched:nodec',
      ...harnessDims(dimensionOverrides),
    });
    expect(scheduled.ok).toBe(false);
    expect(scheduled.error).toMatch(/decision.?required/i);

    const executed = await executeGoLive(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      idempotencyKey: 'gl-exec:nodec',
      ...harnessDims(dimensionOverrides),
    });
    expect(executed.ok).toBe(false);
    expect(executed.error).toMatch(/decision.?required/i);
  });

  it('G21-16: schedule alone ≠ SUCCESSFUL outcome; null goLive cannot SUCCESSFUL', async () => {
    const prisma = makePrisma();
    const decider = superAdmin('decider-sched');
    const executor = otherAdmin('executor-sched');
    const { project, dimensionOverrides } = await seedGoLiveReady(prisma, decider, {
      projectId: 'onb-p21-w3-sched',
    });

    await recordGoLiveDecision(prisma, {
      actorContext: { admin: decider },
      projectId: project.id,
      decision: GO_LIVE_DECISION.GO,
      idempotencyKey: 'gld:sched:1',
      ...harnessDims(dimensionOverrides),
    });
    await seedApprovals(prisma, project.id, dimensionOverrides, [decider, executor]);

    const scheduled = await scheduleGoLive(prisma, {
      actorContext: { admin: decider },
      projectId: project.id,
      windowStart: '2026-09-01T08:00:00Z',
      windowEnd: '2026-09-01T12:00:00Z',
      idempotencyKey: 'gl-sched:1',
      ...harnessDims(dimensionOverrides),
    });
    expect(scheduled.ok).toBe(true);
    expect(scheduled.goLive.status).toMatch(/SCHEDULED/i);
    expect(String(scheduled.goLive.outcome || '')).not.toMatch(/SUCCESSFUL/i);
    expect(prisma._projectStore.find((p) => p.id === project.id).status).toBe(
      ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED
    );

    // Critical: schedule alone ≠ SUCCESSFUL outcome
    const premature = await recordGoLiveOutcome(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      outcome: 'SUCCESSFUL',
      customerAcknowledged: true,
      ...harnessDims(dimensionOverrides),
    });
    expect(premature.ok).toBe(false);
    expect(premature.error).toMatch(/not_in_progress|schedule|execute/i);
    expect(prisma._projectStore.find((p) => p.id === project.id).status).toBe(
      ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED
    );

    // Important #5: null goLive evidence cannot advance to STABILISATION
    const bare = await seedProject(prisma, decider, {
      projectId: 'onb-p21-w3-null-gl',
      status: 'GO_LIVE_IN_PROGRESS',
    });
    const noEvidence = await recordGoLiveOutcome(prisma, {
      actorContext: { admin: executor },
      projectId: bare.project.id,
      outcome: 'SUCCESSFUL',
      ...harnessDims(dimensionOverrides),
    });
    expect(noEvidence.ok).toBe(false);
    expect(noEvidence.error).toMatch(/evidence|required/i);
    expect(noEvidence.goLive).toBeNull();
    expect(prisma._projectStore.find((p) => p.id === bare.project.id).status).toBe(
      'GO_LIVE_IN_PROGRESS'
    );

    // Schedule alone must not be treated as successful go-live for completion
    const completionAfterSchedule = await evaluateOnboardingCompletion(prisma, {
      actorContext: { admin: decider },
      projectId: project.id,
    });
    expect(completionAfterSchedule.ready).toBe(false);
    expect(completionAfterSchedule.blockers).toEqual(
      expect.arrayContaining(['go_live_successful_required'])
    );

    const executed = await executeGoLive(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      idempotencyKey: 'gl-exec:1',
      ...harnessDims(dimensionOverrides),
    });
    expect(executed.ok).toBe(true);
    expect(executed.goLive.status).toMatch(/IN_PROGRESS/i);

    const rolled = await recordGoLiveOutcome(prisma, {
      actorContext: { admin: executor },
      projectId: project.id,
      outcome: 'ROLLED_BACK',
      rollbackDecision: 'ROLLBACK_PRESERVE_EVIDENCE',
      ...harnessDims(dimensionOverrides),
    });
    expect(rolled.ok).toBe(true);
    expect(rolled.goLive.outcome || rolled.goLive.status).toMatch(/ROLLED_BACK/i);
    expect(prisma.customerOnboardingGoLive.delete).not.toHaveBeenCalled();
    expect(prisma._goLiveStore.length).toBeGreaterThanOrEqual(1);
    expect(prisma._goLiveStore[0].rollbackDecision).toBeTruthy();
  });

  it('G21-17: cutover coordination distinct from go-live success', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedGoLiveReady(prisma, admin, {
      projectId: 'onb-p21-w3-cut',
    });

    const cutover = await recordCutoverCoordination(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'READY',
      checklistJson: { dns: true, backup: true },
      idempotencyKey: 'cut:1',
    });
    expect(cutover.ok).toBe(true);
    expect(cutover.cutover.status).toBe('READY');

    const distinct = assertCutoverDistinctFromGoLiveSuccess({
      cutoverStatus: 'READY',
      goLiveOutcome: null,
    });
    expect(distinct.ok).toBe(true);
    expect(distinct.goLiveSuccessful).toBe(false);

    const forged = assertCutoverDistinctFromGoLiveSuccess({
      cutoverStatus: 'COMPLETED',
      goLiveOutcome: null,
      treatCutoverAsGoLiveSuccess: true,
    });
    expect(forged.ok).toBe(false);
    expect(forged.error).toMatch(/cutover|go.?live|distinct/i);
  });

  it('G21-18: completion requires go-live + stabilisation + acceptances + CS handover + recon', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-comp',
      status: 'COMPLETION_PENDING',
    });

    // Successful go-live alone is insufficient
    await prisma.customerOnboardingGoLive.create({
      data: {
        projectId: project.id,
        status: 'SUCCESSFUL',
        outcome: 'SUCCESSFUL',
        createdByAdminId: admin.id,
      },
    });
    const onlyGoLive = await evaluateOnboardingCompletion(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(onlyGoLive.ready).toBe(false);
    expect(onlyGoLive.blockers).toEqual(
      expect.arrayContaining([
        'stabilisation_exit_required',
        'customer_sign_off_required',
        'internal_sign_off_required',
        'handover_acceptance_required',
        'reconciliation_required',
      ])
    );

    await prisma.customerOnboardingStabilisation.create({
      data: { projectId: project.id, status: 'EXITED', createdByAdminId: admin.id },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        customerSignOffAt: new Date('2026-09-02T10:00:00Z'),
        internalSignOffAt: new Date('2026-09-02T11:00:00Z'),
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        acceptedAt: new Date('2026-09-02T12:00:00Z'),
        createdByAdminId: admin.id,
      },
    });

    const ready = await evaluateOnboardingCompletion(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(ready.ready).toBe(true);
    expect(ready.blockers).toEqual([]);
  });

  it('G21-19: certificate checksum idempotent; COMPLETED_WITH_GAPS explicit', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-cert',
      status: 'COMPLETION_PENDING',
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
      data: { projectId: project.id, status: 'EXITED', createdByAdminId: admin.id },
    });
    await prisma.customerOnboardingCompletion.create({
      data: {
        projectId: project.id,
        customerSignOffAt: new Date('2026-09-02T10:00:00Z'),
        internalSignOffAt: new Date('2026-09-02T11:00:00Z'),
        reconciliationStatus: 'PASSED',
        createdByAdminId: admin.id,
      },
    });
    await prisma.customerOnboardingHandover.create({
      data: {
        projectId: project.id,
        status: 'ACCEPTED',
        openItemsJson: [{ id: 'gap-1', title: 'Deferred training cohort' }],
        acceptedAt: new Date('2026-09-02T12:00:00Z'),
        createdByAdminId: admin.id,
      },
    });

    const first = await issueCompletionCertificate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:p21-w3:1',
      allowCompletedWithGaps: true,
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(first.certificate.checksumSha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(first.completionStatus || first.certificate.status).toMatch(
      /COMPLETED_WITH_GAPS/i
    );
    expect(first.completedWithGaps).toBe(true);

    const second = await issueCompletionCertificate(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'cert:p21-w3:1',
      allowCompletedWithGaps: true,
    });
    expect(second.ok).toBe(true);
    expect(second.idempotentReplay || second.alreadyExists).toBe(true);
    expect(second.certificate.checksumSha256).toBe(first.certificate.checksumSha256);
    expect(prisma._certificateStore.length).toBe(1);

    const canonical = {
      projectId: project.id,
      onboardingNumber: project.number || project.onboardingNumber || null,
      tenantId: project.tenantId,
      customerId: project.customerId,
      customerSignOffAt: '2026-09-02T10:00:00.000Z',
      internalSignOffAt: '2026-09-02T11:00:00.000Z',
      handoverId: prisma._handoverStore[0].id,
      reconciliationStatus: 'PASSED',
      goLiveOutcome: 'SUCCESSFUL',
    };
    expect(computeOnboardingCompletionChecksum(canonical)).toBe(
      first.certificate.checksumSha256
    );
  });

  it('G21-20: CS handover checksum/idempotent; does not overwrite Customer Health', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-ho',
      status: 'HANDOVER_PENDING',
    });
    prisma._healthSnapshotStore.push({
      id: 'chs-1',
      customerId: project.customerId,
      score: 88,
      status: 'HEALTHY',
    });

    const payload = {
      projectId: project.id,
      customerId: project.customerId,
      tenantId: project.tenantId,
      openGaps: [{ id: 'g1' }],
      successCriteria: ['live', 'stabilised'],
    };
    const checksum = computeOnboardingHandoverChecksum(payload);
    expect(checksum).toMatch(/^[a-f0-9]{64}$/i);

    const first = await createOnboardingHandover(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'ho:p21-w3:1',
      recipients: ['csm@example.com'],
      openItemsJson: payload.openGaps,
      packagePayload: payload,
    });
    expect(first.ok).toBe(true);
    expect(first.handover.checksumSha256 || first.checksumSha256).toBe(checksum);

    const replay = await createOnboardingHandover(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'ho:p21-w3:1',
      packagePayload: payload,
    });
    expect(replay.idempotentReplay || replay.alreadyExists).toBe(true);
    expect(prisma._handoverStore.length).toBe(1);

    const guard = assertHandoverDoesNotOverwriteCustomerHealth({
      mutateCustomerHealth: true,
    });
    expect(guard.ok).toBe(false);

    await acceptOnboardingHandover(prisma, {
      actorContext: { admin },
      projectId: project.id,
      handoverId: first.handover.id,
    });
    expect(prisma.customerHealthSnapshot.update).not.toHaveBeenCalled();
    expect(prisma.customerHealthSnapshot.create).not.toHaveBeenCalled();
    expect(prisma._healthSnapshotStore[0].score).toBe(88);
  });

  it('G21-21/22: Phase 22 Training handoff checksum/idempotent; never Programs/Sessions; COMPLETED needs Training source', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-trn',
      status: 'STABILISATION',
    });

    const blockedCompleted = await setTrainingCoordinationStatus(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'COMPLETED',
    });
    expect(blockedCompleted.ok).toBe(false);
    expect(blockedCompleted.error).toMatch(/training.?domain|source/i);

    const delivery = refusePhase22TrainingDelivery({
      createProgram: true,
      createSession: true,
    });
    expect(delivery.ok).toBe(false);
    expect(delivery.error).toMatch(/program|session|phase.?22|forbidden/i);

    const first = await emitPhase22TrainingHandoff(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'p22-th:1',
      participants: [{ contactId: 'c1', role: 'ADMIN' }],
      language: 'en',
      deliveryPreference: 'VIRTUAL',
      goLiveDependency: true,
      commercialInclusion: true,
      risks: ['schedule_slip'],
    });
    expect(first.ok).toBe(true);
    expect(first.created).toBe(true);
    expect(first.handoff.status).toMatch(
      new RegExp(
        `${PHASE22_TRAINING_HANDOFF_STATUS.READY}|${PHASE22_TRAINING_HANDOFF_STATUS.SENT}|DRAFT`,
        'i'
      )
    );
    expect(first.handoff.checksumSha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(first.handoff.payloadJson?.type || first.payload?.type).toMatch(
      /PHASE_22|TRAINING_HANDOFF/i
    );
    expect(first.meta?.createsPrograms).toBe(false);
    expect(first.meta?.createsSessions).toBe(false);
    expect(first.meta?.createsAttendance).toBe(false);
    expect(first.meta?.createsCertificates).toBe(false);

    const replay = await emitPhase22TrainingHandoff(prisma, {
      actorContext: { admin },
      projectId: project.id,
      idempotencyKey: 'p22-th:1',
      participants: [{ contactId: 'c1', role: 'ADMIN' }],
    });
    expect(replay.idempotentReplay || replay.alreadyExists).toBe(true);
    expect(replay.handoff.checksumSha256).toBe(first.handoff.checksumSha256);
    expect(prisma._phase22HandoffStore.length).toBe(1);

    expect(prisma.customerTrainingProgram.create).not.toHaveBeenCalled();
    expect(prisma.customerTrainingSession.create).not.toHaveBeenCalled();
    expect(prisma._programStore.length).toBe(0);
    expect(prisma._sessionStore.length).toBe(0);

    const checksum = computePhase22TrainingHandoffChecksum(
      first.handoff.payloadJson || first.payload
    );
    expect(checksum).toBe(first.handoff.checksumSha256);
  });

  it('stabilisation exit requires prior checks; does not invent EXITED; ≠ Phase 35 hypercare', async () => {
    const prisma = makePrisma();
    const admin = superAdmin();
    const { project } = await seedProject(prisma, admin, {
      projectId: 'onb-p21-w3-stab',
      status: 'STABILISATION',
    });

    const invented = await approveStabilisationExit(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(invented.ok).toBe(false);
    expect(invented.error).toMatch(/stabilisation_record_required|criteria/i);

    const check = await recordStabilisationCheck(prisma, {
      actorContext: { admin },
      projectId: project.id,
      status: 'IN_PROGRESS',
      checksJson: { daily: true, hypercarePhase35: false },
      exitCriteriaJson: { criticalDefects: 0 },
    });
    expect(check.ok).toBe(true);
    expect(check.stabilisation.hypercare).not.toBe(true);

    const exited = await approveStabilisationExit(prisma, {
      actorContext: { admin },
      projectId: project.id,
    });
    expect(exited.ok).toBe(true);
    expect(exited.stabilisation.status).toMatch(/EXITED/i);
    expect(prisma._projectStore.find((p) => p.id === project.id).status).toBe(
      ONBOARDING_PROJECT_STATUS.HANDOVER_PENDING
    );
  });
});
