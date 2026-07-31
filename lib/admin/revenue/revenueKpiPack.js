/**

 * Server-side Revenue Intelligence KPI pack — platform billing only, no false zeroes.

 */



import { computeSaasBillingKpis } from '@/lib/admin/saasBillingKpis';

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

import { loadPointInTimeMrr } from './reconstructMrr.js';

import { buildMrrBridge } from './mrrBridge.js';

import { mrrMetricKeys, readMrrSnapshot } from './mrrSnapshots.js';



function def(code) {

  return getRevenueDefinition(code);

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

    comparison: extras.comparison ?? null,

    freshness: extras.freshness,

    reconciliation: extras.reconciliation ?? null,

    limitations:

      extras.limitations ||

      'Approximate; yearly plans ÷ 12; CORE+EIS rows may coexist; estimated contracted MRR only.',

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



const MONEY_METRIC_CODES = [

  REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

  REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

  REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

  REVENUE_KPI_CODES.ARR_ESTIMATED,

  REVENUE_KPI_CODES.ARPA,

  REVENUE_KPI_CODES.PAYMENTS_PERIOD,

  REVENUE_KPI_CODES.BRIDGE_OPENING,

  REVENUE_KPI_CODES.BRIDGE_CLOSING,

  REVENUE_KPI_CODES.BRIDGE_NEW,

  REVENUE_KPI_CODES.BRIDGE_EXPANSION,

  REVENUE_KPI_CODES.BRIDGE_CONTRACTION,

  REVENUE_KPI_CODES.BRIDGE_CHURNED,

  REVENUE_KPI_CODES.BRIDGE_REACTIVATION,

  REVENUE_KPI_CODES.BRIDGE_NET_NEW,

];



/**

 * Resolve finance access for money metrics:

 * - financialMetrics → full finance

 * - else intel.revenue.read → full finance

 * - else dashboard.view → ALLOW_MASKED

 * - else FORBIDDEN

 */

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



/**

 * @param {import('@prisma/client').PrismaClient} prisma

 * @param {{

 *   admin: object,

 *   periodStart?: Date,

 *   periodEnd?: Date,

 *   currency?: string,

 *   now?: Date,

 * }} opts

 */

export async function buildRevenueKpiPack(prisma, opts = {}) {

  const admin = opts.admin;

  const now = opts.now || new Date();

  const periodEnd = opts.periodEnd || now;

  const periodStart =

    opts.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);

  const currencyRaw = opts.currency;

  const isCrossCurrency = currencyRaw === 'ALL' || currencyRaw === '*';

  const currency =

    !currencyRaw || isCrossCurrency ? null : String(currencyRaw).toUpperCase();

  // Display / single-currency default; never used to invent FX totals for ALL/*

  const defaultCurrency = currency || 'MWK';

  const period = {

    start: periodStart.toISOString(),

    end: periodEnd.toISOString(),

  };

  const freshnessLive = {

    asOf: now.toISOString(),

    status: 'LIVE_QUERY',

  };



  const view = authorizeAdminDecision({

    admin,

    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,

  });

  const intel = authorizeAdminDecision({

    admin,

    permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,

  });

  const canView = view.allowed || intel.allowed;



  if (!canView) {

    return {

      ok: false,

      forbidden: true,

      catalogueVersion: REVENUE_CATALOGUE_VERSION,

      metrics: {},

      attention: [],

    };

  }



  const { financeOk, financeMasked } = resolveFinanceAccess(admin, intel.allowed);



  const metrics = {};



  // Cross-currency always UNAVAILABLE (no FX source)

  metrics[REVENUE_KPI_CODES.MRR_CROSS_CURRENCY] = unavailableMetric(

    REVENUE_KPI_CODES.MRR_CROSS_CURRENCY,

    'No certified FX rate source; cross-currency MRR totals are UNAVAILABLE.',

    {

      status: METRIC_STATUS.UNAVAILABLE,

      reasonCode: 'fx_unavailable',

      label: def(REVENUE_KPI_CODES.MRR_CROSS_CURRENCY).label,

      definition: def(REVENUE_KPI_CODES.MRR_CROSS_CURRENCY).definition,

      source: def(REVENUE_KPI_CODES.MRR_CROSS_CURRENCY).source,

    }

  );



  // Bridge (snapshot-gated). Never pass default MWK for ALL/* — mark fx_unavailable.

  const bridge = await buildMrrBridge(prisma, {

    periodStart,

    periodEnd,

    currency: isCrossCurrency ? 'ALL' : defaultCurrency,

    masked: financeMasked,

  });

  Object.assign(metrics, bridge.metrics || {});



  if (!financeOk) {

    for (const code of MONEY_METRIC_CODES) {

      metrics[code] = forbidFinance(code);

    }

  } else if (isCrossCurrency) {

    const msg =

      'Cross-currency consolidation UNAVAILABLE without a certified FX rate source; request a single currency.';

    for (const code of [

      REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

      REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

      REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

      REVENUE_KPI_CODES.ARR_ESTIMATED,

      REVENUE_KPI_CODES.ARPA,

      REVENUE_KPI_CODES.PAYMENTS_PERIOD,

    ]) {

      metrics[code] = fxUnavailable(code, msg);

    }

    // Bridge already UNAVAILABLE via buildMrrBridge(currency=ALL); ensure reasonCode

    for (const code of [

      REVENUE_KPI_CODES.BRIDGE_OPENING,

      REVENUE_KPI_CODES.BRIDGE_CLOSING,

      REVENUE_KPI_CODES.BRIDGE_NEW,

      REVENUE_KPI_CODES.BRIDGE_EXPANSION,

      REVENUE_KPI_CODES.BRIDGE_CONTRACTION,

      REVENUE_KPI_CODES.BRIDGE_CHURNED,

      REVENUE_KPI_CODES.BRIDGE_REACTIVATION,

      REVENUE_KPI_CODES.BRIDGE_NET_NEW,

    ]) {

      if (metrics[code]?.reasonCode !== 'fx_unavailable') {

        metrics[code] = fxUnavailable(code, msg);

      }

    }

    // Counts can still be computed without FX — leave optional; Wave 1 marks money only

    try {

      const pit = await loadPointInTimeMrr(prisma, {

        currency: defaultCurrency,

        now,

      });

      metrics[REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID] = readyCount(

        REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID,

        pit.tenantIds?.size ?? 0,

        {

          freshness: freshnessLive,

          period,

          limitations:

            'Tenant count for default currency bucket only; cross-currency consolidation UNAVAILABLE.',

        }

      );

      metrics[REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE] = readyCount(

        REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE,

        pit.rowCount || 0,

        {

          freshness: freshnessLive,

          period,

          limitations:

            'Subscription count for default currency bucket only; CORE + EIS coexistence can yield two active rows per tenant.',

        }

      );

    } catch {

      // counts optional when ALL

    }

  } else {

    try {

      const pit = await loadPointInTimeMrr(prisma, {

        currency: defaultCurrency,

        now,

      });

      const mrr = Number(pit.total) || 0;

      const core = Number(pit.core) || 0;

      const eis = Number(pit.mraEis) || 0;

      const tenants = pit.tenantIds?.size ?? 0;



      metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL] = readyMoney(

        REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

        mrr,

        {

          currency: defaultCurrency,

          period,

          freshness: freshnessLive,

          masked: financeMasked,

        }

      );

      metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_CORE] = readyMoney(

        REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

        core,

        {

          currency: defaultCurrency,

          period,

          freshness: freshnessLive,

          masked: financeMasked,

        }

      );

      metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS] = readyMoney(

        REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

        eis,

        {

          currency: defaultCurrency,

          period,

          freshness: freshnessLive,

          masked: financeMasked,

        }

      );

      metrics[REVENUE_KPI_CODES.ARR_ESTIMATED] = readyMoney(

        REVENUE_KPI_CODES.ARR_ESTIMATED,

        mrr * 12,

        {

          currency: defaultCurrency,

          period,

          freshness: freshnessLive,

          masked: financeMasked,

        }

      );



      if (tenants > 0) {

        metrics[REVENUE_KPI_CODES.ARPA] = readyMoney(

          REVENUE_KPI_CODES.ARPA,

          Math.round((mrr / tenants) * 100) / 100,

          {

            currency: defaultCurrency,

            period,

            freshness: freshnessLive,

            masked: financeMasked,

            limitations: 'ARPA = estimated MRR ÷ distinct paid tenants in currency bucket.',

          }

        );

      } else {

        metrics[REVENUE_KPI_CODES.ARPA] = unavailableMetric(

          REVENUE_KPI_CODES.ARPA,

          'No active paid tenants in currency bucket; ARPA undefined (not zero).',

          {

            status: METRIC_STATUS.UNAVAILABLE,

            reasonCode: 'no_tenants',

            label: def(REVENUE_KPI_CODES.ARPA).label,

            definition: def(REVENUE_KPI_CODES.ARPA).definition,

            currency: defaultCurrency,

          }

        );

      }



      metrics[REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID] = readyCount(

        REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID,

        tenants,

        { freshness: freshnessLive, period }

      );

      metrics[REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE] = readyCount(

        REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE,

        pit.rowCount || 0,

        {

          freshness: freshnessLive,

          period,

          limitations: 'CORE + EIS coexistence can yield two active rows per tenant.',

        }

      );



      // Payments: filter by requested currency (never sum mixed currencies as MWK)

      try {

        const saas = await computeSaasBillingKpis(prisma, {

          periodStart,

          currency: defaultCurrency,

        });

        metrics[REVENUE_KPI_CODES.PAYMENTS_PERIOD] = readyMoney(

          REVENUE_KPI_CODES.PAYMENTS_PERIOD,

          Number(saas.paymentsCollectedThisPeriod) || 0,

          {

            currency: saas.currency || defaultCurrency,

            period,

            freshness: freshnessLive,

            masked: financeMasked,

            status: METRIC_STATUS.READY_WITH_RECONCILIATION,

            limitations:

              'PlatformPayment totals filtered by requested currency; reconcile vs invoice path.',

          }

        );

      } catch (e) {

        metrics[REVENUE_KPI_CODES.PAYMENTS_PERIOD] = unavailableMetric(

          REVENUE_KPI_CODES.PAYMENTS_PERIOD,

          e?.message || 'Payment query failed',

          {

            status: METRIC_STATUS.UNAVAILABLE,

            reasonCode: 'query_failed',

            label: def(REVENUE_KPI_CODES.PAYMENTS_PERIOD).label,

          }

        );

      }

    } catch (e) {

      const msg = e?.message || 'Revenue KPI query failed';

      for (const code of [

        REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

        REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

        REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

        REVENUE_KPI_CODES.ARR_ESTIMATED,

        REVENUE_KPI_CODES.ARPA,

        REVENUE_KPI_CODES.PAYMENTS_PERIOD,

        REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID,

        REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE,

      ]) {

        if (!metrics[code]) {

          metrics[code] = unavailableMetric(code, msg, {

            status: METRIC_STATUS.UNAVAILABLE,

            reasonCode: 'query_failed',

            label: def(code).label,

          });

        }

      }

    }

  }



  const attention = buildRevenueAttention(metrics);

  const recon = await buildReconciliationHints(prisma, {

    currency: isCrossCurrency ? null : defaultCurrency,

    now,

    metrics,

  });



  return {

    ok: true,

    forbidden: false,

    catalogueVersion: REVENUE_CATALOGUE_VERSION,

    currency: isCrossCurrency ? 'ALL' : defaultCurrency,

    period,

    metrics,

    attention,

    reconciliation: recon,

    authz: {

      finance: financeOk,

      masked: financeMasked,

      intelRevenue: intel.allowed,

      dashboardView: view.allowed,

    },

    sources: {

      commercial: 'platform_billing',

      excludes: ['TenantSale', 'tenant_gl', 'tenant_pnl', 'fiscal_eis_invoice'],

    },

  };

}



