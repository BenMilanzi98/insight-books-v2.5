/**
 * Adoption Request / Plan status transitions — Phase 19 Wave 1–2.
 * Invalid transitions throw. COMPLETED requires evaluateAdoptionPlanCompletion.
 * HANDED_TO_RENEWALS gated on Wave 3 expansion handoff HANDED_OFF|ACKNOWLEDGED (or audited waiver).
 */

import {
  ADOPTION_REQUEST_STATUS,
  ADOPTION_PLAN_STATUS,
  ADOPTION_COMPLETION_POLICY_REQUIRED,
  ADOPTION_HANDOFF_POLICY_REQUIRED,
  ADOPTION_EXPANSION_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionRequestStatusHistoryModel,
  hasCustomerAdoptionPlanStatusHistoryModel,
  resolveAdoptionActor,
  serializeAdoptionRequest,
  serializeAdoptionPlan,
} from './model.js';
import {
  loadAdoptionPlanForActor,
  loadAdoptionRequestForActor,
} from './planAccess.js';
import {
  evaluateAdoptionPlanCompletion,
  hasAuditedCompletionWaiver,
} from './completion.js';

async function hasQualifyingExpansionHandoff(prisma, planId) {
  if (typeof prisma?.customerAdoptionExpansionHandoff?.findMany !== 'function') {
    return false;
  }
  const rows = await prisma.customerAdoptionExpansionHandoff.findMany({
    where: { planId: String(planId) },
  });
  return (rows || []).some((row) => {
    const status = String(row.status || '').toUpperCase();
    return (
      status === ADOPTION_EXPANSION_STATUS.HANDED_OFF ||
      status === ADOPTION_EXPANSION_STATUS.ACKNOWLEDGED
    );
  });
}

