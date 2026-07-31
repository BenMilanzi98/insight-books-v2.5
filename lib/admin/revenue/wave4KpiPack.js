/**
 * Wave 4 section KPI pack builders — cohorts, retention, concentration,
 * customers, segments, forecast, plans/subscriptions helpers + export.
 */

import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { AUTHZ_OUTCOMES } from '@/lib/admin/authorization/outcomes';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  METRIC_STATUS,
  metricEnvelope,
  unavailableMetric,
} from '@/lib/admin/intelligence/metricStates.js';
import { assertNoFalseZero } from '@/lib/admin/intelligence/executiveKpiPack.js';
import {
  REVENUE_CATALOGUE_VERSION,
  REVENUE_KPI_CODES,
  REVENUE_KPI_DEFINITIONS,
  getRevenueDefinition,
} from './metricCatalogue.js';
import { parseCurrencyOpt } from './billingConstants.js';
import { computeSubscriptionCohorts, computePlanPerformance } from './cohorts.js';
import { computeConcentration } from './concentration.js';
import { computeRenewalExposure, FORECAST_SCENARIO_MULTIPLIERS } from './forecast.js';
import { buildRevenueKpiPack } from './revenueKpiPack.js';
import {
  buildBillingAnalyticsPack,
  buildCollectionsAnalyticsPack,
} from './billingKpiPack.js';

function def(code) {
  return getRevenueDefinition(code);
}

function resolveFinanceAccess(admin, intelAllowed) {
  const finance = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.financialMetrics,
  });
  if (finance.outcome === AUTHZ_OUTCOMES.ALLOW || intelAllowed) {
    return { financeOk: true, financeMasked: false, finance };
  }
  if (finance.outcome === AUTHZ_OUTCOMES.ALLOW_MASKED) {
    return { financeOk: true, financeMasked: true, finance };
  }
  return { financeOk: false, financeMasked: false, finance };
}

function resolveAccess(admin) {
  const view = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,
  });
  const intel = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,
  });
  const canView = view.allowed || intel.allowed;
  const { financeOk, financeMasked } = resolveFinanceAccess(admin, intel.allowed);
  const tenantsView = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.tenants.view,
  });
  return {
    canView,
    financeOk,
    financeMasked,
    canViewTenantNames: tenantsView.allowed === true,
    view,
    intel,
  };
}

function forbidFinance(code) {
  return unavailableMetric(code, 'Insufficient finance metric permission', {
    status: METRIC_STATUS.FORBIDDEN,
    reasonCode: 'forbidden',
    label: def(code).label,
    definition: def(code).definition,
  });
}

function fxUnavailable(code, message) {
  return unavailableMetric(code, message, {
    status: METRIC_STATUS.UNAVAILABLE,
    reasonCode: 'fx_unavailable',
    label: def(code).label,
    definition: def(code).definition,
    source: def(code).source,
  });
}

function queryUnavailable(code, message, reasonCode = 'query_failed') {
  return unavailableMetric(code, message, {
    status: METRIC_STATUS.UNAVAILABLE,
    reasonCode,
    label: def(code).label,
    definition: def(code).definition,
    source: def(code).source,
  });
}

function notSupported(code, message) {
  return unavailableMetric(code, message, {
    status: METRIC_STATUS.NOT_SUPPORTED,
    reasonCode: 'not_supported',
    label: def(code).label,
    definition: def(code).definition,
    source: def(code).source,
  });
}

function readyMoney(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: 'money',
    currency: extras.currency || 'MWK',
    label: d.label,
    definition: d.definition,
    source: d.source,
    period: extras.period,
    freshness: extras.freshness,
    limitations: extras.limitations || d.definition,
    masked: Boolean(extras.masked),
  });
}

function readyRatio(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: 'ratio',
    label: d.label,
    definition: d.definition,
    source: d.source,
    period: extras.period,
    freshness: extras.freshness,
    limitations: extras.limitations || null,
  });
}

function readyObject(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: extras.unit || null,
    currency: extras.currency || null,
    label: d.label,
    definition: d.definition,
    source: d.source,
    period: extras.period,
    freshness: extras.freshness,
    limitations: extras.limitations || d.definition,
    masked: Boolean(extras.masked),
  });
}

function baseOpts(opts = {}) {
  const now = opts.now || new Date();
  const periodEnd = opts.periodEnd || now;
  const periodStart =
    opts.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  const days = Math.round((periodEnd - periodStart) / 864e5) || 30;
  return {
    admin: opts.admin,
    now,
    periodStart,
    periodEnd,
    isCrossCurrency,
    defaultCurrency,
    days,
    horizonDays: opts.horizonDays || Math.min(Math.max(days, 1), 365),
    monthsBack: opts.monthsBack || 6,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    freshnessLive: { asOf: now.toISOString(), status: 'LIVE_QUERY' },
  };
}

