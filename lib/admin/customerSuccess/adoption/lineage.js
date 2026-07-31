/**
 * Adoption lineage — Phase 19 Wave 4.
 * Request ← Training Program / Handover / Manual; Plan ← Request + template.
 * Portfolio-scoped via planAccess.
 */

import { getAdoptionDomainContract } from './catalogue.js';
import { loadAdoptionPlanForActor } from './planAccess.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, planId?: string, portfolioTenantIds?: string[] }} args
 */
export async function getAdoptionLineage(prisma, args = {}) {
  const access = await loadAdoptionPlanForActor(prisma, {
    ...args,
    planId: args.planId || args.adoptionPlanId,
  });
  if (!access.ok) {
    return { ...access, lineage: null };
  }

  const plan = access.planRow || access.plan;
  return {
    ok: true,
    lineage: {
      adoptionRequestId: plan.adoptionRequestId || null,
      trainingProgramId: plan.trainingProgramId || null,
      onboardingProjectId: plan.onboardingProjectId || null,
      onboardingHandoverId: plan.onboardingHandoverId || null,
      successPlanId: plan.successPlanId || null,
      planTemplateVersionId: plan.planTemplateVersionId || null,
      plan: access.plan,
    },
    domain: getAdoptionDomainContract(),
  };
}
