/**
 * Adoption data-quality foundations — Phase 19 Wave 4.
 * Never invent DQ scores or false zeroes on gate failure.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 */

import {
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionRequestModel,
  resolveAdoptionActor,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import {
  applyAdoptionReportHonesty,
  safeAdoptionCount,
  ADOPTION_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const ADOPTION_DQ_VERSION = 'cs-adoption-dq-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[] }} args
 */
export async function runAdoptionDataQuality(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      checks: null,
      reason: 'adoption_dq_forbidden',
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      checks: null,
      honesty,
      definitionVersion: ADOPTION_DQ_VERSION,
      domain: getAdoptionDomainContract(),
    };
  }

  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: !scopeResult.forbidden,
    });
    return {
      ok: scopeResult.forbidden ? false : true,
      forbidden: Boolean(scopeResult.forbidden),
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      checks: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ADOPTION_DQ_VERSION,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const plans = await safeAdoptionCount(() =>
    prisma.customerAdoptionPlan.count({ where: scopeWhere })
  );
  if (!plans.ok) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      checks: null,
      honesty,
      definitionVersion: ADOPTION_DQ_VERSION,
      domain: getAdoptionDomainContract(),
    };
  }

  // Request model missing / gate fail → UNAVAILABLE + null — never invent 0.
  if (!hasCustomerAdoptionRequestModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: false,
      queryOk: true,
      permissionOk: true,
    });
    return {
      ok: true,
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      checks: {
        totalPlans: plans.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'customer_adoption_request_model_unavailable',
      definitionVersion: ADOPTION_DQ_VERSION,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  const requests = await safeAdoptionCount(() =>
    prisma.customerAdoptionRequest.count({ where: scopeWhere })
  );
  if (!requests.ok) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      checks: {
        totalPlans: plans.value,
        totalRequests: null,
        orphanedRequests: null,
        blockingDq: null,
        blockingDqStatus: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      },
      honesty: {
        ...honesty,
        inventZeroesForbidden: true,
        falseZeroes: false,
      },
      reason: 'adoption_dq_request_query_failed',
      definitionVersion: ADOPTION_DQ_VERSION,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped },
    };
  }

  // Counts are real; orphaned/blocking DQ checks are not instrumented — null + UNAVAILABLE.
  return {
    ok: true,
    status: ADOPTION_REPORT_STATUS.READY,
    checks: {
      totalPlans: plans.value,
      totalRequests: requests.value,
      orphanedRequests: null,
      orphanedRequestsStatus: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      blockingDq: null,
      blockingDqStatus: ADOPTION_REPORT_STATUS.UNAVAILABLE,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: ADOPTION_DQ_VERSION,
    domain: getAdoptionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