function packShell({ section, access, base, metrics, extras = {} }) {
  return {
    ok: true,
    forbidden: false,
    section,
    catalogueVersion: REVENUE_CATALOGUE_VERSION,
    currency: base.isCrossCurrency ? 'ALL' : base.defaultCurrency,
    period: base.period,
    generatedAt: base.now.toISOString(),
    metrics,
    authz: {
      finance: access.financeOk,
      masked: access.financeMasked,
      intelRevenue: access.intel.allowed,
      dashboardView: access.view.allowed,
      tenantsView: access.canViewTenantNames,
    },
    sources: {
      commercial: 'platform_billing',
      excludes: ['TenantSale', 'tenant_gl', 'tenant_pnl', 'fiscal_eis_invoice'],
    },
    ...extras,
  };
}

function forbiddenPack(section) {
  return {
    ok: false,
    forbidden: true,
    section,
    catalogueVersion: REVENUE_CATALOGUE_VERSION,
    metrics: {},
  };
}

const FX_MSG =
  'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.';

function firstAge1Rate(cohorts, kind) {
  if (!cohorts?.length) return null;
  // Prefer most recent cohort with a completed age-1 observation
  for (let i = cohorts.length - 1; i >= 0; i -= 1) {
    const series =
      kind === 'mrr' ? cohorts[i].retentionByMrr : cohorts[i].retentionByCount;
    const age1 = series?.find((r) => r.ageMonths === 1);
    if (age1 && age1.rate != null) return age1.rate;
  }
  // Fall back to age 0 (always 1.0 if populated)
  for (let i = cohorts.length - 1; i >= 0; i -= 1) {
    const series =
      kind === 'mrr' ? cohorts[i].retentionByMrr : cohorts[i].retentionByCount;
    const age0 = series?.find((r) => r.ageMonths === 0);
    if (age0 && age0.rate != null) return age0.rate;
  }
  return null;
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildCohortsAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('cohorts');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.COHORT_RETENTION_COUNT,
    REVENUE_KPI_CODES.COHORT_RETENTION_MRR,
    REVENUE_KPI_CODES.COHORT_MATRIX,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'cohorts', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'cohorts', access, base, metrics });
  }

  const result = await computeSubscriptionCohorts(prisma, {
    currency: base.defaultCurrency,
    now: base.now,
    monthsBack: base.monthsBack,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
    return packShell({
      section: 'cohorts',
      access,
      base,
      metrics,
      extras: { confidence: result.confidence, gaps: result.gaps || null },
    });
  }

  const status =
    result.confidence === 'MIXED'
      ? METRIC_STATUS.READY_WITH_LIMITATIONS
      : METRIC_STATUS.READY_WITH_LIMITATIONS;
  const countRate = firstAge1Rate(result.cohorts, 'count');
  const mrrRate = firstAge1Rate(result.cohorts, 'mrr');

  if (countRate == null) {
    metrics[REVENUE_KPI_CODES.COHORT_RETENTION_COUNT] = queryUnavailable(
      REVENUE_KPI_CODES.COHORT_RETENTION_COUNT,
      'No completed retention observation in cohort window',
      'thin_history'
    );
  } else {
    metrics[REVENUE_KPI_CODES.COHORT_RETENTION_COUNT] = readyRatio(
      REVENUE_KPI_CODES.COHORT_RETENTION_COUNT,
      countRate,
      {
        period: base.period,
        freshness: base.freshnessLive,
        status,
        limitations: result.limitations,
      }
    );
  }

  if (mrrRate == null) {
    metrics[REVENUE_KPI_CODES.COHORT_RETENTION_MRR] = queryUnavailable(
      REVENUE_KPI_CODES.COHORT_RETENTION_MRR,
      'No completed MRR retention observation in cohort window',
      'thin_history'
    );
  } else {
    metrics[REVENUE_KPI_CODES.COHORT_RETENTION_MRR] = readyRatio(
      REVENUE_KPI_CODES.COHORT_RETENTION_MRR,
      mrrRate,
      {
        period: base.period,
        freshness: base.freshnessLive,
        status,
        limitations: result.limitations,
      }
    );
  }

  metrics[REVENUE_KPI_CODES.COHORT_MATRIX] = readyObject(
    REVENUE_KPI_CODES.COHORT_MATRIX,
    {
      cohorts: result.cohorts,
      retention: result.retention,
      confidence: result.confidence,
    },
    {
      period: base.period,
      freshness: base.freshnessLive,
      status,
      limitations: result.limitations,
      currency: result.currency,
    }
  );

  return packShell({
    section: 'cohorts',
    access,
    base,
    metrics,
    extras: {
      confidence: result.confidence,
      cohorts: result.cohorts,
      retention: result.retention,
    },
  });
}

