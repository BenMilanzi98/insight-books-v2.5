/**
 * Onboarding My Work — Phase 17 Wave 4.
 * Portfolio / owner scoped: excludes other CS owners' projects.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingProject,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import {
  applyOnboardingReportHonesty,
  ONBOARDING_REPORT_STATUS,
} from './reliabilityGate.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object }} args
 */
export async function getOnboardingMyWork(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    const honesty = applyOnboardingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      count: null,
      projects: [],
      honesty,
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      projects: [],
      honesty,
      reason: 'customer_onboarding_project_model_unavailable',
    };
  }

  const ownerId = admin?.id ? String(admin.id) : '';
  if (!ownerId) {
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.EMPTY,
      count: 0,
      projects: [],
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
    };
  }

  try {
    const rows = await prisma.customerOnboardingProject.findMany({
      where: {
        OR: [{ csOwnerAdminId: ownerId }, { ownerAdminId: ownerId }],
      },
    });

    // Extra defensive filter — never leak other owners even if query OR is loose
    const mine = (rows || []).filter((r) => {
      const cs = r.csOwnerAdminId || r.ownerAssignmentsJson?.csOwnerAdminId;
      const owner = r.ownerAdminId || r.ownerAssignmentsJson?.ownerAdminId;
      return cs === ownerId || owner === ownerId;
    });

    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.READY,
      count: mine.length,
      projects: mine.map((r) => serializeOnboardingProject(r)),
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        portfolioScoped: true,
      },
      domain: getOnboardingDomainContract(),
    };
  } catch {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      projects: [],
      honesty,
      reason: 'my_work_query_failed',
    };
  }
}