const REQUEST_TRANSITIONS = Object.freeze({
  [ADOPTION_REQUEST_STATUS.NEW]: [
    ADOPTION_REQUEST_STATUS.VALIDATING,
    ADOPTION_REQUEST_STATUS.INFORMATION_REQUIRED,
    ADOPTION_REQUEST_STATUS.READY,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ADOPTION_REQUEST_STATUS.VALIDATING]: [
    ADOPTION_REQUEST_STATUS.INFORMATION_REQUIRED,
    ADOPTION_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED,
    ADOPTION_REQUEST_STATUS.READY,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
  ],
  [ADOPTION_REQUEST_STATUS.INFORMATION_REQUIRED]: [
    ADOPTION_REQUEST_STATUS.VALIDATING,
    ADOPTION_REQUEST_STATUS.READY,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ADOPTION_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED]: [
    ADOPTION_REQUEST_STATUS.VALIDATING,
    ADOPTION_REQUEST_STATUS.READY,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.SUPERSEDED,
  ],
  [ADOPTION_REQUEST_STATUS.READY]: [
    ADOPTION_REQUEST_STATUS.ACCEPTED,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.CUSTOMER_DEFERRED,
    ADOPTION_REQUEST_STATUS.INFORMATION_REQUIRED,
  ],
  [ADOPTION_REQUEST_STATUS.ACCEPTED]: [
    ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN,
    ADOPTION_REQUEST_STATUS.REJECTED,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [ADOPTION_REQUEST_STATUS.CONVERTED_TO_PLAN]: [ADOPTION_REQUEST_STATUS.ARCHIVED],
  [ADOPTION_REQUEST_STATUS.REJECTED]: [ADOPTION_REQUEST_STATUS.ARCHIVED],
  [ADOPTION_REQUEST_STATUS.CANCELLED]: [ADOPTION_REQUEST_STATUS.ARCHIVED],
  [ADOPTION_REQUEST_STATUS.CUSTOMER_DEFERRED]: [
    ADOPTION_REQUEST_STATUS.READY,
    ADOPTION_REQUEST_STATUS.CANCELLED,
    ADOPTION_REQUEST_STATUS.ARCHIVED,
  ],
  [ADOPTION_REQUEST_STATUS.SUPERSEDED]: [ADOPTION_REQUEST_STATUS.ARCHIVED],
  [ADOPTION_REQUEST_STATUS.ARCHIVED]: [],
});

const PLAN_TRANSITIONS = Object.freeze({
  [ADOPTION_PLAN_STATUS.DRAFT]: [
    ADOPTION_PLAN_STATUS.ACTIVE,
    ADOPTION_PLAN_STATUS.CANCELLED,
  ],
  [ADOPTION_PLAN_STATUS.ACTIVE]: [
    ADOPTION_PLAN_STATUS.ON_TRACK,
    ADOPTION_PLAN_STATUS.AT_RISK,
    ADOPTION_PLAN_STATUS.VALUE_REVIEW,
    ADOPTION_PLAN_STATUS.CHURN_RISK,
    ADOPTION_PLAN_STATUS.CANCELLED,
  ],
  [ADOPTION_PLAN_STATUS.ON_TRACK]: [
    ADOPTION_PLAN_STATUS.AT_RISK,
    ADOPTION_PLAN_STATUS.VALUE_REVIEW,
    ADOPTION_PLAN_STATUS.CHURN_RISK,
    ADOPTION_PLAN_STATUS.CANCELLED,
  ],
  [ADOPTION_PLAN_STATUS.AT_RISK]: [
    ADOPTION_PLAN_STATUS.ON_TRACK,
    ADOPTION_PLAN_STATUS.VALUE_REVIEW,
    ADOPTION_PLAN_STATUS.CHURN_RISK,
    ADOPTION_PLAN_STATUS.CANCELLED,
  ],
  [ADOPTION_PLAN_STATUS.VALUE_REVIEW]: [
    ADOPTION_PLAN_STATUS.COMPLETED,
    ADOPTION_PLAN_STATUS.HANDED_TO_RENEWALS,
    ADOPTION_PLAN_STATUS.ON_TRACK,
    ADOPTION_PLAN_STATUS.AT_RISK,
    ADOPTION_PLAN_STATUS.CHURN_RISK,
    ADOPTION_PLAN_STATUS.CANCELLED,
  ],
  [ADOPTION_PLAN_STATUS.CHURN_RISK]: [
    ADOPTION_PLAN_STATUS.AT_RISK,
    ADOPTION_PLAN_STATUS.VALUE_REVIEW,
    ADOPTION_PLAN_STATUS.CANCELLED,
    ADOPTION_PLAN_STATUS.HANDED_TO_RENEWALS,
  ],
  [ADOPTION_PLAN_STATUS.COMPLETED]: [
    ADOPTION_PLAN_STATUS.HANDED_TO_RENEWALS,
    ADOPTION_PLAN_STATUS.ARCHIVED,
  ],
  [ADOPTION_PLAN_STATUS.HANDED_TO_RENEWALS]: [ADOPTION_PLAN_STATUS.ARCHIVED],
  [ADOPTION_PLAN_STATUS.CANCELLED]: [ADOPTION_PLAN_STATUS.ARCHIVED],
  [ADOPTION_PLAN_STATUS.ARCHIVED]: [],
});

export function canTransitionAdoptionRequestStatus(from, to) {
  const allowed = REQUEST_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function canTransitionAdoptionPlanStatus(from, to) {
  const allowed = PLAN_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertCanTransitionAdoptionRequestStatus(from, to) {
  if (from === to) return;
  if (!canTransitionAdoptionRequestStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

export function assertCanTransitionAdoptionPlanStatus(from, to) {
  if (from === to) return;
  if (!canTransitionAdoptionPlanStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

export async function transitionAdoptionRequestStatus(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_request_status_forbidden' };
  }

  const requestId = args.adoptionRequestId || args.requestId;
  const access = await loadAdoptionRequestForActor(prisma, {
    ...args,
    requestId,
    adoptionRequestId: requestId,
  });
  if (!access.ok) return access;
  const row = access.requestRow || access.request;

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      request: serializeAdoptionRequest(row),
      alreadyInStatus: true,
      domain: getAdoptionDomainContract(),
    };
  }

  assertCanTransitionAdoptionRequestStatus(row.status, toStatus);

  const now = args.now || new Date();
  const updated = await prisma.customerAdoptionRequest.update({
    where: { id: row.id },
    data: {
      status: toStatus,
      updatedAt: now,
      ...(args.planId ? { planId: args.planId } : {}),
    },
  });

  if (hasCustomerAdoptionRequestStatusHistoryModel(prisma)) {
    await prisma.customerAdoptionRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    request: serializeAdoptionRequest(updated),
    domain: getAdoptionDomainContract(),
  };
}

export async function transitionAdoptionPlanStatus(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return { ok: false, forbidden: true, reason: 'adoption_plan_status_forbidden' };
  }

  const planId = args.adoptionPlanId || args.planId;
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;
  const row = access.planRow || access.plan;

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      plan: serializeAdoptionPlan(row),
      alreadyInStatus: true,
      domain: getAdoptionDomainContract(),
    };
  }

  assertCanTransitionAdoptionPlanStatus(row.status, toStatus);

  if (toStatus === ADOPTION_PLAN_STATUS.COMPLETED) {
    const evaluation = await evaluateAdoptionPlanCompletion(prisma, {
      ...args,
      planId: row.id,
      adoptionPlanId: row.id,
    });
    if (!evaluation.ok) {
      return {
        ok: false,
        error: evaluation.error || ADOPTION_COMPLETION_POLICY_REQUIRED,
        status: evaluation.status || 'UNAVAILABLE',
        evaluation,
      };
    }
  }

  if (toStatus === ADOPTION_PLAN_STATUS.HANDED_TO_RENEWALS) {
    if (!hasAuditedCompletionWaiver(args)) {
      const handoffOk = await hasQualifyingExpansionHandoff(prisma, row.id);
      if (!handoffOk) {
        return {
          ok: false,
          error: ADOPTION_HANDOFF_POLICY_REQUIRED,
          status: 'UNAVAILABLE',
          message:
            'HANDED_TO_RENEWALS requires Wave 3 expansion handoff HANDED_OFF|ACKNOWLEDGED (or audited waiver)',
        };
      }
    }
  }

  const now = args.now || new Date();
  const updated = await prisma.customerAdoptionPlan.update({
    where: { id: row.id },
    data: { status: toStatus, updatedAt: now },
  });

  if (hasCustomerAdoptionPlanStatusHistoryModel(prisma)) {
    await prisma.customerAdoptionPlanStatusHistory.create({
      data: {
        planId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    plan: serializeAdoptionPlan(updated),
    domain: getAdoptionDomainContract(),
  };
}

export { evaluateAdoptionPlanCompletion };
export { ADOPTION_REQUEST_STATUS, ADOPTION_PLAN_STATUS };