/** Retention aliases cohorts retention metrics. */
export async function buildRetentionAnalyticsPack(prisma, opts = {}) {
  const pack = await buildCohortsAnalyticsPack(prisma, opts);
  if (pack.forbidden) return { ...pack, section: 'retention' };
  return { ...pack, section: 'retention' };
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildConcentrationAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('concentration');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.CONCENTRATION_HHI,
    REVENUE_KPI_CODES.CONCENTRATION_TOP10_SHARE,
    REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'concentration', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'concentration', access, base, metrics });
  }

  const result = await computeConcentration(prisma, {
    currency: base.defaultCurrency,
    now: base.now,
    topN: 10,
    canViewTenantNames: access.canViewTenantNames,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
    return packShell({ section: 'concentration', access, base, metrics });
  }

  const top = result.topContributors?.[0];
  metrics[REVENUE_KPI_CODES.CONCENTRATION_HHI] = readyRatio(
    REVENUE_KPI_CODES.CONCENTRATION_HHI,
    result.ranking.hhi,
    {
      period: base.period,
      freshness: base.freshnessLive,
      limitations: result.limitations,
    }
  );
  metrics[REVENUE_KPI_CODES.CONCENTRATION_TOP10_SHARE] = readyRatio(
    REVENUE_KPI_CODES.CONCENTRATION_TOP10_SHARE,
    result.ranking.topNShare,
    {
      period: base.period,
      freshness: base.freshnessLive,
      limitations: result.limitations,
    }
  );
  if (top) {
    metrics[REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR] = readyMoney(
      REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR,
      top.mrr,
      {
        currency: result.currency,
        period: base.period,
        freshness: base.freshnessLive,
        masked: access.financeMasked || top.masked,
        limitations: result.limitations,
      }
    );
  } else {
    metrics[REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR] = queryUnavailable(
      REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR,
      'No active paid tenants in currency bucket',
      'empty'
    );
  }

  return packShell({
    section: 'concentration',
    access,
    base,
    metrics,
    extras: {
      ranking: result.ranking,
      topContributors: result.topContributors,
    },
  });
}

