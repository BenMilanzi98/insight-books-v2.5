/**
 * Onboarding data-quality foundations — Phase 17 Wave 4 / Phase 21 Wave 4 harden.
 * Never invent DQ scores or false zeroes on gate failure.
 * Portfolio / tenant fail-closed.
 */

import {
  canViewOnboarding,
  hasCustomerOnboardingProjectModel,
  hasCustomerOnboardingRequestModel,
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

export const ONBOARDING_DQ_VERSION = 'cs-onboarding-dq-v2-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[], now?: Date }} args
 */
export async function runOnboardingDataQuality(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      checks: null,
      reason: 'onboarding_dq_forbidden',
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      checks: null,
      honesty,
      definitionVersion: ONBOARDING_DQ_VERSION,
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
      checks: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ONBOARDING_DQ_VERSION,
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
      checks: null,
      honesty,
      definitionVersion: ONBOARDING_DQ_VERSION,
    };
  }

  if (projects.value === 0) {
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.EMPTY,
      checks: {
        totalProjects: null,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
      },
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        emptyEnvelope: true,
      },
      definitionVersion: ONBOARDING_DQ_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  // Request model missing → UNAVAILABLE / totalRequests null — never invent 0.
  if (!hasCustomerOnboardingRequestModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: false,
      queryOk: true,
      permissionOk: true,
    });
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalProjects: projects.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'customer_onboarding_request_model_unavailable',
      definitionVersion: ONBOARDING_DQ_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const requests = await safeOnboardingCount(() =>
    prisma.customerOnboardingRequest.count({ where: scopeWhere })
  );
  if (!requests.ok) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalProjects: projects.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'onboarding_dq_request_query_failed',
      definitionVersion: ONBOARDING_DQ_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  return {
    ok: true,
    status: ONBOARDING_REPORT_STATUS.READY,
    checks: {
      totalProjects: projects.value,
      totalRequests: requests.value,
      orphanedRequests: null,
      // Thin stub: blocking DQ not fully instrumented — never invent false (= all clear).
      blockingDq: null,
      blockingDqStatus: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
    },
    definitionVersion: ONBOARDING_DQ_VERSION,
    domain: getOnboardingDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
