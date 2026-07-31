/**
 * Adoption metrics — Phase 19 Wave 4.
 * Reliability-gated; gate fail ≠ fabricated zero.
 * Portfolio-scoped for non–Super Admin (same fail-closed rules as list/search).
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
  gatedMetricCard,
  ADOPTION_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveAdoptionListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const ADOPTION_METRIC_VERSION = 'cs-adoption-metric-v1-2026-07-31';

function unavailableCards(honesty) {
  return {
    active: gatedMetricCard({
      label: 'active',
      counted: { ok: false, value: null },
      honesty,
    }),
    atRisk: gatedMetricCard({
      label: 'at_risk',
      counted: { ok: false, value: null },
      honesty,
    }),
    valueReview: gatedMetricCard({
      label: 'value_review',
      counted: { ok: false, value: null },
      honesty,
    }),
    completed: gatedMetricCard({
      label: 'completed',
      counted: { ok: false, value: null },
      honesty,
    }),
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin?: object, actorContext?: object, metric?: string, portfolioTenantIds?: string[] }} args
 */
export async function getAdoptionMetric(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    const honesty = applyAdoptionReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      value: null,
      honesty,
      definitionVersion: ADOPTION_METRIC_VERSION,
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'customer_adoption_plan_model_unavailable',
      definitionVersion: ADOPTION_METRIC_VERSION,
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
      value: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ADOPTION_METRIC_VERSION,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const metric = String(args.metric || 'plan_count').trim().toLowerCase();
  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const counted = await safeAdoptionCount(() =>
    prisma.customerAdoptionPlan.count({ where })
  );

  if (!counted.ok) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'adoption_metric_query_failed',
      definitionVersion: ADOPTION_METRIC_VERSION,
      domain: getAdoptionDomainContract(),
    };
  }

  const honesty = applyAdoptionReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: ADOPTION_REPORT_STATUS.READY,
    metric,
    value: counted.value,
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    definitionVersion: ADOPTION_METRIC_VERSION,
    domain: getAdoptionDomainContract(),
  };
}

/**
 * Overview queue cards — each value reliability-gated and portfolio-scoped.
 */
export async function getAdoptionOverviewCards(prisma, args = {}) {
  const admin = resolveAdoptionActor(args);
  if (!canViewAdoption(admin)) {
    const honesty = applyAdoptionReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      cards: null,
      honesty,
    };
  }

  if (!hasCustomerAdoptionPlanModel(prisma)) {
    const honesty = applyAdoptionReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: ADOPTION_METRIC_VERSION,
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
      cards: unavailableCards(honesty),
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ADOPTION_METRIC_VERSION,
      domain: getAdoptionDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const counts = await Promise.all([
    safeAdoptionCount(() =>
      prisma.customerAdoptionPlan.count({
        where: { ...scopeWhere, status: 'ACTIVE' },
      })
    ),
    safeAdoptionCount(() =>
      prisma.customerAdoptionPlan.count({
        where: { ...scopeWhere, status: 'AT_RISK' },
      })
    ),
    safeAdoptionCount(() =>
      prisma.customerAdoptionPlan.count({
        where: { ...scopeWhere, status: 'VALUE_REVIEW' },
      })
    ),
    safeAdoptionCount(() =>
      prisma.customerAdoptionPlan.count({
        where: { ...scopeWhere, status: 'COMPLETED' },
      })
    ),
  ]);

  const anyFail = counts.some((c) => !c.ok);
  if (anyFail) {
    const honesty = applyAdoptionReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: ADOPTION_REPORT_STATUS.UNAVAILABLE,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: ADOPTION_METRIC_VERSION,
      domain: getAdoptionDomainContract(),
    };
  }

  const honesty = applyAdoptionReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: ADOPTION_REPORT_STATUS.READY,
    cards: {
      active: gatedMetricCard({
        label: 'active',
        counted: counts[0],
        honesty,
      }),
      atRisk: gatedMetricCard({
        label: 'at_risk',
        counted: counts[1],
        honesty,
      }),
      valueReview: gatedMetricCard({
        label: 'value_review',
        counted: counts[2],
        honesty,
      }),
      completed: gatedMetricCard({
        label: 'completed',
        counted: counts[3],
        honesty,
      }),
    },
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    definitionVersion: ADOPTION_METRIC_VERSION,
    domain: getAdoptionDomainContract(),
  };
}