/** Customers = top contributors from concentration. */
export async function buildCustomersAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('customers');
  const base = baseOpts(opts);
  const metrics = {};
  const code = REVENUE_KPI_CODES.CUSTOMERS_TOP_CONTRIBUTORS;

  if (!access.financeOk) {
    metrics[code] = forbidFinance(code);
    return packShell({ section: 'customers', access, base, metrics });
  }
  if (base.isCrossCurrency) {
    metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'customers', access, base, metrics });
  }

  const result = await computeConcentration(prisma, {
    currency: base.defaultCurrency,
    now: base.now,
    topN: 25,
    canViewTenantNames: access.canViewTenantNames,
  });

  if (!result.ok) {
    metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    return packShell({ section: 'customers', access, base, metrics });
  }

  metrics[code] = readyObject(
    code,
    {
      topContributors: result.topContributors,
      ranking: result.ranking,
    },
    {
      currency: result.currency,
      period: base.period,
      freshness: base.freshnessLive,
      masked: !access.canViewTenantNames,
      limitations: result.limitations,
    }
  );

  // Also surface concentration headline metrics
  const conc = await buildConcentrationAnalyticsPack(prisma, opts);
  if (!conc.forbidden && conc.metrics) {
    Object.assign(metrics, {
      [REVENUE_KPI_CODES.CONCENTRATION_HHI]:
        conc.metrics[REVENUE_KPI_CODES.CONCENTRATION_HHI],
      [REVENUE_KPI_CODES.CONCENTRATION_TOP10_SHARE]:
        conc.metrics[REVENUE_KPI_CODES.CONCENTRATION_TOP10_SHARE],
      [REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR]:
        conc.metrics[REVENUE_KPI_CODES.CONCENTRATION_TOP_MRR],
    });
  }

  return packShell({
    section: 'customers',
    access,
    base,
    metrics,
    extras: { topContributors: result.topContributors, ranking: result.ranking },
  });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildSegmentsAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('segments');
  const base = baseOpts(opts);
  const metrics = {
    [REVENUE_KPI_CODES.SEGMENT_INDUSTRY]: notSupported(
      REVENUE_KPI_CODES.SEGMENT_INDUSTRY,
      'Industry dimension NOT_SUPPORTED — not instrumented on platform tenants.'
    ),
    [REVENUE_KPI_CODES.SEGMENT_REGION]: notSupported(
      REVENUE_KPI_CODES.SEGMENT_REGION,
      'Region dimension NOT_SUPPORTED — not instrumented on platform tenants.'
    ),
    [REVENUE_KPI_CODES.SEGMENT_ACQUISITION]: notSupported(
      REVENUE_KPI_CODES.SEGMENT_ACQUISITION,
      'Acquisition channel NOT_SUPPORTED — not instrumented on platform tenants.'
    ),
  };

  if (!access.financeOk) {
    metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT] = forbidFinance(
      REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT
    );
    return packShell({ section: 'segments', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT] = fxUnavailable(
      REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT,
      FX_MSG
    );
    return packShell({ section: 'segments', access, base, metrics });
  }

  const planResult = await computePlanPerformance(prisma, {
    currency: base.defaultCurrency,
    now: base.now,
  });

  if (!planResult.ok) {
    metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT] = queryUnavailable(
      REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT,
      planResult.message,
      planResult.reasonCode
    );
  } else {
    const total = (planResult.plans || []).reduce((a, p) => a + p.estimatedMrr, 0);
    metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT] = readyObject(
      REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT,
      { plans: planResult.plans, totalEstimatedMrr: total },
      {
        currency: planResult.currency,
        period: base.period,
        freshness: base.freshnessLive,
        masked: access.financeMasked,
        limitations: planResult.limitations,
        unit: 'money',
      }
    );
  }

  return packShell({
    section: 'segments',
    access,
    base,
    metrics,
    extras: { plans: planResult.ok ? planResult.plans : null },
  });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildForecastAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('forecast');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.FORECAST_RENEWAL_EXPOSURE,
    REVENUE_KPI_CODES.FORECAST_SCENARIO_BASE,
    REVENUE_KPI_CODES.FORECAST_SCENARIO_CONSERVATIVE,
    REVENUE_KPI_CODES.FORECAST_SCENARIO_OPTIMISTIC,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({
      section: 'forecast',
      access,
      base,
      metrics,
      extras: { multipliers: FORECAST_SCENARIO_MULTIPLIERS, label: 'deterministic renewal exposure' },
    });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({
      section: 'forecast',
      access,
      base,
      metrics,
      extras: { multipliers: FORECAST_SCENARIO_MULTIPLIERS, label: 'deterministic renewal exposure' },
    });
  }

  const result = await computeRenewalExposure(prisma, {
    currency: base.defaultCurrency,
    horizonDays: base.horizonDays,
    now: base.now,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
    return packShell({
      section: 'forecast',
      access,
      base,
      metrics,
      extras: { multipliers: FORECAST_SCENARIO_MULTIPLIERS, label: result.label },
    });
  }

  const moneyExtras = {
    currency: result.currency,
    period: {
      start: base.now.toISOString(),
      end: result.horizonEnd,
    },
    freshness: base.freshnessLive,
    masked: access.financeMasked,
    limitations: result.limitations,
  };

  metrics[REVENUE_KPI_CODES.FORECAST_RENEWAL_EXPOSURE] = readyMoney(
    REVENUE_KPI_CODES.FORECAST_RENEWAL_EXPOSURE,
    result.exposureMrr,
    moneyExtras
  );
  metrics[REVENUE_KPI_CODES.FORECAST_SCENARIO_BASE] = readyMoney(
    REVENUE_KPI_CODES.FORECAST_SCENARIO_BASE,
    result.scenarios.base,
    moneyExtras
  );
  metrics[REVENUE_KPI_CODES.FORECAST_SCENARIO_CONSERVATIVE] = readyMoney(
    REVENUE_KPI_CODES.FORECAST_SCENARIO_CONSERVATIVE,
    result.scenarios.conservative,
    moneyExtras
  );
  metrics[REVENUE_KPI_CODES.FORECAST_SCENARIO_OPTIMISTIC] = readyMoney(
    REVENUE_KPI_CODES.FORECAST_SCENARIO_OPTIMISTIC,
    result.scenarios.optimistic,
    moneyExtras
  );

  return packShell({
    section: 'forecast',
    access,
    base,
    metrics,
    extras: {
      label: result.label,
      multipliers: result.multipliers,
      horizonDays: result.horizonDays,
      subscriptionCount: result.subscriptionCount,
      scenarios: result.scenarios,
    },
  });
}

