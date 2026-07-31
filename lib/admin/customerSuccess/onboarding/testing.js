/**
 * Onboarding testing coordination — plans / cases / results (metadata).
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTestPlanModel,
  serializeOnboardingTestPlan,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';

export async function upsertOnboardingTestPlan(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;
  if (!canManageOnboarding(loaded.admin)) {
    return { ok: false, forbidden: true, error: 'onboarding_testing_forbidden' };
  }
  if (!hasCustomerOnboardingTestPlanModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_test_plan_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const now = args.now || new Date();
  const existing = await prisma.customerOnboardingTestPlan.findFirst({
    where: { projectId: loaded.project.id },
  });

  const data = {
    projectId: loaded.project.id,
    name: args.name || existing?.name || 'Onboarding test plan',
    status: String(args.status || existing?.status || 'DRAFT')
      .trim()
      .toUpperCase(),
    casesJson: args.casesJson !== undefined ? args.casesJson : existing?.casesJson,
    resultsJson:
      args.resultsJson !== undefined ? args.resultsJson : existing?.resultsJson,
    updatedAt: now,
  };

  const row = existing
    ? await prisma.customerOnboardingTestPlan.update({
        where: { id: existing.id },
        data,
      })
    : await prisma.customerOnboardingTestPlan.create({
        data: {
          ...data,
          createdByAdminId: loaded.admin?.id || null,
          createdAt: now,
        },
      });

  return {
    ok: true,
    testPlan: serializeOnboardingTestPlan(row),
    domain: getOnboardingDomainContract(),
  };
}
