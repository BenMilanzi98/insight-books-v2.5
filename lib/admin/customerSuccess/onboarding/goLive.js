/**
 * Go-live decision / schedule / execution / outcome — Phase 21 Wave 3.
 * UNKNOWN readiness blocks; Critical/High defects block; SoD on decision vs execute;
 * schedule ≠ execution; SUCCESSFUL → STABILISATION; rollback preserves evidence.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingGoLiveModel,
  hasCustomerOnboardingGoLiveApprovalModel,
  hasCustomerOnboardingGoLiveDecisionModel,
  serializeOnboardingGoLive,
  serializeOnboardingGoLiveApproval,
  serializeOnboardingGoLiveDecision,
} from './model.js';
import {
  getOnboardingDomainContract,
  ONBOARDING_PROJECT_STATUS,
  GO_LIVE_DECISION,
} from './catalogue.js';
import {
  evaluateOnboardingReadiness,
  isGoLiveReadinessAllowed,
} from './readiness/evaluate.js';
import { listOpenBlockingDefects } from './defects.js';
import { transitionOnboardingProjectStatus } from './status.js';

const EXECUTABLE_DECISIONS = new Set([
  GO_LIVE_DECISION.GO,
  GO_LIVE_DECISION.GO_WITH_CONDITIONS,
]);

async function ensureApprovals(prisma, projectId) {
  if (!hasCustomerOnboardingGoLiveApprovalModel(prisma)) {
    return { internal: false, customer: false };
  }
  const rows = await prisma.customerOnboardingGoLiveApproval.findMany({
    where: { projectId },
  });
  const roles = new Set(
    (rows || [])
      .filter((r) => String(r.status || '').toUpperCase() === 'APPROVED')
      .map((r) => String(r.approvalRole || '').toUpperCase())
  );
  return {
    internal: roles.has('INTERNAL'),
    customer: roles.has('CUSTOMER'),
  };
}

/**
 * dimensionOverrides are harness-only. Production go-live APIs ignore them
 * unless allowDimensionOverrides === true (tests / internal harness).
 */
function readinessArgsForGoLive(args, projectId) {
  const evalArgs = { ...args, projectId, persist: false };
  if (args.allowDimensionOverrides !== true) {
    delete evalArgs.dimensionOverrides;
  }
  return evalArgs;
}

async function requireCurrentReadiness(prisma, args, projectId) {
  const readiness = await evaluateOnboardingReadiness(
    prisma,
    readinessArgsForGoLive(args, projectId)
  );
  if (!readiness.ok) return readiness;
  if (!isGoLiveReadinessAllowed(readiness.overallStatus)) {
    return {
      ok: false,
      error: 'go_live_blocked_readiness_not_ready',
      overallStatus: readiness.overallStatus,
      hint: 'UNKNOWN/BLOCKED readiness must never proceed on stale approval alone',
      readiness,
    };
  }
  return { ok: true, readiness };
}

async function requireNoBlockingDefects(prisma, projectId) {
  const blocking = await listOpenBlockingDefects(prisma, projectId);
  if (blocking.length === 0) return { ok: true, blocking };
  const hasCritical = blocking.some(
    (d) => String(d.severity || '').toUpperCase() === 'CRITICAL'
  );
  return {
    ok: false,
    error: hasCritical
      ? 'go_live_blocked_critical_defect'
      : 'go_live_blocked_high_defect',
    criticalCount: blocking.filter(
      (d) => String(d.severity || '').toUpperCase() === 'CRITICAL'
    ).length,
    highCount: blocking.filter(
      (d) => String(d.severity || '').toUpperCase() === 'HIGH'
    ).length,
    blockingCount: blocking.length,
  };
}

async function loadLatestDecision(prisma, projectId) {
  if (!hasCustomerOnboardingGoLiveDecisionModel(prisma)) return null;
  let rows = [];
  if (typeof prisma.customerOnboardingGoLiveDecision.findMany === 'function') {
    rows = await prisma.customerOnboardingGoLiveDecision.findMany({
      where: { projectId },
    });
  } else if (
    typeof prisma.customerOnboardingGoLiveDecision.findFirst === 'function'
  ) {
    const one = await prisma.customerOnboardingGoLiveDecision.findFirst({
      where: { projectId },
    });
    rows = one ? [one] : [];
  }
  if (!rows?.length) return null;
  return [...rows].sort((a, b) => {
    const ta = new Date(a.decidedAt || a.createdAt || 0).getTime();
    const tb = new Date(b.decidedAt || b.createdAt || 0).getTime();
    return tb - ta;
  })[0];
}