/** Plans section — plan performance group-by. */
export async function buildPlansAnalyticsPack(prisma, opts = {}) {
  const pack = await buildSegmentsAnalyticsPack(prisma, opts);
  if (pack.forbidden) return { ...pack, section: 'plans' };
  const metrics = {};
  if (pack.metrics?.[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT]) {
    metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT] =
      pack.metrics[REVENUE_KPI_CODES.SEGMENT_PLAN_SPLIT];
  }
  return {
    ...pack,
    section: 'plans',
    metrics,
  };
}

/** Subscriptions — active counts from revenue overview pack (recurring signals). */
export async function buildSubscriptionsAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('subscriptions');
  const overview = await buildRevenueKpiPack(prisma, opts);
  if (overview.forbidden) return forbiddenPack('subscriptions');
  const codes = [
    REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE,
    REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID,
    REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,
  ];
  const metrics = {};
  for (const code of codes) {
    if (overview.metrics?.[code]) metrics[code] = overview.metrics[code];
  }
  return packShell({
    section: 'subscriptions',
    access,
    base: baseOpts(opts),
    metrics,
  });
}

/**
 * Definitions catalogue payload (no auth beyond route).
 */
export function buildRevenueDefinitionsPayload() {
  return {
    ok: true,
    catalogueVersion: REVENUE_CATALOGUE_VERSION,
    definitions: REVENUE_KPI_DEFINITIONS,
    forecastMultipliers: FORECAST_SCENARIO_MULTIPLIERS,
    forecastLabel: 'deterministic renewal exposure',
    notes: [
      'Platform billing only — Tenant Sale / tenant GL never included.',
      'Money metrics require a single currency; ALL → UNAVAILABLE (no FX).',
      'Cohorts require reconstruct confidence HIGH or MIXED over the window.',
      'Forecast scenarios are documented multipliers (0.9 / 1.0 / 1.1), not ML.',
    ],
  };
}

/**
 * Read-only workbench settings.
 */
export function buildRevenueSettingsPayload() {
  return {
    ok: true,
    readOnly: true,
    config: {
      defaultCurrency: 'MWK',
      fxAvailable: false,
      fxStatus: 'UNAVAILABLE',
      supportedCurrencies: ['MWK', 'USD', 'ZAR', 'EUR'],
      forecastMultipliers: FORECAST_SCENARIO_MULTIPLIERS,
      forecastLabel: 'deterministic renewal exposure',
      commercialSource: 'platform_billing',
      excludes: ['TenantSale', 'tenant_gl', 'tenant_pnl', 'fiscal_eis_invoice'],
    },
    message: 'Revenue workbench settings are read-only in Phase 6 Wave 4.',
  };
}

/**
 * Merge overview + key Wave 4 packs for export.
 * @param {import('@prisma/client').PrismaClient} prisma
 */
export async function buildRevenueExportPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, metrics: {}, catalogueVersion: REVENUE_CATALOGUE_VERSION };
  }

  const [overview, forecast, concentration, billing, collections] = await Promise.all([
    buildRevenueKpiPack(prisma, opts),
    buildForecastAnalyticsPack(prisma, opts),
    buildConcentrationAnalyticsPack(prisma, opts),
    buildBillingAnalyticsPack(prisma, opts),
    buildCollectionsAnalyticsPack(prisma, opts),
  ]);

  const metrics = {
    ...(overview.metrics || {}),
    ...(forecast.metrics || {}),
    ...(concentration.metrics || {}),
    ...(billing.metrics || {}),
    ...(collections.metrics || {}),
  };

  return {
    ok: true,
    forbidden: false,
    catalogueVersion: REVENUE_CATALOGUE_VERSION,
    currency: overview.currency || baseOpts(opts).defaultCurrency,
    period: overview.period || baseOpts(opts).period,
    generatedAt: new Date().toISOString(),
    metrics,
    attention: overview.attention || [],
    sources: {
      commercial: 'platform_billing',
      excludes: ['TenantSale', 'tenant_gl', 'tenant_pnl', 'fiscal_eis_invoice'],
    },
    sections: ['overview', 'forecast', 'concentration', 'billing', 'collections'],
  };
}

/**
 * Format export pack as CSV lines.
 */
export function formatRevenueExportCsv(pack) {
  const lines = ['code,status,value,unit,currency,reason'];
  for (const m of Object.values(pack.metrics || {})) {
    const value =
      m.value == null || typeof m.value === 'object' ? '' : m.value;
    lines.push(
      [
        m.code,
        m.status,
        value,
        m.unit || '',
        m.currency || '',
        m.reasonMessage || '',
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(',')
    );
  }
  return lines.join('\n');
}

export { assertNoFalseZero, FORECAST_SCENARIO_MULTIPLIERS };