function buildRevenueAttention(metrics) {

  const items = [];

  for (const m of Object.values(metrics || {})) {

    if (!m) continue;

    if (m.status === METRIC_STATUS.UNAVAILABLE && m.reasonCode === 'snapshots_missing') {

      items.push({

        severity: 'medium',

        code: m.code,

        title: `${m.label}: snapshots missing for bridge`,

        href: '/insightbooks/intelligence/revenue/reconciliation',

      });

    }

    if (m.status === METRIC_STATUS.UNAVAILABLE && m.reasonCode === 'query_failed') {

      items.push({

        severity: 'high',

        code: m.code,

        title: `${m.label}: query failed`,

        href: '/insightbooks/intelligence/revenue/overview',

      });

    }

  }

  return items;

}



async function buildReconciliationHints(prisma, { currency, now, metrics }) {

  if (!currency) {

    return {

      metricKeys: null,

      liveMrr: null,

      snapshotToday: null,

      delta: null,

      notes: [

        'Platform billing is commercial source of truth; TenantSale never included.',

        'Cross-currency consolidation UNAVAILABLE without FX; request a single currency.',

      ],

    };

  }



  const keys = mrrMetricKeys(currency);

  let snapshot = null;

  try {

    snapshot = await readMrrSnapshot(prisma, { date: now, currency });

  } catch {

    snapshot = null;

  }



  const live = metrics[REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL];

  const hints = {

    metricKeys: keys,

    liveMrr: live?.value ?? null,

    snapshotToday: snapshot

      ? { total: snapshot.total, confidence: snapshot.confidence, date: snapshot.date }

      : null,

    delta:

      live?.value != null && snapshot

        ? Math.round((Number(live.value) - Number(snapshot.total)) * 100) / 100

        : null,

    notes: [

      'Platform billing is commercial source of truth; TenantSale never included.',

      'Bridge requires adjacent AnalyticsDailySnapshot rows for opening and closing dates.',

    ],

  };

  return hints;

}



