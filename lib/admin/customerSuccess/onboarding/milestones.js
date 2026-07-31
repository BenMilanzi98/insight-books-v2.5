/**
 * Milestone list helpers — Phase 17 Wave 2.
 */

import { getOnboardingDomainContract } from './catalogue.js';
import {
  canViewOnboarding,
  hasCustomerOnboardingMilestoneModel,
  resolveOnboardingActor,
  serializeOnboardingMilestone,
} from './model.js';

export async function listOnboardingMilestones(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_milestone_list_forbidden' };
  }
  if (!hasCustomerOnboardingMilestoneModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_milestone_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const rows = await prisma.customerOnboardingMilestone.findMany({
    where: { projectId },
  });

  return {
    ok: true,
    milestones: rows.map(serializeOnboardingMilestone),
    domain: getOnboardingDomainContract(),
  };
}
