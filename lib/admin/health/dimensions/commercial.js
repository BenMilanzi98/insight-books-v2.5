/**
 * Commercial health dimension — platform billing only (never Tenant Sale).
 */

import { loadTenantCommercial } from '@/lib/admin/customers/commercial.js';
import { INACTIVE_STATUSES } from '@/lib/admin/saasBillingKpis';
import { DIMENSION_CODES, DIMENSION_STATUS } from '../catalogue.js';

function isCancelledOrSuspendedStatus(status) {
  const s = String(status || '').toUpperCase();
  return (
    s.includes('SUSPEND') ||
    s === 'CANCELLED' ||
    s === 'CANCELED' ||
    s === 'RESTRICTED'
  );
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} tenantId
 * @param {{ now?: Date, currency?: string, commercial?: object }} [opts]
 */
export async function scoreCommercialDimension(prisma, tenantId, opts = {}) {
  const code = DIMENSION_CODES.COMMERCIAL;
  const baseWeight = opts.baseWeight ?? 0.35;

  let commercial = opts.commercial;
  if (!commercial) {
    try {
      commercial = await loadTenantCommercial(prisma, tenantId, {
        now: opts.now,
        currency: opts.currency || 'MWK',
      });
    } catch (e) {
      return {
        code,
        status: DIMENSION_STATUS.FAILED,
        score: null,
        baseWeight,
        effectiveWeight: 0,
        drivers: [],
        reason: e?.message || 'Commercial query threw',
      };
    }
  }

  if (!commercial?.ok) {
    const reasonCode = commercial?.reasonCode || 'query_failed';
    if (reasonCode === 'fx_unavailable') {
      return {
        code,
        status: DIMENSION_STATUS.UNAVAILABLE,
        score: null,
        baseWeight,
        effectiveWeight: 0,
        drivers: [],
        reason: commercial.message || 'FX unavailable',
        facts: { currency: commercial.currency },
      };
    }
    return {
      code,
      status: DIMENSION_STATUS.FAILED,
      score: null,
      baseWeight,
      effectiveWeight: 0,
      drivers: [],
      reason: commercial?.message || reasonCode,
    };
  }

  const sub = commercial.activeSubscription;
  const subStatus = sub?.status || commercial.subscriptionStatus;
  const outstanding = Number(commercial.outstanding) || 0;
  const mrr = Number(commercial.mrr) || 0;
  const drivers = [];
  let score = 90;

  if (isCancelledOrSuspendedStatus(subStatus) || isCancelledOrSuspendedStatus(opts.tenantStatus)) {
    score = 15;
    drivers.push({
      code: 'subscription_suspended_or_cancelled',
      impact: -75,
      detail: `Subscription/tenant status=${subStatus || opts.tenantStatus}`,
    });
  } else if (sub?.isTrial) {
    score = 72;
    drivers.push({ code: 'trial_subscription', impact: -18, detail: 'Active trial' });
  } else if (!sub || INACTIVE_STATUSES.includes(subStatus)) {
    score = 45;
    drivers.push({
      code: 'inactive_or_missing_subscription',
      impact: -45,
      detail: subStatus || 'no_primary_subscription',
    });
  } else {
    drivers.push({
      code: 'active_paid_subscription',
      impact: 0,
      detail: `plan=${commercial.plan || sub?.plan || 'unknown'}`,
    });
  }

  if (outstanding > 0) {
    const ratio = mrr > 0 ? outstanding / mrr : Infinity;
    let penalty = 20;
    if (ratio >= 3 || outstanding >= 50000) penalty = 55;
    else if (ratio >= 1 || outstanding >= 10000) penalty = 35;
    score = Math.max(10, score - penalty);
    drivers.push({
      code: 'platform_outstanding',
      impact: -penalty,
      detail: `outstanding=${outstanding} currency=${commercial.currency}`,
    });
  } else {
    drivers.push({
      code: 'no_platform_outstanding',
      impact: 5,
      detail: 'Platform outstanding is zero',
    });
    score = Math.min(100, score + 5);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    code,
    status: DIMENSION_STATUS.SCORED,
    score,
    baseWeight,
    effectiveWeight: 0,
    drivers,
    facts: {
      plan: commercial.plan,
      subscriptionStatus: subStatus,
      mrr,
      outstanding,
      currency: commercial.currency,
      hasOutstanding: outstanding > 0,
    },
  };
}
