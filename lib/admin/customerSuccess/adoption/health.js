/**
 * Adoption Plan health — Phase 19 Wave 2 (versioned; never invents COMPLETED).
 */

import {
  ADOPTION_HEALTH_RULES_VERSION,
  ADOPTION_HEALTH_STATUS,
  ADOPTION_MILESTONE_STATUS,
  ADOPTION_PLAN_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import {
  canManageAdoption,
  canViewAdoption,
  hasCustomerAdoptionMilestoneModel,
  resolveAdoptionActor,
} from './model.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

export async function calculateAdoptionHealth(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin) && !canManageAdoption(admin)) {
    return { ok: false, forbidden: true, error: 'adoption_health_forbidden' };
  }

  const planId = args.planId || args.adoptionPlanId
    ? String(args.planId || args.adoptionPlanId).trim()
    : '';
  if (!planId) return { ok: false, error: 'planId_required' };

  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId,
    adoptionPlanId: planId,
  });
  if (!access.ok) return access;

  const plan = access.planRow;
  const planStatus = String(plan.status || '').toUpperCase();

  let milestones = [];
  if (hasCustomerAdoptionMilestoneModel(prisma)) {
    milestones = await prisma.customerAdoptionMilestone.findMany({
      where: { planId: plan.id },
    });
  }

  let status = ADOPTION_HEALTH_STATUS.NOT_ENOUGH_DATA;

  if (
    planStatus === ADOPTION_PLAN_STATUS.AT_RISK ||
    planStatus === ADOPTION_PLAN_STATUS.CHURN_RISK
  ) {
    status = ADOPTION_HEALTH_STATUS.AT_RISK;
  } else if (!milestones.length) {
    status = ADOPTION_HEALTH_STATUS.NOT_ENOUGH_DATA;
  } else {
    const unknown = milestones.some(
      (m) => String(m.status) === ADOPTION_MILESTONE_STATUS.UNKNOWN
    );
    const metOrWaived = milestones.filter((m) =>
      [ADOPTION_MILESTONE_STATUS.MET, ADOPTION_MILESTONE_STATUS.WAIVED].includes(
        String(m.status)
      )
    );
    if (unknown && metOrWaived.length === 0) {
      status = ADOPTION_HEALTH_STATUS.UNKNOWN;
    } else if (
      planStatus === ADOPTION_PLAN_STATUS.ON_TRACK ||
      metOrWaived.length === milestones.length
    ) {
      status = ADOPTION_HEALTH_STATUS.ON_TRACK;
    } else if (metOrWaived.length > 0) {
      status = ADOPTION_HEALTH_STATUS.WATCH;
    } else {
      status = ADOPTION_HEALTH_STATUS.NOT_ENOUGH_DATA;
    }
  }

  // Never invent COMPLETED from health
  if (status === 'COMPLETED' || String(status) === ADOPTION_PLAN_STATUS.COMPLETED) {
    status = ADOPTION_HEALTH_STATUS.UNKNOWN;
  }

  return {
    ok: true,
    status,
    rulesVersion: ADOPTION_HEALTH_RULES_VERSION,
    planId: plan.id,
    planStatus,
    milestoneCount: milestones.length,
    domain: getAdoptionDomainContract(),
  };
}
