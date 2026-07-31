/**
 * Onboarding metrics — Phase 17 Wave 4.
 * Reliability-gated; gate fail ≠ fabricated zero.
 * Portfolio-scoped for non–Super Admin (same fail-closed rules as list/search).
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
  gatedMetricCard,
  ONBOARDING_REPORT_STATUS,
} from './reliabilityGate.js';
import {
  resolveOnboardingListScope,
  tenantWhereFromScope,
} from './listScope.js';

export const ONBOARDING_METRIC_VERSION = 'cs-onboarding-metric-v1-2026-07-31';

function unavailableCards(honesty) {
  return {
    inProgress: gatedMetricCard({
      label: 'in_progress',
      counted: { ok: false, value: null },
      honesty,
    }),
    atRisk: gatedMetricCard({
      label: 'at_risk',
      counted: { ok: false, value: null },
      honesty,
    }),
    goLive: gatedMetricCard({
      label: 'go_live',
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
export async function getOnboardingMetric(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    const honesty = applyOnboardingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      value: null,
      honesty,
      definitionVersion: ONBOARDING_METRIC_VERSION,
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'customer_onboarding_project_model_unavailable',
      definitionVersion: ONBOARDING_METRIC_VERSION,
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
      value: null,
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ONBOARDING_METRIC_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const metric = String(args.metric || 'project_count').trim().toLowerCase();
  const where = { ...tenantWhereFromScope(scopeResult.tenantScope) };
  const counted = await safeOnboardingCount(() =>
    prisma.customerOnboardingProject.count({ where })
  );

  if (!counted.ok) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: honesty.status,
      value: null,
      honesty,
      reason: 'onboarding_metric_query_failed',
      definitionVersion: ONBOARDING_METRIC_VERSION,
      domain: getOnboardingDomainContract(),
    };
  }

  const honesty = applyOnboardingReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: ONBOARDING_REPORT_STATUS.READY,
    metric,
    value: counted.value,
    honesty: {
      ...honesty,
      reliability: 'AVAILABLE',
      portfolioScoped: scopeResult.portfolioScoped,
    },
    definitionVersion: ONBOARDING_METRIC_VERSION,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Overview queue cards — each value reliability-gated and portfolio-scoped.
 */
export async function getOnboardingOverviewCards(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canViewOnboarding(admin)) {
    const honesty = applyOnboardingReportHonesty({ permissionOk: false });
    return {
      ok: false,
      forbidden: true,
      status: honesty.status,
      cards: null,
      honesty,
    };
  }

  if (!hasCustomerOnboardingProjectModel(prisma)) {
    const honesty = applyOnboardingReportHonesty({ modelAvailable: false });
    return {
      ok: true,
      status: honesty.status,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: ONBOARDING_METRIC_VERSION,
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
      cards: unavailableCards(honesty),
      honesty,
      reason: scopeResult.reason,
      definitionVersion: ONBOARDING_METRIC_VERSION,
      domain: getOnboardingDomainContract(),
      meta: { portfolioScoped: true, failClosed: true },
    };
  }

  const scopeWhere = tenantWhereFromScope(scopeResult.tenantScope);
  const counts = await Promise.all([
    safeOnboardingCount(() =>
      prisma.customerOnboardingProject.count({
        where: { ...scopeWhere, status: 'IN_PROGRESS' },
      })
    ),
    safeOnboardingCount(() =>
      prisma.customerOnboardingProject.count({
        where: { ...scopeWhere, status: 'BLOCKED' },
      })
    ),
    safeOnboardingCount(() =>
      prisma.customerOnboardingProject.count({
        where: { ...scopeWhere, status: 'GO_LIVE_READINESS' },
      })
    ),
    safeOnboardingCount(() =>
      prisma.customerOnboardingProject.count({
        where: { ...scopeWhere, status: 'COMPLETED' },
      })
    ),
  ]);

  const anyFail = counts.some((c) => !c.ok);
  if (anyFail) {
    const honesty = applyOnboardingReportHonesty({
      modelAvailable: true,
      queryOk: false,
      permissionOk: true,
    });
    return {
      ok: true,
      status: ONBOARDING_REPORT_STATUS.UNAVAILABLE,
      cards: unavailableCards(honesty),
      honesty,
      definitionVersion: ONBOARDING_METRIC_VERSION,
      domain: getOnboardingDomainContract(),
    };
  }

  const honesty = applyOnboardingReportHonesty({
    modelAvailable: true,
    queryOk: true,
    permissionOk: true,
  });

  return {
    ok: true,
    status: ONBOARDING_REPORT_STATUS.READY,
    cards: {
      inProgress: gatedMetricCard({
        label: 'in_progress',
        counted: counts[0],
        honesty,
      }),
      atRisk: gatedMetricCard({
        label: 'at_risk',
        counted: counts[1],
        honesty,
      }),
      goLive: gatedMetricCard({
        label: 'go_live',
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
    definitionVersion: ONBOARDING_METRIC_VERSION,
    domain: getOnboardingDomainContract(),
  };
}
