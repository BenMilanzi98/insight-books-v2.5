/**
 * Onboarding reconciliation — Phase 17 Wave 4 / Phase 21 Wave 4 harden.
 * Handoff ↔ request ↔ project ↔ tenant scope ↔ migration/training/MRA ↔ go-live ↔ completion.
 * Never invent zeroes or lineageIntact:true on gate failure / thin instrumentation.
 * Portfolio / tenant fail-closed.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
} from './model.js';
import { getOnboardingDomainContract } from './catalogue.js';
import {
  applyOnboardingReportHonesty,
  safeOnboardingCount,
  ONBOARDING_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveOnboardingListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const ONBOARDING_RECON_VERSION = 'cs-onboarding-recon-v2-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[], now?: Date }} args
 */
export async function runOnboardingReconciliation(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      reason: 'onboarding_recon_forbidden',
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty,
      definitionVersion: ONBOARDING_RECON_VERSION,
      domain: getOnboardingDomainContract(),
    };
  }

  const scopeResult = await resolveOnboardingListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: !scopeResult.forbidden,
    });
    return {
      ok: scopeResult.forbidden ? false : true,
      forbidden: Boolean(scopeResult.forbidden),
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ONBOARDING_RECON_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const projects = await safeOnboardingCount(() =>
    prisma.customerOnboardingProject.count({ where: scopeWhere })
  );
  if (!projects.ok) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty,
      definitionVersion: ONBOARDING_RECON_VERSION,
    };
  }

  if (projects.value === 0) {
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.EMPTY,
      cards: null,
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
        kpiSafe: false,
      },
      definitionVersion: ONBOARDING_RECON_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  // Thin stub: project count is real; lineage integrity is not instrumented —
  // never invent lineageIntact: true. Null + UNAVAILABLE for that check.
  const cards = {
    projects: projects.value,
    phase8Linked: null,
    lineageIntact: null,
    lineageIntactStatus: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
  };

  return {
    ok: true,
    status: ONBOARDING_REPORT_STATUS.READY,
    cards,
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: ONBOARDING_RECON_VERSION,
    domain: getOnboardingDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
