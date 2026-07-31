/**
 * MRA EIS entitlement + commercial plan category summary (not fiscal EISInvoice).
 */

import { categoryForPlanCode, PLAN_CATEGORY } from '@/lib/admin/mraEisPlans';
import { CUSTOMER_READINESS } from './catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ subscriptions?: Array<{ plan?: string, isActive?: boolean }> }} [opts]
 */
export async function loadMraEisSummary(prisma, tenantId, opts = {}) {
  if (!tenantId) {
    return {
      ok: false,
      entitlementStatus: null,
      commercialPlan: null,
      operationalReadiness: null,
      planCategory: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: 'tenantId required',
    };
  }

  try {
    let entitlement = null;
    if (typeof prisma.mraEisTenantEntitlement?.findFirst === 'function') {
      entitlement = await prisma.mraEisTenantEntitlement.findFirst({
        where: { tenantId, isCurrent: true },
        orderBy: { version: 'desc' },
        select: {
          status: true,
          allowedEnvironment: true,
          sandboxAllowed: true,
          productionAllowed: true,
          entitlementSource: true,
          effectiveFrom: true,
          effectiveUntil: true,
          isCurrent: true,
        },
      });
    }

    const subs = opts.subscriptions || [];
    const eisPlan =
      subs.find((s) => s?.isActive && categoryForPlanCode(s.plan) === PLAN_CATEGORY.MRA_EIS) ||
      subs.find((s) => categoryForPlanCode(s.plan) === PLAN_CATEGORY.MRA_EIS) ||
      null;

    const commercialPlan = eisPlan?.plan || null;
    const planCategory = commercialPlan
      ? PLAN_CATEGORY.MRA_EIS
      : entitlement
        ? PLAN_CATEGORY.MRA_EIS
        : null;

    let operationalReadiness = null;
    if (entitlement) {
      const status = String(entitlement.status || '').toUpperCase();
      if (entitlement.productionAllowed && status === 'ACTIVE') {
        operationalReadiness = 'PRODUCTION_ALLOWED';
      } else if (entitlement.sandboxAllowed) {
        operationalReadiness = 'SANDBOX_ALLOWED';
      } else {
        operationalReadiness = status || 'UNKNOWN';
      }
    }

    return {
      ok: true,
      entitlementStatus: entitlement?.status || null,
      commercialPlan,
      operationalReadiness,
      planCategory,
      entitlement: entitlement || null,
      status: CUSTOMER_READINESS.READY_WITH_LIMITATIONS,
      limitations:
        'Entitlement from MraEisTenantEntitlement (isCurrent); commercial plan from AccountSubscription category. Fiscal EISInvoice volumes are out of scope for this section.',
    };
  } catch (e) {
    return {
      ok: false,
      entitlementStatus: null,
      commercialPlan: null,
      operationalReadiness: null,
      planCategory: null,
      status: CUSTOMER_READINESS.UNAVAILABLE,
      reason: e?.message || 'MRA EIS query failed',
    };
  }
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ subscriptions?: object[] }} [opts]
 */
export async function buildMraEisSection(prisma, tenantId, opts = {}) {
  const data = await loadMraEisSummary(prisma, tenantId, opts);
  return {
    entitlementStatus: data.entitlementStatus,
    commercialPlan: data.commercialPlan,
    operationalReadiness: data.operationalReadiness,
    planCategory: data.planCategory ?? null,
    status: data.status,
    reason: data.reason || null,
    limitations: data.limitations || null,
  };
}
