/**
 * Server-side executive KPI pack — verified sources only, no false zeroes.
 */

import { computeSaasBillingKpis } from '@/lib/admin/saasBillingKpis';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { AUTHZ_OUTCOMES } from '@/lib/admin/authorization/outcomes';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { KPI_CATALOGUE_VERSION, KPI_CODES, KPI_DEFINITIONS } from './kpiCatalogue.js';
import { METRIC_STATUS, metricEnvelope, unavailableMetric } from './metricStates.js';

function def(code) {
  return KPI_DEFINITIONS[code] || { label: code, definition: null, source: null, unit: null };
}

function readyMoney(code, value, extras = {}) {
  const d = def(code);
  const limitations =
    extras.limitations ||
    (code === KPI_CODES.MRR_ESTIMATED || code === KPI_CODES.ARR_ESTIMATED
      ? 'Approximate; yearly plans ÷ 12; CORE+EIS rows may coexist.'
      : null);
  return metricEnvelope({
    code,
    status: limitations
      ? METRIC_STATUS.READY_WITH_LIMITATIONS
      : extras.recon
        ? METRIC_STATUS.READY_WITH_RECONCILIATION
        : METRIC_STATUS.READY,
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
    limitations,
    masked: Boolean(extras.masked),
  });
}

function readyCount(code, value, extras = {}) {
  const d = def(code);
  return metricEnvelope({
    code,
    status: extras.limitations
      ? METRIC_STATUS.READY_WITH_LIMITATIONS
      : METRIC_STATUS.READY,
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

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, periodStart?: Date, periodEnd?: Date, now?: Date }} opts
 */
export async function buildExecutiveKpiPack(prisma, opts = {}) {
  const admin = opts.admin;
  const now = opts.now || new Date();
  const periodEnd = opts.periodEnd || now;
  const periodStart =
    opts.periodStart || new Date(now.getFullYear(), now.getMonth(), 1);
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
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.executiveRead,
  });
  // Allow dashboard.view OR intel.executive.read
  const canView = view.allowed || intel.allowed;

  if (!canView) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: KPI_CATALOGUE_VERSION,
      metrics: {},
    };
  }

  const finance = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.financialMetrics,
  });
  const financeOk = finance.allowed;
  const financeMasked = finance.outcome === AUTHZ_OUTCOMES.ALLOW_MASKED;

  const metrics = {};

  // Unsupported placeholders — never zero
  metrics[KPI_CODES.ENGAGEMENT_DAU] = unavailableMetric(
    KPI_CODES.ENGAGEMENT_DAU,
    'Unique-user DAU facts are not instrumented yet.',
    { label: def(KPI_CODES.ENGAGEMENT_DAU).label, definition: def(KPI_CODES.ENGAGEMENT_DAU).definition }
  );
  metrics[KPI_CODES.PRODUCT_ADOPTION] = unavailableMetric(
    KPI_CODES.PRODUCT_ADOPTION,
    'FEATURE_USED events are not emitted yet.',
    { label: def(KPI_CODES.PRODUCT_ADOPTION).label }
  );
  metrics[KPI_CODES.CRM_PIPELINE] = unavailableMetric(
    KPI_CODES.CRM_PIPELINE,
    'CRM pipeline is planned for a later phase.',
    { status: METRIC_STATUS.NOT_SUPPORTED, label: def(KPI_CODES.CRM_PIPELINE).label }
  );
  metrics[KPI_CODES.SUPPORT_PRESSURE] = unavailableMetric(
    KPI_CODES.SUPPORT_PRESSURE,
    'No SupportTicket model on the platform plane.',
    { label: def(KPI_CODES.SUPPORT_PRESSURE).label }
  );

  let saas = null;
  try {
    saas = await computeSaasBillingKpis(prisma, { periodStart });
  } catch (e) {
    const msg = e?.message || 'SaaS KPI query failed';
    if (financeOk) {
      metrics[KPI_CODES.MRR_ESTIMATED] = unavailableMetric(
        KPI_CODES.MRR_ESTIMATED,
        msg,
        { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
      );
      metrics[KPI_CODES.ARR_ESTIMATED] = unavailableMetric(
        KPI_CODES.ARR_ESTIMATED,
        msg,
        { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
      );
      metrics[KPI_CODES.PAYMENTS_PERIOD] = unavailableMetric(
        KPI_CODES.PAYMENTS_PERIOD,
        msg,
        { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
      );
      metrics[KPI_CODES.PAYMENTS_ALL] = unavailableMetric(
        KPI_CODES.PAYMENTS_ALL,
        msg,
        { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
      );
    }
  }

  if (saas && financeOk) {
    const mrr = Number(saas.estimatedMrr);
    metrics[KPI_CODES.MRR_ESTIMATED] = readyMoney(KPI_CODES.MRR_ESTIMATED, mrr, {
      period,
      freshness: freshnessLive,
      masked: financeMasked,
    });
    metrics[KPI_CODES.ARR_ESTIMATED] = readyMoney(KPI_CODES.ARR_ESTIMATED, mrr * 12, {
      period,
      freshness: freshnessLive,
      masked: financeMasked,
    });
    metrics[KPI_CODES.PAYMENTS_PERIOD] = readyMoney(
      KPI_CODES.PAYMENTS_PERIOD,
      Number(saas.paymentsCollectedThisPeriod),
      { period, freshness: freshnessLive, recon: true, masked: financeMasked }
    );
    metrics[KPI_CODES.PAYMENTS_ALL] = readyMoney(
      KPI_CODES.PAYMENTS_ALL,
      Number(saas.paymentsCollectedAllTime),
      { freshness: freshnessLive, masked: financeMasked }
    );
  } else if (!financeOk) {
    for (const code of [
      KPI_CODES.MRR_ESTIMATED,
      KPI_CODES.ARR_ESTIMATED,
      KPI_CODES.PAYMENTS_PERIOD,
      KPI_CODES.PAYMENTS_ALL,
    ]) {
      metrics[code] = unavailableMetric(code, 'Insufficient finance metric permission', {
        status: METRIC_STATUS.FORBIDDEN,
        reasonCode: 'forbidden',
        label: def(code).label,
      });
    }
  }

  if (saas) {
    metrics[KPI_CODES.TENANTS_ACTIVE_PAID] = readyCount(
      KPI_CODES.TENANTS_ACTIVE_PAID,
      Number(saas.distinctActivePaidTenants),
      { freshness: freshnessLive }
    );
    metrics[KPI_CODES.TENANTS_TRIAL] = readyCount(
      KPI_CODES.TENANTS_TRIAL,
      Number(saas.trialSubscriptions),
      { freshness: freshnessLive }
    );
    metrics[KPI_CODES.SUBSCRIPTIONS_ACTIVE] = readyCount(
      KPI_CODES.SUBSCRIPTIONS_ACTIVE,
      Number(saas.activeSubscriptionRows),
      { freshness: freshnessLive }
    );
  }

  try {
    const [tenantTotal, userTotal] = await Promise.all([
      prisma.tenant.count(),
      prisma.user.count(),
    ]);
    metrics[KPI_CODES.TENANTS_TOTAL] = readyCount(KPI_CODES.TENANTS_TOTAL, tenantTotal, {
      freshness: freshnessLive,
      limitations: 'Includes all tenant statuses.',
    });
    metrics[KPI_CODES.USERS_TOTAL] = readyCount(KPI_CODES.USERS_TOTAL, userTotal, {
      freshness: freshnessLive,
    });
  } catch (e) {
    metrics[KPI_CODES.TENANTS_TOTAL] = unavailableMetric(
      KPI_CODES.TENANTS_TOTAL,
      e?.message || 'Tenant count failed',
      { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
    );
    metrics[KPI_CODES.USERS_TOTAL] = unavailableMetric(
      KPI_CODES.USERS_TOTAL,
      e?.message || 'User count failed',
      { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
    );
  }

  // MRA EIS entitlement count (optional model)
  try {
    if (typeof prisma.mraEisTenantEntitlement?.count === 'function') {
      const entitled = await prisma.mraEisTenantEntitlement.count({
        where: {
          OR: [{ status: 'ACTIVE' }, { status: 'active' }, { current: true }],
        },
      });
      metrics[KPI_CODES.MRA_EIS_ENTITLED] = readyCount(
        KPI_CODES.MRA_EIS_ENTITLED,
        entitled,
        {
          freshness: freshnessLive,
          limitations: 'Status filter best-effort across entitlement schemas.',
        }
      );
    } else {
      metrics[KPI_CODES.MRA_EIS_ENTITLED] = unavailableMetric(
        KPI_CODES.MRA_EIS_ENTITLED,
        'MRA EIS entitlement model unavailable in this runtime.',
        { status: METRIC_STATUS.UNAVAILABLE }
      );
    }
  } catch (e) {
    metrics[KPI_CODES.MRA_EIS_ENTITLED] = unavailableMetric(
      KPI_CODES.MRA_EIS_ENTITLED,
      e?.message || 'MRA EIS count failed',
      { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
    );
  }

  // Pipeline freshness
  try {
    if (typeof prisma.analyticsDataFreshness?.findUnique === 'function') {
      const row = await prisma.analyticsDataFreshness.findUnique({
        where: { sourceKey: 'analytics_outbox_dispatcher' },
      });
      if (!row?.lastSuccessAt) {
        metrics[KPI_CODES.PIPELINE_FRESHNESS] = unavailableMetric(
          KPI_CODES.PIPELINE_FRESHNESS,
          'Analytics dispatcher has not reported success yet.',
          { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'no_success' }
        );
      } else {
        const lag = Math.max(
          0,
          Math.floor((now.getTime() - new Date(row.lastSuccessAt).getTime()) / 1000)
        );
        const stale = lag > 24 * 3600;
        metrics[KPI_CODES.PIPELINE_FRESHNESS] = metricEnvelope({
          code: KPI_CODES.PIPELINE_FRESHNESS,
          status: stale ? METRIC_STATUS.STALE : METRIC_STATUS.READY,
          value: lag,
          unit: 'seconds',
          label: def(KPI_CODES.PIPELINE_FRESHNESS).label,
          definition: def(KPI_CODES.PIPELINE_FRESHNESS).definition,
          source: def(KPI_CODES.PIPELINE_FRESHNESS).source,
          freshness: { asOf: row.lastSuccessAt, lagSeconds: lag },
          reasonCode: stale ? 'stale' : null,
          reasonMessage: stale ? 'Pipeline lag exceeds 24 hours' : null,
        });
      }
    } else {
      metrics[KPI_CODES.PIPELINE_FRESHNESS] = unavailableMetric(
        KPI_CODES.PIPELINE_FRESHNESS,
        'Analytics freshness table unavailable — run prisma generate.',
        { status: METRIC_STATUS.UNAVAILABLE }
      );
    }
  } catch (e) {
    metrics[KPI_CODES.PIPELINE_FRESHNESS] = unavailableMetric(
      KPI_CODES.PIPELINE_FRESHNESS,
      e?.message || 'Freshness query failed',
      { status: METRIC_STATUS.UNAVAILABLE, reasonCode: 'query_failed' }
    );
  }

  // Ops health — coarse live signal only
  try {
    const mem = Math.round(process.memoryUsage().rss / (1024 * 1024));
    metrics[KPI_CODES.OPS_HEALTH] = metricEnvelope({
      code: KPI_CODES.OPS_HEALTH,
      status: METRIC_STATUS.READY_WITH_LIMITATIONS,
      value: { memoryRssMb: mem, uptimeSeconds: Math.floor(process.uptime()) },
      unit: 'status',
      label: def(KPI_CODES.OPS_HEALTH).label,
      definition: def(KPI_CODES.OPS_HEALTH).definition,
      source: def(KPI_CODES.OPS_HEALTH).source,
      freshness: freshnessLive,
      limitations: 'Process-local signal only; not full infrastructure monitoring.',
    });
  } catch (e) {
    metrics[KPI_CODES.OPS_HEALTH] = unavailableMetric(
      KPI_CODES.OPS_HEALTH,
      e?.message || 'Ops health unavailable',
      { status: METRIC_STATUS.UNAVAILABLE }
    );
  }

  // Optional payment recon attach
  try {
    if (typeof prisma.analyticsReconciliationRun?.findFirst === 'function' && financeOk) {
      const last = await prisma.analyticsReconciliationRun.findFirst({
        where: { checkKey: 'platform_payment_succeeded' },
        orderBy: { createdAt: 'desc' },
      });
      if (last && metrics[KPI_CODES.PAYMENTS_PERIOD]?.status?.startsWith('READY')) {
        metrics[KPI_CODES.PAYMENTS_PERIOD].reconciliation = {
          status: last.status,
          expected: last.expected,
          actual: last.actual,
          variance: last.variance,
          checkedAt: last.createdAt,
        };
        if (last.status === 'MISMATCH') {
          metrics[KPI_CODES.PAYMENTS_PERIOD].status = METRIC_STATUS.RECON_FAILED;
          metrics[KPI_CODES.PAYMENTS_PERIOD].reasonCode = 'recon_mismatch';
          metrics[KPI_CODES.PAYMENTS_PERIOD].reasonMessage =
            'Latest platform payment reconciliation reported a mismatch.';
          // Keep value visible but flagged — executive still sees number with warning
          // Per "no false zeroes" we keep the value when READY_WITH_RECON was previously set
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  const attention = buildAttentionQueue(metrics);

  return {
    ok: true,
    catalogueVersion: KPI_CATALOGUE_VERSION,
    generatedAt: now.toISOString(),
    period,
    authz: {
      finance: finance.outcome,
      masked: financeMasked,
    },
    metrics,
    attention,
  };
}

function buildAttentionQueue(metrics) {
  const items = [];
  for (const m of Object.values(metrics)) {
    if (!m) continue;
    const isPayment =
      typeof m.code === 'string' && m.code.includes('payments');
    const isMrr =
      typeof m.code === 'string' &&
      (m.code.includes('mrr') || m.code.includes('arr'));
    if (m.status === METRIC_STATUS.RECON_FAILED) {
      items.push({
        severity: 'high',
        code: m.code,
        title: `${m.label}: reconciliation mismatch`,
        // Soft-link Phase 5 payment recon → Revenue workbench (Phase 6)
        href: isPayment
          ? '/insightbooks/intelligence/revenue/reconciliation'
          : '/insightbooks/analytics-pipeline',
      });
    }
    if (m.status === METRIC_STATUS.STALE) {
      items.push({
        severity: 'medium',
        code: m.code,
        title: `${m.label}: data delayed`,
        href: isPayment || isMrr
          ? '/insightbooks/intelligence/revenue/overview'
          : '/insightbooks/analytics-pipeline',
      });
    }
    if (m.status === METRIC_STATUS.UNAVAILABLE && m.reasonCode === 'query_failed') {
      items.push({
        severity: 'high',
        code: m.code,
        title: `${m.label}: query failed`,
        href:
          isPayment || isMrr
            ? '/insightbooks/intelligence/revenue/overview'
            : '/insightbooks/intelligence/executive/attention',
      });
    }
  }
  return items;
}

/**
 * Pure helper for tests — envelope never returns 0 on unavailable/forbidden.
 */
export function assertNoFalseZero(metric) {
  if (!metric) return false;
  const noValue = [
    METRIC_STATUS.UNAVAILABLE,
    METRIC_STATUS.NOT_SUPPORTED,
    METRIC_STATUS.FORBIDDEN,
  ];
  if (noValue.includes(metric.status) && metric.value === 0) return false;
  return true;
}

/** Section → metric codes for filtered executive views */
export const EXECUTIVE_SECTIONS = Object.freeze({
  financial: [
    KPI_CODES.MRR_ESTIMATED,
    KPI_CODES.ARR_ESTIMATED,
    KPI_CODES.PAYMENTS_PERIOD,
    KPI_CODES.PAYMENTS_ALL,
  ],
  customers: [
    KPI_CODES.TENANTS_ACTIVE_PAID,
    KPI_CODES.TENANTS_TRIAL,
    KPI_CODES.TENANTS_TOTAL,
    KPI_CODES.USERS_TOTAL,
  ],
  subscriptions: [
    KPI_CODES.SUBSCRIPTIONS_ACTIVE,
    KPI_CODES.TENANTS_ACTIVE_PAID,
    KPI_CODES.TENANTS_TRIAL,
  ],
  engagement: [KPI_CODES.ENGAGEMENT_DAU, KPI_CODES.USERS_TOTAL],
  products: [KPI_CODES.PRODUCT_ADOPTION],
  'mra-eis': [KPI_CODES.MRA_EIS_ENTITLED],
  operations: [KPI_CODES.OPS_HEALTH, KPI_CODES.PIPELINE_FRESHNESS],
  security: [KPI_CODES.OPS_HEALTH],
  attention: [],
  reports: [],
});

export function filterPackBySection(pack, section) {
  if (!pack?.metrics || !section || section === 'overview') return pack;
  const codes = EXECUTIVE_SECTIONS[section];
  if (!codes) return pack;
  if (section === 'attention' || section === 'reports') return pack;
  const metrics = {};
  for (const code of codes) {
    if (pack.metrics[code]) metrics[code] = pack.metrics[code];
  }
  return { ...pack, section, metrics };
}
