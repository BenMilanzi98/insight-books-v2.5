/**
 * Customer Intelligence catalogue — section codes + readiness classes.
 * Aligns with CUSTOMER_360_RESPONSE_CONTRACT / SOURCE_READINESS_MATRIX.
 */

export const CUSTOMER_CATALOGUE_VERSION = 'customer-360-2026-07-28';

export const CUSTOMER_READINESS = Object.freeze({
  READY: 'READY',
  READY_WITH_LIMITATIONS: 'READY_WITH_LIMITATIONS',
  UNAVAILABLE: 'UNAVAILABLE',
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
  NOT_SUPPORTED: 'NOT_SUPPORTED',
  FORBIDDEN: 'FORBIDDEN',
});

/** Top-level 360 section codes */
export const CUSTOMER_SECTION_CODES = Object.freeze({
  IDENTITY: 'customer.identity',
  HIERARCHY: 'customer.hierarchy',
  LIFECYCLE: 'customer.lifecycle',
  COMMERCIAL: 'customer.commercial',
  ENGAGEMENT: 'customer.engagement',
  ADOPTION: 'customer.adoption',
  MRA_EIS: 'customer.mra_eis',
  SERVICE: 'customer.service',
  SIGNALS: 'customer.signals',
  OWNERSHIP: 'customer.ownership',
  RELIABILITY: 'customer.reliability',
});

/** Metric / field codes used in envelopes */
export const CUSTOMER_METRIC_CODES = Object.freeze({
  BRANCH_COUNT: 'customer.hierarchy.branch_count',
  USER_COUNT: 'customer.hierarchy.user_count',
  ACTIVE_USER_COUNT: 'customer.hierarchy.active_user_count',
  MRR: 'customer.commercial.mrr',
  ARR: 'customer.commercial.arr',
  BILLED: 'customer.commercial.billed',
  COLLECTED: 'customer.commercial.collected',
  OUTSTANDING: 'customer.commercial.outstanding',
  LAST_LOGIN: 'customer.engagement.last_login',
  ACTIVE_USERS_PROXY: 'customer.engagement.active_users_proxy',
  TENANTS_TOTAL: 'customer.overview.tenants_total',
  TENANTS_TRIAL: 'customer.overview.tenants_trial',
  TENANTS_ACTIVE_PAID: 'customer.overview.tenants_active_paid',
  TENANTS_SUSPENDED: 'customer.overview.tenants_suspended',
  TENANTS_ARCHIVED: 'customer.overview.tenants_archived',
  TENANTS_UNASSIGNED: 'customer.overview.tenants_unassigned',
});

export const LIFECYCLE_STAGES = Object.freeze({
  CREATED: 'CREATED',
  TRIAL: 'TRIAL',
  ACTIVE_PAID: 'ACTIVE_PAID',
  PAYMENT_DELINQUENT: 'PAYMENT_DELINQUENT',
  SUSPENDED: 'SUSPENDED',
  CANCELLATION_SCHEDULED: 'CANCELLATION_SCHEDULED',
  CHURNED: 'CHURNED',
  REACTIVATED: 'REACTIVATED',
  ARCHIVED: 'ARCHIVED',
});

export const LIFECYCLE_RULE_VERSION = 'customer-lifecycle-2026-07-28';
