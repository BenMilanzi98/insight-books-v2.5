/**
 * Adoption reconciliation — Phase 19 Wave 4.
 * Request ↔ Plan ↔ Phase 8 Success Plan link ↔ milestones ↔ expansion.
 * Never invent zeroes on gate failure.
 * Portfolio-scoped for non–Super Admin (fail-closed empty scope).
 */

import {
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
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

export const ADOPTION_RECON_VERSION = 'cs-adoption-recon-v1-2026-07-31';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, portfolioTenantIds?: string[] }} args
 */
export async function runAdoptionReconciliation(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    return {
      ok: false,
      forbidden: true,
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      cards: null,
      reason: 'adoption_recon_forbidden',
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: null,
      honesty,
      definitionVersion: ADOPTION_RECON_VERSION,
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
      cards: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ADOPTION_RECON_VERSION,
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
      cards: null,
      honesty,
      definitionVersion: ADOPTION_RECON_VERSION,
      domain: getAdoptionDomainContract(),
    };
  }

  // Thin stub: plans count is real; lineage integrity is not instrumented —
  // never invent lineageIntact: true. Null + UNAVAILABLE for that check.
  return {
    ok: true,
    status: ADOPTION_REPORT_STATUS.READY,
    cards: {
      plans: plans.value,
      phase8Linked: null,
      lineageIntact: null,
      lineageIntactStatus: ADOPTION_REPORT_STATUS.UNAVAILABLE,
    },
    honesty: {
      inventZeroesForbidden: true,
      falseZeroes: false,
      portfolioScoped: scopeResult.portfolioScoped,
      thinInstrumentation: true,
    },
    definitionVersion: ADOPTION_RECON_VERSION,
    domain: getAdoptionDomainContract(),
    meta: { portfolioScoped: scopeResult.portfolioScoped },
  };
}