export const REVENUE_SECTIONS = Object.freeze({

  overview: null,

  recurring: [

    REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

    REVENUE_KPI_CODES.MRR_ESTIMATED_CORE,

    REVENUE_KPI_CODES.MRR_ESTIMATED_MRA_EIS,

    REVENUE_KPI_CODES.ARR_ESTIMATED,

    REVENUE_KPI_CODES.ARPA,

    REVENUE_KPI_CODES.MRR_CROSS_CURRENCY,

    REVENUE_KPI_CODES.BRIDGE_OPENING,

    REVENUE_KPI_CODES.BRIDGE_CLOSING,

    REVENUE_KPI_CODES.BRIDGE_NEW,

    REVENUE_KPI_CODES.BRIDGE_EXPANSION,

    REVENUE_KPI_CODES.BRIDGE_CONTRACTION,

    REVENUE_KPI_CODES.BRIDGE_CHURNED,

    REVENUE_KPI_CODES.BRIDGE_REACTIVATION,

    REVENUE_KPI_CODES.BRIDGE_NET_NEW,

    REVENUE_KPI_CODES.TENANTS_ACTIVE_PAID,

    REVENUE_KPI_CODES.SUBSCRIPTIONS_ACTIVE,

  ],

  reconciliation: [

    REVENUE_KPI_CODES.MRR_ESTIMATED_TOTAL,

    REVENUE_KPI_CODES.BRIDGE_OPENING,

    REVENUE_KPI_CODES.BRIDGE_CLOSING,

    REVENUE_KPI_CODES.PAYMENTS_PERIOD,

  ],

});



export function filterRevenuePackBySection(pack, section) {

  if (!pack?.metrics || !section || section === 'overview') return pack;

  const codes = REVENUE_SECTIONS[section];

  if (!codes) return pack;

  const metrics = {};

  for (const code of codes) {

    if (pack.metrics[code]) metrics[code] = pack.metrics[code];

  }

  return { ...pack, section, metrics };

}



export { assertNoFalseZero, REVENUE_KPI_CODES, REVENUE_CATALOGUE_VERSION, METRIC_STATUS };