/** Spec §9 — executable GO / GO_WITH_CONDITIONS decision required (no SoD bypass by omission). */
async function requireExecutableDecision(prisma, projectId) {
  if (!hasCustomerOnboardingGoLiveDecisionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_go_live_decision_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  const decision = await loadLatestDecision(prisma, projectId);
  if (!decision) {
    return {
      ok: false,
      error: 'go_live_decision_required',
      hint: 'Record GO or GO_WITH_CONDITIONS before schedule/execute',
    };
  }
  const decisionValue = String(
    decision.decision || decision.status || ''
  ).toUpperCase();
  if (!EXECUTABLE_DECISIONS.has(decisionValue)) {
    return {
      ok: false,
      error: 'go_live_decision_not_executable',
      decision: serializeOnboardingGoLiveDecision(decision),
    };
  }
  return { ok: true, decision };
}

async function advanceTo(prisma, args, projectId, path) {
  let current = (
    await prisma.customerOnboardingProject.findUnique({ where: { id: projectId } })
  )?.status;
  for (const toStatus of path) {
    if (current === toStatus) continue;
    const result = await transitionOnboardingProjectStatus(prisma, {
      ...args,
      projectId,
      toStatus,
      reason: args.reason || 'go_live_flow',
    });
    if (!result.ok && !result.alreadyInStatus) {
      return result;
    }
    current = toStatus;
  }
  return { ok: true, status: current };
}

/**
 * Record GO / GO_WITH_CONDITIONS / NO_GO / DEFERRED / CANCELLED decision.
 * Decision alone does not schedule or execute.
 */
export async function recordGoLiveDecision(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_golive_forbidden' };
  }

  const decision = String(args.decision || '')
    .trim()
    .toUpperCase();
  if (!Object.values(GO_LIVE_DECISION).includes(decision)) {
    return { ok: false, error: 'go_live_decision_required' };
  }

  if (EXECUTABLE_DECISIONS.has(decision)) {
    const readinessGate = await requireCurrentReadiness(
      prisma,
      args,
      loaded.project.id
    );
    if (!readinessGate.ok) return readinessGate;

    const defectsGate = await requireNoBlockingDefects(prisma, loaded.project.id);
    if (!defectsGate.ok) return defectsGate;
  }

  if (!hasCustomerOnboardingGoLiveDecisionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_go_live_decision_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const existing = await prisma.customerOnboardingGoLiveDecision.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    if (existing.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      decision: serializeOnboardingGoLiveDecision(existing),
      created: false,
    };
  }

  const now = args.now || new Date();
  const row = await prisma.customerOnboardingGoLiveDecision.create({
    data: {
      projectId: loaded.project.id,
      decision,
      status: decision,
      conditionsJson: args.conditionsJson || null,
      decidedByAdminId: loaded.admin?.id || null,
      decidedAt: now,
      idempotencyKey,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    created: true,
    decision: serializeOnboardingGoLiveDecision(row),
    domain: getOnboardingDomainContract(),
  };
}

export async function approveGoLive(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_golive_forbidden' };
  }

  const readinessGate = await requireCurrentReadiness(
    prisma,
    args,
    loaded.project.id
  );
  if (!readinessGate.ok) return readinessGate;

  const defectsGate = await requireNoBlockingDefects(prisma, loaded.project.id);
  if (!defectsGate.ok) return defectsGate;

  if (!hasCustomerOnboardingGoLiveApprovalModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_go_live_approval_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const approvalRole = String(args.approvalRole || 'INTERNAL')
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  const row = await prisma.customerOnboardingGoLiveApproval.create({
    data: {
      projectId: loaded.project.id,
      approvalRole,
      status: 'APPROVED',
      approvedByAdminId: loaded.admin?.id || null,
      approvedAt: now,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    approval: serializeOnboardingGoLiveApproval(row),
    readiness: readinessGate.readiness,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Schedule go-live window — does not execute and is not SUCCESSFUL.
 */
export async function scheduleGoLive(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_golive_forbidden' };
  }
  if (!hasCustomerOnboardingGoLiveModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_go_live_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const readinessGate = await requireCurrentReadiness(
    prisma,
    args,
    loaded.project.id
  );
  if (!readinessGate.ok) return readinessGate;

  const defectsGate = await requireNoBlockingDefects(prisma, loaded.project.id);
  if (!defectsGate.ok) return defectsGate;

  const decisionGate = await requireExecutableDecision(prisma, loaded.project.id);
  if (!decisionGate.ok) return decisionGate;

  const approvals = await ensureApprovals(prisma, loaded.project.id);
  if (!approvals.internal || !approvals.customer) {
    return {
      ok: false,
      error: 'go_live_approvals_required',
      approvals,
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const existingByKey = await prisma.customerOnboardingGoLive.findUnique({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    if (existingByKey.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      goLive: serializeOnboardingGoLive(existingByKey),
      created: false,
    };
  }

  const existingForProject = await prisma.customerOnboardingGoLive.findFirst({
    where: { projectId: loaded.project.id },
  });
  if (existingForProject) {
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      goLive: serializeOnboardingGoLive(existingForProject),
      created: false,
    };
  }

  const now = args.now || new Date();
  if (
    String(loaded.project.status || '').toUpperCase() ===
    ONBOARDING_PROJECT_STATUS.READY_FOR_GO_LIVE
  ) {
    const advanced = await advanceTo(prisma, args, loaded.project.id, [
      ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED,
    ]);
    if (!advanced.ok) return advanced;
  }

  const row = await prisma.customerOnboardingGoLive.create({
    data: {
      projectId: loaded.project.id,
      status: 'SCHEDULED',
      windowStart: args.windowStart ? new Date(args.windowStart) : null,
      windowEnd: args.windowEnd ? new Date(args.windowEnd) : null,
      participantsJson: args.participantsJson || null,
      preflightJson: args.preflightJson || null,
      idempotencyKey,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    goLive: serializeOnboardingGoLive(row),
    created: true,
    readiness: readinessGate.readiness,
    domain: getOnboardingDomainContract(),
  };
}

export async function executeGoLive(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_golive_forbidden' };
  }
  if (!hasCustomerOnboardingGoLiveModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_go_live_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const readinessGate = await requireCurrentReadiness(
    prisma,
    args,
    loaded.project.id
  );
  if (!readinessGate.ok) return readinessGate;

  const defectsGate = await requireNoBlockingDefects(prisma, loaded.project.id);
  if (!defectsGate.ok) return defectsGate;

  const decisionGate = await requireExecutableDecision(prisma, loaded.project.id);
  if (!decisionGate.ok) return decisionGate;

  const approvals = await ensureApprovals(prisma, loaded.project.id);
  if (!approvals.internal || !approvals.customer) {
    return {
      ok: false,
      error: 'go_live_approvals_required',
      approvals,
    };
  }

  // SoD: executor must not be the decision recorder.
  const decision = decisionGate.decision;
  const decidedBy = decision.decidedByAdminId || decision.createdByAdminId;
  if (decidedBy && loaded.admin?.id && String(decidedBy) === String(loaded.admin.id)) {
    return {
      ok: false,
      error: 'go_live_sod_executor_cannot_be_decision_recorder',
      hint: 'Separation of duties: decision recorder ≠ executor',
    };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!idempotencyKey) {
    return { ok: false, error: 'idempotencyKey_required' };
  }

  const existingByKey = await prisma.customerOnboardingGoLive.findUnique({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    if (existingByKey.projectId !== loaded.project.id) {
      return { ok: false, error: 'idempotency_conflict' };
    }
    return {
      ok: true,
      alreadyExists: true,
      idempotentReplay: true,
      goLive: serializeOnboardingGoLive(existingByKey),
      created: false,
    };
  }

  const now = args.now || new Date();
  const existingForProject = await prisma.customerOnboardingGoLive.findFirst({
    where: { projectId: loaded.project.id },
  });
  if (existingForProject) {
    const st = String(
      existingForProject.outcome || existingForProject.status || ''
    ).toUpperCase();
    // Upgrade schedule → in-progress (schedule alone ≠ execution)
    if (st === 'SCHEDULED' || st === 'PENDING') {
      const path = [];
      const status = String(loaded.project.status || '').toUpperCase();
      if (status === ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED) {
        path.push(ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS);
      } else if (status === ONBOARDING_PROJECT_STATUS.READY_FOR_GO_LIVE) {
        path.push(
          ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED,
          ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS
        );
      }
      if (path.length) {
        const advanced = await advanceTo(prisma, args, loaded.project.id, path);
        if (!advanced.ok) return advanced;
      }
      const row = await prisma.customerOnboardingGoLive.update({
        where: { id: existingForProject.id },
        data: {
          status: 'IN_PROGRESS',
          windowStart:
            args.windowStart != null
              ? new Date(args.windowStart)
              : existingForProject.windowStart,
          windowEnd:
            args.windowEnd != null
              ? new Date(args.windowEnd)
              : existingForProject.windowEnd,
          participantsJson:
            args.participantsJson !== undefined
              ? args.participantsJson
              : existingForProject.participantsJson,
          preflightJson:
            args.preflightJson !== undefined
              ? args.preflightJson
              : existingForProject.preflightJson,
          updatedAt: now,
        },
      });
      return {
        ok: true,
        goLive: serializeOnboardingGoLive(row),
        created: false,
        upgradedFromSchedule: true,
        readiness: readinessGate.readiness,
        domain: getOnboardingDomainContract(),
      };
    }
    if (
      ['IN_PROGRESS', 'SUCCESSFUL', 'COMPLETED', 'FAILED', 'ROLLED_BACK'].includes(
        st
      )
    ) {
      return {
        ok: true,
        alreadyExists: true,
        idempotentReplay: true,
        goLive: serializeOnboardingGoLive(existingForProject),
        created: false,
      };
    }
  }

  const path = [];
  const status = String(loaded.project.status || '').toUpperCase();
  if (status === ONBOARDING_PROJECT_STATUS.READY_FOR_GO_LIVE) {
    path.push(
      ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED,
      ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS
    );
  } else if (status === ONBOARDING_PROJECT_STATUS.GO_LIVE_SCHEDULED) {
    path.push(ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS);
  }

  if (path.length) {
    const advanced = await advanceTo(prisma, args, loaded.project.id, path);
    if (!advanced.ok) return advanced;
  }

  const row = await prisma.customerOnboardingGoLive.create({
    data: {
      projectId: loaded.project.id,
      status: 'IN_PROGRESS',
      windowStart: args.windowStart ? new Date(args.windowStart) : null,
      windowEnd: args.windowEnd ? new Date(args.windowEnd) : null,
      participantsJson: args.participantsJson || null,
      preflightJson: args.preflightJson || null,
      idempotencyKey,
      createdByAdminId: loaded.admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    goLive: serializeOnboardingGoLive(row),
    created: true,
    readiness: readinessGate.readiness,
    domain: getOnboardingDomainContract(),
  };
}

export async function recordGoLiveOutcome(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_golive_forbidden' };
  }

  const outcome = String(args.outcome || '')
    .trim()
    .toUpperCase();
  if (!outcome) return { ok: false, error: 'outcome_required' };

  const now = args.now || new Date();
  let goLive = null;
  if (hasCustomerOnboardingGoLiveModel(prisma)) {
    goLive = await prisma.customerOnboardingGoLive.findFirst({
      where: { projectId: loaded.project.id },
    });
  }

  if (outcome === 'SUCCESSFUL') {
    const readinessGate = await requireCurrentReadiness(
      prisma,
      args,
      loaded.project.id
    );
    if (!readinessGate.ok) return readinessGate;

    const defectsGate = await requireNoBlockingDefects(prisma, loaded.project.id);
    if (!defectsGate.ok) return defectsGate;

    // Refuse SUCCESSFUL without in-progress go-live evidence (post-execute).
    // Schedule alone / null goLive must never advance to STABILISATION.
    if (!goLive) {
      return {
        ok: false,
        error: 'go_live_evidence_required',
        hint: 'SUCCESSFUL requires an in-progress go-live row after executeGoLive',
        goLive: null,
      };
    }
    const goLiveStatus = String(goLive.status || '').toUpperCase();
    if (goLiveStatus === 'SUCCESSFUL' || goLiveStatus === 'COMPLETED') {
      return {
        ok: true,
        alreadyExists: true,
        idempotentReplay: true,
        goLive: serializeOnboardingGoLive(goLive),
        project: {
          id: loaded.project.id,
          status: loaded.project.status,
          onboardingNumber:
            loaded.project.onboardingNumber || loaded.project.number || null,
        },
        domain: getOnboardingDomainContract(),
      };
    }
    if (goLiveStatus !== 'IN_PROGRESS') {
      return {
        ok: false,
        error: 'go_live_not_in_progress',
        hint: 'schedule alone ≠ SUCCESSFUL; executeGoLive first',
        goLiveStatus,
        goLive: serializeOnboardingGoLive(goLive),
      };
    }

    goLive = await prisma.customerOnboardingGoLive.update({
      where: { id: goLive.id },
      data: {
        status: outcome,
        outcome,
        customerAcknowledged: args.customerAcknowledged === true,
        rollbackDecision: goLive.rollbackDecision || null,
        updatedAt: now,
      },
    });
  } else if (goLive) {
    // Rollback / failure must preserve evidence — never delete the go-live row.
    goLive = await prisma.customerOnboardingGoLive.update({
      where: { id: goLive.id },
      data: {
        status: outcome,
        outcome,
        customerAcknowledged: args.customerAcknowledged === true,
        rollbackDecision:
          args.rollbackDecision ||
          (outcome === 'ROLLED_BACK' ? 'ROLLBACK_PRESERVE_EVIDENCE' : null) ||
          goLive.rollbackDecision ||
          null,
        updatedAt: now,
      },
    });
  }

  let project = loaded.project;
  if (outcome === 'SUCCESSFUL') {
    const path = [];
    const st = String(project.status || '').toUpperCase();
    // Only advance from post-execute project states — never from SCHEDULED alone.
    if (st === ONBOARDING_PROJECT_STATUS.GO_LIVE_IN_PROGRESS) {
      path.push(
        ONBOARDING_PROJECT_STATUS.LIVE,
        ONBOARDING_PROJECT_STATUS.STABILISATION
      );
    } else if (st === ONBOARDING_PROJECT_STATUS.LIVE) {
      path.push(ONBOARDING_PROJECT_STATUS.STABILISATION);
    } else if (st === ONBOARDING_PROJECT_STATUS.STABILISATION) {
      // already advanced
    } else {
      return {
        ok: false,
        error: 'go_live_project_not_in_progress',
        hint: 'SUCCESSFUL requires project GO_LIVE_IN_PROGRESS after executeGoLive',
        fromStatus: st,
        goLive: serializeOnboardingGoLive(goLive),
      };
    }

    for (const toStatus of path) {
      const result = await transitionOnboardingProjectStatus(prisma, {
        ...args,
        projectId: project.id,
        toStatus,
        reason: 'go_live_successful',
        now,
      });
      if (result.ok || result.alreadyInStatus) {
        project = {
          ...project,
          status: result.project?.status || toStatus,
        };
      } else if (toStatus === ONBOARDING_PROJECT_STATUS.STABILISATION) {
        const current = await prisma.customerOnboardingProject.findUnique({
          where: { id: project.id },
        });
        if (current?.status === ONBOARDING_PROJECT_STATUS.LIVE) {
          const updated = await prisma.customerOnboardingProject.update({
            where: { id: project.id },
            data: {
              status: ONBOARDING_PROJECT_STATUS.STABILISATION,
              updatedAt: now,
            },
          });
          project = updated;
        } else {
          return {
            ok: false,
            error: 'go_live_stabilisation_transition_failed',
            fromStatus: current?.status || project.status,
            toStatus: ONBOARDING_PROJECT_STATUS.STABILISATION,
            goLive: serializeOnboardingGoLive(goLive),
            project: {
              id: project.id,
              status: current?.status || project.status,
              onboardingNumber: project.onboardingNumber,
            },
          };
        }
      } else {
        return {
          ok: false,
          error: 'go_live_stabilisation_transition_failed',
          fromStatus: project.status,
          toStatus,
          transitionError: result.error,
          goLive: serializeOnboardingGoLive(goLive),
          project: {
            id: project.id,
            status: project.status,
            onboardingNumber: project.onboardingNumber,
          },
        };
      }
    }
  }

  const fresh = await prisma.customerOnboardingProject.findUnique({
    where: { id: project.id },
  });

  if (
    outcome === 'SUCCESSFUL' &&
    String(fresh?.status || '').toUpperCase() !==
      ONBOARDING_PROJECT_STATUS.STABILISATION
  ) {
    return {
      ok: false,
      error: 'go_live_stabilisation_transition_failed',
      hint: 'SUCCESSFUL outcome must leave project in STABILISATION',
      goLive: serializeOnboardingGoLive(goLive),
      project: {
        id: fresh?.id || project.id,
        status: fresh?.status || project.status,
        onboardingNumber: fresh?.onboardingNumber || project.onboardingNumber,
      },
    };
  }

  return {
    ok: true,
    goLive: serializeOnboardingGoLive(goLive),
    project: {
      id: fresh.id,
      status: fresh.status,
      onboardingNumber: fresh.onboardingNumber,
    },
    domain: getOnboardingDomainContract(),
  };
}
