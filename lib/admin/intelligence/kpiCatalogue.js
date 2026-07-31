/** Versioned executive KPI catalogue */

export const KPI_CATALOGUE_VERSION = 'kpi-2026-07-28';

export const KPI_CODES = Object.freeze({
  MRR_ESTIMATED: 'platform.mrr.estimated',
  ARR_ESTIMATED: 'platform.arr.estimated',
  PAYMENTS_PERIOD: 'platform.payments.collected_period',
  PAYMENTS_ALL: 'platform.payments.collected_all_time',
  TENANTS_ACTIVE_PAID: 'tenants.active_paid',
  TENANTS_TRIAL: 'tenants.trial',
  TENANTS_TOTAL: 'tenants.total',
  SUBSCRIPTIONS_ACTIVE: 'subscriptions.active',
  USERS_TOTAL: 'users.total',
  ENGAGEMENT_DAU: 'engagement.dau',
  PRODUCT_ADOPTION: 'product.feature_adoption',
  CRM_PIPELINE: 'crm.pipeline',
  SUPPORT_PRESSURE: 'support.pressure',
  MRA_EIS_ENTITLED: 'mra_eis.entitled',
  OPS_HEALTH: 'ops.system_health',
  PIPELINE_FRESHNESS: 'pipeline.freshness',
});

export const KPI_DEFINITIONS = Object.freeze({
  [KPI_CODES.MRR_ESTIMATED]: {
    label: 'Estimated MRR',
    definition:
      'Approximate monthly recurring revenue from active paid AccountSubscription amounts normalized by plan period. Not audited GAAP revenue.',
    source: 'AccountSubscription via computeSaasBillingKpis',
    unit: 'money',
  },
  [KPI_CODES.ARR_ESTIMATED]: {
    label: 'Estimated ARR',
    definition: 'Estimated MRR × 12. Approximate; not a separate subscription ARR engine.',
    source: 'Derived from platform.mrr.estimated',
    unit: 'money',
  },
  [KPI_CODES.PAYMENTS_PERIOD]: {
    label: 'Payments collected (period)',
    definition: 'Sum of COMPLETED PlatformPayment amounts in the selected period.',
    source: 'PlatformPayment',
    unit: 'money',
  },
  [KPI_CODES.PAYMENTS_ALL]: {
    label: 'Payments collected (all time)',
    definition: 'Sum of COMPLETED PlatformPayment amounts (all time).',
    source: 'PlatformPayment',
    unit: 'money',
  },
  [KPI_CODES.TENANTS_ACTIVE_PAID]: {
    label: 'Active paid tenants',
    definition: 'Distinct tenants with an active paid (non-trial) commercial subscription.',
    source: 'AccountSubscription',
    unit: 'count',
  },
  [KPI_CODES.TENANTS_TRIAL]: {
    label: 'Trial subscriptions',
    definition: 'Count of in-trial AccountSubscription rows.',
    source: 'AccountSubscription',
    unit: 'count',
  },
  [KPI_CODES.TENANTS_TOTAL]: {
    label: 'Total tenants',
    definition: 'Count of Tenant rows.',
    source: 'Tenant',
    unit: 'count',
  },
  [KPI_CODES.SUBSCRIPTIONS_ACTIVE]: {
    label: 'Active subscriptions',
    definition: 'Active paid AccountSubscription rows (may exceed distinct tenants).',
    source: 'AccountSubscription',
    unit: 'count',
  },
  [KPI_CODES.USERS_TOTAL]: {
    label: 'Total users',
    definition: 'Count of User rows across tenants.',
    source: 'User',
    unit: 'count',
  },
  [KPI_CODES.ENGAGEMENT_DAU]: {
    label: 'Daily active users',
    definition: 'Unique users active in the last 24 hours.',
    source: 'Requires unique-user activity facts',
    unit: 'count',
  },
  [KPI_CODES.PRODUCT_ADOPTION]: {
    label: 'Feature adoption',
    definition: 'Product feature usage share.',
    source: 'FEATURE_USED events (not emitted)',
    unit: 'ratio',
  },
  [KPI_CODES.CRM_PIPELINE]: {
    label: 'Sales pipeline',
    definition: 'CRM pipeline value.',
    source: 'CRM models (not present)',
    unit: 'money',
  },
  [KPI_CODES.SUPPORT_PRESSURE]: {
    label: 'Support pressure',
    definition: 'Open support ticket load.',
    source: 'SupportTicket (not present)',
    unit: 'count',
  },
  [KPI_CODES.MRA_EIS_ENTITLED]: {
    label: 'MRA EIS entitled tenants',
    definition: 'Tenants with current MRA EIS entitlement.',
    source: 'MraEisTenantEntitlement',
    unit: 'count',
  },
  [KPI_CODES.OPS_HEALTH]: {
    label: 'System operations',
    definition: 'Coarse operational health signal from system-health probes.',
    source: 'system-health API / process metrics',
    unit: 'status',
  },
  [KPI_CODES.PIPELINE_FRESHNESS]: {
    label: 'Analytics pipeline freshness',
    definition: 'Last successful analytics dispatcher run lag.',
    source: 'AnalyticsDataFreshness',
    unit: 'seconds',
  },
});
