/**
 * Wave 3 section KPI pack builders — billing, collections, receivables,
 * payment performance, credits/refunds, MRA EIS commercial.
 * Auth aligned with buildRevenueKpiPack.
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
  getRevenueDefinition,
} from './metricCatalogue.js';
import { parseCurrencyOpt } from './billingConstants.js';
import { computeBilledPeriod } from './billingAnalytics.js';
import { computeCollectedPeriod } from './collectionsAnalytics.js';
import {
  computeReceivablesAgeing,
  AGEING_DUE_FIELD_DOC,
} from './receivablesAgeing.js';
import {
  computePaymentPerformance,
  retryAnalyticsUnavailable,
} from './paymentPerformance.js';
import { computeCreditsRefunds } from './creditsRefundsAnalytics.js';
import { computeMraEisCommercial } from './mraEisCommercial.js';

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
  return { canView, financeOk, financeMasked, view, intel };
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

function readyCount(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.status || METRIC_STATUS.READY_WITH_LIMITATIONS,
    value,
    unit: 'count',
    label: d.label,
    definition: d.definition,
    source: d.source,
    period: extras.period,
    freshness: extras.freshness,
    limitations: extras.limitations || null,
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

function baseOpts(opts = {}) {
  const now = opts.now || new Date();
  const periodEnd = opts.periodEnd || now;
  const periodStart =
    opts.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
  const { isCrossCurrency, defaultCurrency } = parseCurrencyOpt(opts.currency);
  return {
    admin: opts.admin,
    now,
    periodStart,
    periodEnd,
    isCrossCurrency,
    defaultCurrency,
    period: {
      start: periodStart.toISOString(),
      end: periodEnd.toISOString(),
    },
    freshnessLive: { asOf: now.toISOString(), status: 'LIVE_QUERY' },
  };
}

function packShell({ section, access, base, metrics }) {
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
    },
    sources: {
      commercial: 'platform_billing',
      excludes: ['TenantSale', 'tenant_gl', 'tenant_pnl', 'fiscal_eis_invoice'],
    },
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

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildBillingAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('billing');
  const base = baseOpts(opts);
  const metrics = {};
  const moneyCodes = [
    REVENUE_KPI_CODES.BILLED_PERIOD,
    REVENUE_KPI_CODES.BILLED_INVOICE_COUNT,
  ];

  if (!access.financeOk) {
    for (const code of moneyCodes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'billing', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    metrics[REVENUE_KPI_CODES.BILLED_PERIOD] = fxUnavailable(
      REVENUE_KPI_CODES.BILLED_PERIOD,
      FX_MSG
    );
    metrics[REVENUE_KPI_CODES.BILLED_INVOICE_COUNT] = fxUnavailable(
      REVENUE_KPI_CODES.BILLED_INVOICE_COUNT,
      FX_MSG
    );
    return packShell({ section: 'billing', access, base, metrics });
  }

  const result = await computeBilledPeriod(prisma, {
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    currency: base.defaultCurrency,
  });

  if (!result.ok) {
    metrics[REVENUE_KPI_CODES.BILLED_PERIOD] = queryUnavailable(
      REVENUE_KPI_CODES.BILLED_PERIOD,
      result.message,
      result.reasonCode
    );
    metrics[REVENUE_KPI_CODES.BILLED_INVOICE_COUNT] = queryUnavailable(
      REVENUE_KPI_CODES.BILLED_INVOICE_COUNT,
      result.message,
      result.reasonCode
    );
  } else {
    metrics[REVENUE_KPI_CODES.BILLED_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.BILLED_PERIOD,
      result.billedTotal,
      {
        currency: result.currency,
        period: base.period,
        freshness: base.freshnessLive,
        masked: access.financeMasked,
        limitations: result.limitations,
      }
    );
    metrics[REVENUE_KPI_CODES.BILLED_INVOICE_COUNT] = readyCount(
      REVENUE_KPI_CODES.BILLED_INVOICE_COUNT,
      result.invoiceCount,
      { period: base.period, freshness: base.freshnessLive }
    );
  }

  return packShell({ section: 'billing', access, base, metrics });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildCollectionsAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('collections');
  const base = baseOpts(opts);
  const metrics = {};
  const moneyCodes = [
    REVENUE_KPI_CODES.COLLECTED_PERIOD,
    REVENUE_KPI_CODES.COLLECTED_PAYMENT_COUNT,
    REVENUE_KPI_CODES.PAYMENTS_PERIOD,
  ];

  if (!access.financeOk) {
    for (const code of moneyCodes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'collections', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of moneyCodes) {
      metrics[code] = fxUnavailable(code, FX_MSG);
    }
    return packShell({ section: 'collections', access, base, metrics });
  }

  const result = await computeCollectedPeriod(prisma, {
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    currency: base.defaultCurrency,
  });

  if (!result.ok) {
    for (const code of moneyCodes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
  } else {
    const moneyExtras = {
      currency: result.currency,
      period: base.period,
      freshness: base.freshnessLive,
      masked: access.financeMasked,
      status: METRIC_STATUS.READY_WITH_RECONCILIATION,
      limitations: result.limitations,
    };
    metrics[REVENUE_KPI_CODES.COLLECTED_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.COLLECTED_PERIOD,
      result.collectedTotal,
      moneyExtras
    );
    metrics[REVENUE_KPI_CODES.PAYMENTS_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.PAYMENTS_PERIOD,
      result.collectedTotal,
      moneyExtras
    );
    metrics[REVENUE_KPI_CODES.COLLECTED_PAYMENT_COUNT] = readyCount(
      REVENUE_KPI_CODES.COLLECTED_PAYMENT_COUNT,
      result.paymentCount,
      {
        period: base.period,
        freshness: base.freshnessLive,
        status: METRIC_STATUS.READY_WITH_RECONCILIATION,
      }
    );
  }

  return packShell({ section: 'collections', access, base, metrics });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildReceivablesAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('receivables');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.OUTSTANDING_TOTAL,
    REVENUE_KPI_CODES.AGEING_CURRENT,
    REVENUE_KPI_CODES.AGEING_D1_30,
    REVENUE_KPI_CODES.AGEING_D31_60,
    REVENUE_KPI_CODES.AGEING_D61_90,
    REVENUE_KPI_CODES.AGEING_D90_PLUS,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'receivables', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    const fxPack = packShell({ section: 'receivables', access, base, metrics });
    fxPack.dueFieldDoc = AGEING_DUE_FIELD_DOC;
    fxPack.ageing = null;
    return fxPack;
  }

  const result = await computeReceivablesAgeing(prisma, {
    currency: base.defaultCurrency,
    now: base.now,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
  } else {
    const lim = result.dueFieldDoc || AGEING_DUE_FIELD_DOC;
    const extras = {
      currency: result.currency,
      period: base.period,
      freshness: base.freshnessLive,
      masked: access.financeMasked,
      limitations: lim,
    };
    metrics[REVENUE_KPI_CODES.OUTSTANDING_TOTAL] = readyMoney(
      REVENUE_KPI_CODES.OUTSTANDING_TOTAL,
      result.outstandingTotal,
      extras
    );
    metrics[REVENUE_KPI_CODES.AGEING_CURRENT] = readyMoney(
      REVENUE_KPI_CODES.AGEING_CURRENT,
      result.buckets.current,
      extras
    );
    metrics[REVENUE_KPI_CODES.AGEING_D1_30] = readyMoney(
      REVENUE_KPI_CODES.AGEING_D1_30,
      result.buckets.d1_30,
      extras
    );
    metrics[REVENUE_KPI_CODES.AGEING_D31_60] = readyMoney(
      REVENUE_KPI_CODES.AGEING_D31_60,
      result.buckets.d31_60,
      extras
    );
    metrics[REVENUE_KPI_CODES.AGEING_D61_90] = readyMoney(
      REVENUE_KPI_CODES.AGEING_D61_90,
      result.buckets.d61_90,
      extras
    );
    metrics[REVENUE_KPI_CODES.AGEING_D90_PLUS] = readyMoney(
      REVENUE_KPI_CODES.AGEING_D90_PLUS,
      result.buckets.d90_plus,
      extras
    );
  }

  const pack = packShell({ section: 'receivables', access, base, metrics });
  pack.dueFieldDoc = AGEING_DUE_FIELD_DOC;
  pack.ageing = result.ok
    ? { buckets: result.buckets, outstandingTotal: result.outstandingTotal }
    : null;
  return pack;
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildPaymentPerformancePack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('payment-performance');
  const base = baseOpts(opts);
  const metrics = {
    [REVENUE_KPI_CODES.PAYMENT_RETRY_ANALYTICS]: retryAnalyticsUnavailable(),
  };
  const codes = [
    REVENUE_KPI_CODES.PAYMENT_SUCCESS_COUNT,
    REVENUE_KPI_CODES.PAYMENT_FAILURE_COUNT,
    REVENUE_KPI_CODES.PAYMENT_SUCCESS_RATE,
    REVENUE_KPI_CODES.PAYMENT_FAILURE_RATE,
  ];

  // Counts are non-money; still gate rates behind finance for consistency with money analytics
  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'payment-performance', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    // Counts could work without FX, but keep period money-adjacent metrics unavailable for ALL
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'payment-performance', access, base, metrics });
  }

  const result = await computePaymentPerformance(prisma, {
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    currency: base.defaultCurrency,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
  } else {
    metrics[REVENUE_KPI_CODES.PAYMENT_SUCCESS_COUNT] = readyCount(
      REVENUE_KPI_CODES.PAYMENT_SUCCESS_COUNT,
      result.successCount,
      { period: base.period, freshness: base.freshnessLive, limitations: result.limitations }
    );
    metrics[REVENUE_KPI_CODES.PAYMENT_FAILURE_COUNT] = readyCount(
      REVENUE_KPI_CODES.PAYMENT_FAILURE_COUNT,
      result.failureCount,
      { period: base.period, freshness: base.freshnessLive, limitations: result.limitations }
    );
    if (result.ratesAvailable) {
      metrics[REVENUE_KPI_CODES.PAYMENT_SUCCESS_RATE] = readyRatio(
        REVENUE_KPI_CODES.PAYMENT_SUCCESS_RATE,
        result.successRate,
        { period: base.period, freshness: base.freshnessLive, limitations: result.limitations }
      );
      metrics[REVENUE_KPI_CODES.PAYMENT_FAILURE_RATE] = readyRatio(
        REVENUE_KPI_CODES.PAYMENT_FAILURE_RATE,
        result.failureRate,
        { period: base.period, freshness: base.freshnessLive, limitations: result.limitations }
      );
    } else {
      metrics[REVENUE_KPI_CODES.PAYMENT_SUCCESS_RATE] = queryUnavailable(
        REVENUE_KPI_CODES.PAYMENT_SUCCESS_RATE,
        'No successful or failed payments in period; rate undefined (not zero).',
        'no_decided_payments'
      );
      metrics[REVENUE_KPI_CODES.PAYMENT_FAILURE_RATE] = queryUnavailable(
        REVENUE_KPI_CODES.PAYMENT_FAILURE_RATE,
        'No successful or failed payments in period; rate undefined (not zero).',
        'no_decided_payments'
      );
    }
  }

  return packShell({ section: 'payment-performance', access, base, metrics });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildCreditsRefundsAnalyticsPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('credits-refunds');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.CREDITS_OPEN_COUNT,
    REVENUE_KPI_CODES.CREDITS_OPEN_REMAINING,
    REVENUE_KPI_CODES.CREDITS_ISSUED_PERIOD,
    REVENUE_KPI_CODES.REFUNDS_PERIOD,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'credits-refunds', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'credits-refunds', access, base, metrics });
  }

  const result = await computeCreditsRefunds(prisma, {
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    currency: base.defaultCurrency,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
  } else {
    const moneyExtras = {
      currency: result.currency,
      period: base.period,
      freshness: base.freshnessLive,
      masked: access.financeMasked,
      limitations: result.limitations,
    };
    metrics[REVENUE_KPI_CODES.CREDITS_OPEN_COUNT] = readyCount(
      REVENUE_KPI_CODES.CREDITS_OPEN_COUNT,
      result.openCount,
      { period: base.period, freshness: base.freshnessLive }
    );
    metrics[REVENUE_KPI_CODES.CREDITS_OPEN_REMAINING] = readyMoney(
      REVENUE_KPI_CODES.CREDITS_OPEN_REMAINING,
      result.openRemaining,
      moneyExtras
    );
    metrics[REVENUE_KPI_CODES.CREDITS_ISSUED_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.CREDITS_ISSUED_PERIOD,
      result.issuedPeriodTotal,
      moneyExtras
    );
    metrics[REVENUE_KPI_CODES.REFUNDS_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.REFUNDS_PERIOD,
      result.refundsPeriodTotal,
      moneyExtras
    );
  }

  return packShell({ section: 'credits-refunds', access, base, metrics });
}

/** @param {import('@prisma/client').PrismaClient} prisma */
export async function buildMraEisCommercialPack(prisma, opts = {}) {
  const access = resolveAccess(opts.admin);
  if (!access.canView) return forbiddenPack('mra-eis');
  const base = baseOpts(opts);
  const metrics = {};
  const codes = [
    REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,
    REVENUE_KPI_CODES.MRA_EIS_BILLED_PERIOD,
    REVENUE_KPI_CODES.MRA_EIS_COLLECTED_PERIOD,
  ];

  if (!access.financeOk) {
    for (const code of codes) metrics[code] = forbidFinance(code);
    return packShell({ section: 'mra-eis', access, base, metrics });
  }

  if (base.isCrossCurrency) {
    for (const code of codes) metrics[code] = fxUnavailable(code, FX_MSG);
    return packShell({ section: 'mra-eis', access, base, metrics });
  }

  const result = await computeMraEisCommercial(prisma, {
    periodStart: base.periodStart,
    periodEnd: base.periodEnd,
    currency: base.defaultCurrency,
    now: base.now,
  });

  if (!result.ok) {
    for (const code of codes) {
      metrics[code] = queryUnavailable(code, result.message, result.reasonCode);
    }
  } else {
    const extras = {
      currency: result.currency,
      period: base.period,
      freshness: base.freshnessLive,
      masked: access.financeMasked,
      limitations: result.limitations,
    };
    metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS] = readyMoney(
      REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,
      result.mrrEstimated,
      extras
    );
    metrics[REVENUE_KPI_CODES.MRA_EIS_BILLED_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.MRA_EIS_BILLED_PERIOD,
      result.billedPeriod,
      extras
    );
    metrics[REVENUE_KPI_CODES.MRA_EIS_COLLECTED_PERIOD] = readyMoney(
      REVENUE_KPI_CODES.MRA_EIS_COLLECTED_PERIOD,
      result.collectedPeriod,
      extras
    );
  }

  return packShell({ section: 'mra-eis', access, base, metrics });
}

export { assertNoFalseZero, AGEING_DUE_FIELD_DOC };
