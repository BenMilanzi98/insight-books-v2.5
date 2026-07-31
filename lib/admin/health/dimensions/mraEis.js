/**
 * MRA EIS health dimension — N/A when tenant is not EIS-eligible.
 */

import { loadMraEisSummary } from '@/lib/admin/customers/mraEis.js';
import { categoryForPlanCode, PLAN_CATEGORY } from '@/lib/admin/mraEisPlans';
import { DIMENSION_CODES, DIMENSION_STATUS } from '../catalogue.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, subscriptions?: object[], mraEis?: object, baseWeight?: number }} [opts]
 */
export async function scoreMraEisDimension(prisma, tenantId, opts = {}) {
  const code = DIMENSION_CODES.MRA_EIS;
  const baseWeight = opts.baseWeight ?? 0.2;
  const subs = opts.subscriptions || [];

  let mraEis = opts.mraEis;
  if (!mraEis) {
    try {
      mraEis = await loadMraEisSummary(prisma, tenantId, { subscriptions: subs });
    } catch (e) {
      return {
        code,
        status: DIMENSION_STATUS.FAILED,
        score: null,
        baseWeight,
        effectiveWeight: 0,
        drivers: [],
        reason: e?.message || 'MRA EIS query threw',
      };
    }
  }

  if (!mraEis?.ok) {
    return {
      code,
      status: DIMENSION_STATUS.FAILED,
      score: null,
      baseWeight,
      effectiveWeight: 0,
      drivers: [],
      reason: mraEis?.reason || 'MRA EIS unavailable',
    };
  }

  const hasEisPlan = subs.some(
    (s) => categoryForPlanCode(s?.plan) === PLAN_CATEGORY.MRA_EIS
  );
  const hasEntitlement = Boolean(mraEis.entitlement || mraEis.entitlementStatus);
  const eisDependent = hasEisPlan || hasEntitlement;

  if (!eisDependent) {
    return {
      code,
      status: DIMENSION_STATUS.NOT_APPLICABLE,
      score: null,
      baseWeight,
      effectiveWeight: 0,
      drivers: [
        {
          code: 'not_eis_eligible',
          impact: 0,
          detail: 'No MRA EIS commercial plan or entitlement — excluded + renormalise',
        },
      ],
      facts: {
        entitlementStatus: null,
        commercialPlan: null,
        eisDependent: false,
      },
    };
  }

  const status = String(mraEis.entitlementStatus || '').toUpperCase();
  const drivers = [];
  let score = 50;

  if (status === 'REVOKED' || status === 'REVOKED_PENDING') {
    score = 5;
    drivers.push({
      code: 'eis_entitlement_revoked',
      impact: -95,
      detail: `entitlementStatus=${status}`,
    });
  } else if (status === 'ACTIVE' && mraEis.operationalReadiness === 'PRODUCTION_ALLOWED') {
    score = 95;
    drivers.push({
      code: 'eis_production_active',
      impact: 0,
      detail: 'ACTIVE + production allowed',
    });
  } else if (status === 'ACTIVE') {
    score = 78;
    drivers.push({
      code: 'eis_active_sandbox_or_limited',
      impact: -17,
      detail: mraEis.operationalReadiness || 'ACTIVE',
    });
  } else if (
    status.includes('PENDING') ||
    status === 'DRAFT' ||
    status === 'INACTIVE' ||
    !status
  ) {
    score = 40;
    drivers.push({
      code: 'eis_pending_or_incomplete',
      impact: -55,
      detail: status || 'missing_entitlement_with_eis_plan',
    });
  } else {
    score = 55;
    drivers.push({
      code: 'eis_status_other',
      impact: -40,
      detail: status,
    });
  }

  return {
    code,
    status: DIMENSION_STATUS.SCORED,
    score,
    baseWeight,
    effectiveWeight: 0,
    drivers,
    facts: {
      entitlementStatus: mraEis.entitlementStatus,
      commercialPlan: mraEis.commercialPlan,
      operationalReadiness: mraEis.operationalReadiness,
      eisDependent: true,
      revoked: status === 'REVOKED' || status === 'REVOKED_PENDING',
    },
  };
}
