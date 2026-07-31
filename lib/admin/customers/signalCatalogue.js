/**
 * Customer signal catalogue — deterministic codes only (Phase 7 Wave 4).
 * No probability, expected revenue, or opaque health scores.
 */

export const CUSTOMER_SIGNAL_RULE_VERSION = 'customer-signals-2026-07-28';

/** Verified-source signal codes (only these may fire). */
export const SIGNAL_CODES = Object.freeze({
  NO_MEANINGFUL_ACTIVITY: 'NO_MEANINGFUL_ACTIVITY',
  RENEWAL_DUE_SOON: 'RENEWAL_DUE_SOON',
  HIGH_OUTSTANDING_BALANCE: 'HIGH_OUTSTANDING_BALANCE',
  SUBSCRIPTION_SUSPENDED: 'SUBSCRIPTION_SUSPENDED',
  MRA_EIS_ENTITLEMENT_PENDING: 'MRA_EIS_ENTITLEMENT_PENDING',
  CUSTOMER_OWNER_MISSING: 'CUSTOMER_OWNER_MISSING',
});

export const SIGNAL_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
});

export const SIGNAL_STATUS = Object.freeze({
  NEW: 'NEW',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED_BY_SOURCE: 'RESOLVED_BY_SOURCE',
  DISMISSED: 'DISMISSED',
});

/** 360 / queue bucketing (not a score). */
export const SIGNAL_KIND = Object.freeze({
  RISK: 'risk',
  OPPORTUNITY: 'opportunity',
  ATTENTION: 'attention',
});

/**
 * Catalogue entries for verified signals.
 * @type {Record<string, {
 *   code: string,
 *   severity: string,
 *   kind: string,
 *   title: string,
 *   source: string,
 * }>}
 */
export const SIGNAL_CATALOGUE = Object.freeze({
  [SIGNAL_CODES.NO_MEANINGFUL_ACTIVITY]: {
    code: SIGNAL_CODES.NO_MEANINGFUL_ACTIVITY,
    severity: SIGNAL_SEVERITY.MEDIUM,
    kind: SIGNAL_KIND.RISK,
    title: 'No recent login activity',
    source: 'User.lastLogin (login proxy; not product FEATURE_USED)',
  },
  [SIGNAL_CODES.RENEWAL_DUE_SOON]: {
    code: SIGNAL_CODES.RENEWAL_DUE_SOON,
    severity: SIGNAL_SEVERITY.HIGH,
    kind: SIGNAL_KIND.ATTENTION,
    title: 'Renewal due soon',
    source: 'AccountSubscription.expiresAt',
  },
  [SIGNAL_CODES.HIGH_OUTSTANDING_BALANCE]: {
    code: SIGNAL_CODES.HIGH_OUTSTANDING_BALANCE,
    severity: SIGNAL_SEVERITY.HIGH,
    kind: SIGNAL_KIND.RISK,
    title: 'Outstanding platform billing',
    source: 'PlatformInvoice.outstanding (platform billing only)',
  },
  [SIGNAL_CODES.SUBSCRIPTION_SUSPENDED]: {
    code: SIGNAL_CODES.SUBSCRIPTION_SUSPENDED,
    severity: SIGNAL_SEVERITY.CRITICAL,
    kind: SIGNAL_KIND.RISK,
    title: 'Tenant / subscription suspended',
    source: 'Tenant.status and/or AccountSubscription.status',
  },
  [SIGNAL_CODES.MRA_EIS_ENTITLEMENT_PENDING]: {
    code: SIGNAL_CODES.MRA_EIS_ENTITLEMENT_PENDING,
    severity: SIGNAL_SEVERITY.MEDIUM,
    kind: SIGNAL_KIND.ATTENTION,
    title: 'MRA EIS entitlement pending or incomplete',
    source: 'MraEisTenantEntitlement.status (isCurrent)',
  },
  [SIGNAL_CODES.CUSTOMER_OWNER_MISSING]: {
    code: SIGNAL_CODES.CUSTOMER_OWNER_MISSING,
    severity: SIGNAL_SEVERITY.MEDIUM,
    kind: SIGNAL_KIND.ATTENTION,
    title: 'Customer owner missing',
    source: 'CustomerOwnership (ACTIVE assignment)',
  },
});

/** Explicitly NOT_SUPPORTED — never emit. */
export const SIGNAL_NOT_SUPPORTED = Object.freeze([
  'FEATURE_USED',
  'ADOPTION_LOW',
  'ADOPTION_SCORE',
  'CHURN_PROBABILITY',
  'EXPECTED_REVENUE',
  'HEALTH_SCORE',
]);

/** Explicitly NOT_INSTRUMENTED — never emit. */
export const SIGNAL_NOT_INSTRUMENTED = Object.freeze([
  'SUPPORT_ESCALATION',
  'SUPPORT_TICKET_OPEN',
  'ONBOARDING_STALLED',
  'TRAINING_OVERDUE',
]);

export const SEVERITY_RANK = Object.freeze({
  [SIGNAL_SEVERITY.CRITICAL]: 0,
  [SIGNAL_SEVERITY.HIGH]: 1,
  [SIGNAL_SEVERITY.MEDIUM]: 2,
  [SIGNAL_SEVERITY.LOW]: 3,
});

/** Default login inactivity window (days) for NO_MEANINGFUL_ACTIVITY. */
export const DEFAULT_INACTIVITY_DAYS = 30;

/** Default renewal window (days) for RENEWAL_DUE_SOON. */
export const DEFAULT_RENEWAL_WINDOW_DAYS = 30;

export function catalogueEntry(code) {
  return SIGNAL_CATALOGUE[code] || null;
}
