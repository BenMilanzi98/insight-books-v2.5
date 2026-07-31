/**
 * Adoption Plan completion evaluation — Phase 19 Wave 2.
 * Requires: all critical milestones MET|WAIVED + value review sign-off +
 * no blocking Critical DQ + manage + planAccess.
 * Any-one-milestone ≠ Plan COMPLETED. Pure FSM COMPLETED forbidden.
 */

import {
  ADOPTION_COMPLETION_POLICY_REQUIRED,
  ADOPTION_MILESTONE_STATUS,
  ADOPTION_VALUE_REVIEW_STATE,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  hasCustomerAdoptionMilestoneModel,
  resolveAdoptionActor,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

function hasAuditedCompletionWaiver(args = {}) {
  const waiver =
    args.auditedCompletionWaiver === true ||
    args.completionWaiver === true ||
    String(args.waiverType || '')
      .trim()
      .toUpperCase() === 'AUDITED_COMPLETION_WAIVER';
  const reason = args.waiverReason || args.reason;
  return Boolean(waiver && reason && String(reason).trim());
}

function isCriticalSatisfied(milestone) {
  const status = String(milestone.status || '').toUpperCase();
  return (
    status === ADOPTION_MILESTONE_STATUS.MET ||
    status === ADOPTION_MILESTONE_STATUS.WAIVED
  );
}

/**
 * Evaluate whether an Adoption Plan may transition to COMPLETED.
 */
export async function evaluateAdoptionPlanCompletion(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canManageAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'adoption_completion_evaluate_forbidden',
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'UNAVAILABLE',
    };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) {
    return {
      ok: false,
      error: 'planId_required',
      status: 'UNAVAILABLE',
    };
  }

  // Portfolio / tenant planAccess before any waiver or READY claim.
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) {
    return {
      ...access,
      error: access.error || ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: access.status || 'UNAVAILABLE',
    };
  }

  if (hasAuditedCompletionWaiver(args)) {
    return {
      ok: true,
      status: 'WAIVED',
      waived: true,
      domain: getAdoptionDomainContract(),
    };
  }

  const plan = access.planRow;

  if (!hasCustomerAdoptionMilestoneModel(prisma)) {
    return {
      ok: false,
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'UNAVAILABLE',
      message: 'Milestone model unavailable — cannot prove critical completion',
      domain: getAdoptionDomainContract(),
    };
  }

  const milestones = await prisma.customerAdoptionMilestone.findMany({
    where: { planId: plan.id },
  });

  if (!milestones.length) {
    return {
      ok: false,
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'INCOMPLETE',
      message: 'No milestones materialised — Plan COMPLETED forbidden',
      gaps: ['MILESTONES_REQUIRED'],
      domain: getAdoptionDomainContract(),
    };
  }

  const critical = milestones.filter((m) => m.critical === true);
  const unmetCritical = critical.filter((m) => !isCriticalSatisfied(m));

  if (unmetCritical.length) {
    return {
      ok: false,
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'INCOMPLETE',
      message:
        'All critical milestones must be MET or audited WAIVED — any-one-milestone is insufficient',
      gaps: ['CRITICAL_MILESTONES_INCOMPLETE'],
      unmetCritical: unmetCritical.map((m) => ({
        id: m.id,
        templateKey: m.templateKey,
        status: m.status,
      })),
      domain: getAdoptionDomainContract(),
    };
  }

  const valueReview =
    plan.valueReviewState ||
    args.valueReviewState ||
    null;
  if (String(valueReview || '').toUpperCase() !== ADOPTION_VALUE_REVIEW_STATE.SIGNED_OFF) {
    return {
      ok: false,
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'INCOMPLETE',
      message: 'Value review sign-off is required for Plan COMPLETED',
      gaps: ['VALUE_REVIEW_REQUIRED'],
      domain: getAdoptionDomainContract(),
    };
  }

  // Blocking Critical DQ (Wave 4 deepens DQ engine; Wave 2 accepts explicit flag)
  if (args.blockingCriticalDq === true || plan.blockingCriticalDq === true) {
    return {
      ok: false,
      error: ADOPTION_COMPLETION_POLICY_REQUIRED,
      status: 'INCOMPLETE',
      message: 'Blocking Critical data-quality defects remain on Plan',
      gaps: ['BLOCKING_CRITICAL_DQ'],
      domain: getAdoptionDomainContract(),
    };
  }

  return {
    ok: true,
    status: 'READY',
    criticalCount: critical.length,
    unmetCriticalCount: 0,
    valueReviewState: ADOPTION_VALUE_REVIEW_STATE.SIGNED_OFF,
    domain: getAdoptionDomainContract(),
  };
}

export { hasAuditedCompletionWaiver };
