/**
 * Adoption My Work — Phase 19 Wave 4.
 * Portfolio + owner scoped: excludes other CS owners' plans and out-of-portfolio tenants.
 */

import {
  canViewAdoption,
  hasCustomerAdoptionPlanModel,
  resolveAdoptionActor,
  serializeAdoptionPlan,
} from './model.js';
import { getAdoptionDomainContract } from './catalogue.js';
import {
  applyAdoptionReportHonesty,
  ADOPTION_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object, portfolioTenantIds?: string[] }} args
 */
export async function getAdoptionMyWork(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    const honesty = applyAdoptionReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      count: null,
      plans: [],
      honesty,
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      plans: [],
      honesty,
      reason: 'customer_adoption_plan_model_unavailable',
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
      count: null,
      plans: [],
      honesty,
      reason: scopeResult.reason,
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const ownerId = admin?.id ? String(admin.id) : '';
  if (!ownerId) {
    return {
      ok: true,
      status: ADOPTION_REPORT_STATUS.EMPTY,
      count: 0,
      plans: [],
      honesty: { inventZeroesForbidden: true, falseZeroes: false },
    };
  }

  try {
    const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
    const rows = await prisma.customerAdoptionPlan.findMany({
      where: {
        ...scopeWhere,
        OR: [{ csOwnerAdminId: ownerId }, { ownerAdminId: ownerId }],
      },
    });

    const mine = (rows || []).filter((r) => {
      // Column pins required — JSON-only ownership is not My Work
      return r.csOwnerAdminId === ownerId || r.ownerAdminId === ownerId;
    });

    return {
      ok: true,
      status:
        mine.length === 0
          ? ADOPTION_REPORT_STATUS.EMPTY
          : ADOPTION_REPORT_STATUS.READY,
      count: mine.length,
      plans: mine.map(serializeAdoptionPlan),
      honesty: {
        inventZeroesForbidden: true,
        falseZeroes: false,
        portfolioScoped: scopeResult.portfolioScoped,
      },
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: scopeResult.portfolioScoped, ownerScoped: true },
    };
  } catch {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      count: null,
      plans: [],
      honesty,
      reason: 'adoption_my_work_query_failed',
    };
  }
}
