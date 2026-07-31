/**
 * Support Ops catalogue — Phase 10 Wave 1.
 * Support Ticket ≠ CsCase ≠ PlatformSupportAccess (PAM).
 * Never store Tenant GL lines, MRA credentials, or payment secrets on tickets.
 */

export const SUPPORT_DEFINITION_VERSION = 'support-ops-tickets-2026-07-30';

/** Canonical statuses from TICKET_STATE_MATRIX. */
export const SUPPORT_TICKET_STATUS = Object.freeze({
  NEW: 'NEW',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  TRIAGE: 'TRIAGE',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER: 'WAITING_FOR_CUSTOMER',
  WAITING_FOR_INTERNAL_TEAM: 'WAITING_FOR_INTERNAL_TEAM',
  WAITING_FOR_VENDOR: 'WAITING_FOR_VENDOR',
  RESOLVED: 'RESOLVED',
  CUSTOMER_CONFIRMED: 'CUSTOMER_CONFIRMED',
  CLOSED: 'CLOSED',
  REOPENED: 'REOPENED',
  DUPLICATE: 'DUPLICATE',
  MERGED: 'MERGED',
  CANCELLED: 'CANCELLED',
  SPAM: 'SPAM',
});

export const SUPPORT_TICKET_STATUSES = Object.freeze(
  Object.values(SUPPORT_TICKET_STATUS)
);

export const SUPPORT_WAITING_STATUSES = Object.freeze([
  SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
  SUPPORT_TICKET_STATUS.WAITING_FOR_INTERNAL_TEAM,
  SUPPORT_TICKET_STATUS.WAITING_FOR_VENDOR,
]);

/** Early statuses that may go to DUPLICATE | MERGED | CANCELLED | SPAM. */
export const SUPPORT_EARLY_TERMINAL_FROM = Object.freeze([
  SUPPORT_TICKET_STATUS.NEW,
  SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
  SUPPORT_TICKET_STATUS.TRIAGE,
  SUPPORT_TICKET_STATUS.ASSIGNED,
]);

export const SUPPORT_TERMINALISH_STATUSES = Object.freeze([
  SUPPORT_TICKET_STATUS.DUPLICATE,
  SUPPORT_TICKET_STATUS.MERGED,
  SUPPORT_TICKET_STATUS.CANCELLED,
  SUPPORT_TICKET_STATUS.SPAM,
]);

export const SUPPORT_TICKET_TYPE = Object.freeze({
  QUESTION: 'QUESTION',
  ACCOUNT_ACCESS: 'ACCOUNT_ACCESS',
  BILLING_INVOICE: 'BILLING_INVOICE',
  BILLING_PAYMENT: 'BILLING_PAYMENT',
  BILLING_SUBSCRIPTION: 'BILLING_SUBSCRIPTION',
  PRODUCT_DEFECT: 'PRODUCT_DEFECT',
  MRA_EIS_ISSUE: 'MRA_EIS_ISSUE',
  OTHER: 'OTHER',
});

export const SUPPORT_IMPACT = Object.freeze({
  PLATFORM_WIDE: 'PLATFORM_WIDE',
  MULTIPLE_TENANTS: 'MULTIPLE_TENANTS',
  ENTIRE_TENANT: 'ENTIRE_TENANT',
  MULTIPLE_BUSINESSES: 'MULTIPLE_BUSINESSES',
  MULTIPLE_USERS: 'MULTIPLE_USERS',
  MULTIPLE_BRANCHES: 'MULTIPLE_BRANCHES',
  SINGLE_USER: 'SINGLE_USER',
  SINGLE_BRANCH: 'SINGLE_BRANCH',
  UNKNOWN: 'UNKNOWN',
});

export const SUPPORT_URGENCY = Object.freeze({
  IMMEDIATE: 'IMMEDIATE',
  HIGH: 'HIGH',
  NORMAL: 'NORMAL',
  LOW: 'LOW',
});

export const SUPPORT_PRIORITY = Object.freeze({
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
  P5: 'P5',
});

/** Severity kept distinct from priority (PRIORITY_MATRIX). */
export const SUPPORT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Source channels. Wave 1 create uses ADMIN_MANUAL only.
 * EMAIL / WHATSAPP / PORTAL remain NOT_AVAILABLE (contracts only).
 */
export const SUPPORT_SOURCE_CHANNEL = Object.freeze({
  ADMIN_MANUAL: 'ADMIN_MANUAL',
  EMAIL: 'EMAIL',
  WHATSAPP: 'WHATSAPP',
  PORTAL: 'PORTAL',
});

export const SUPPORT_CHANNEL_AVAILABILITY = Object.freeze({
  [SUPPORT_SOURCE_CHANNEL.ADMIN_MANUAL]: 'AVAILABLE',
  [SUPPORT_SOURCE_CHANNEL.EMAIL]: 'NOT_AVAILABLE',
  [SUPPORT_SOURCE_CHANNEL.WHATSAPP]: 'NOT_AVAILABLE',
  [SUPPORT_SOURCE_CHANNEL.PORTAL]: 'NOT_AVAILABLE',
});

/**
 * @param {string} channel
 * @returns {'AVAILABLE'|'NOT_AVAILABLE'|'UNKNOWN'}
 */
export function channelAvailability(channel) {
  const key = String(channel || '').toUpperCase();
  return SUPPORT_CHANNEL_AVAILABILITY[key] || 'UNKNOWN';
}

/**
 * Impact row buckets for PRIORITY_MATRIX lookup.
 * @param {string} impact
 */
function impactBucket(impact) {
  const i = String(impact || 'UNKNOWN').toUpperCase();
  if (i === 'PLATFORM_WIDE' || i === 'MULTIPLE_TENANTS') return 'WIDE';
  if (i === 'ENTIRE_TENANT' || i === 'MULTIPLE_BUSINESSES') return 'TENANT';
  if (i === 'MULTIPLE_USERS' || i === 'MULTIPLE_BRANCHES') return 'MULTI';
  if (i === 'SINGLE_USER' || i === 'SINGLE_BRANCH') return 'SINGLE';
  return 'UNKNOWN';
}

/**
 * Default priority from PRIORITY_MATRIX (impact × urgency).
 * Manual override is a later-wave permission; Wave 1 uses this helper.
 *
 * @param {string} impact
 * @param {string} urgency
 * @returns {string}
 */
export function defaultPriority(impact, urgency) {
  const u = String(urgency || 'NORMAL').toUpperCase();
  const bucket = impactBucket(impact);
  const matrix = {
    WIDE: { IMMEDIATE: 'P1', HIGH: 'P1', NORMAL: 'P2', LOW: 'P2' },
    TENANT: { IMMEDIATE: 'P1', HIGH: 'P2', NORMAL: 'P2', LOW: 'P3' },
    MULTI: { IMMEDIATE: 'P2', HIGH: 'P2', NORMAL: 'P3', LOW: 'P3' },
    SINGLE: { IMMEDIATE: 'P2', HIGH: 'P3', NORMAL: 'P3', LOW: 'P4' },
    UNKNOWN: { IMMEDIATE: 'P3', HIGH: 'P3', NORMAL: 'P4', LOW: 'P5' },
  };
  return matrix[bucket][u] || matrix[bucket].NORMAL || 'P4';
}

/**
 * Transition table (v1). Keys = fromStatus; values = allowed toStatus list.
 *
 * Notes:
 * - Create always starts NEW (not a transition).
 * - WAITING_* → RESOLVED is allowed when justified (requires resolutionCategory).
 * - CLOSED → REOPENED only (reason required at assert time).
 * - Terminal-ish statuses have no further transitions (evidence preserved in history).
 */
export const SUPPORT_TRANSITION_TABLE = Object.freeze({
  [SUPPORT_TICKET_STATUS.NEW]: Object.freeze([
    SUPPORT_TICKET_STATUS.ACKNOWLEDGED,
    ...SUPPORT_TERMINALISH_STATUSES,
  ]),
  [SUPPORT_TICKET_STATUS.ACKNOWLEDGED]: Object.freeze([
    SUPPORT_TICKET_STATUS.TRIAGE,
    ...SUPPORT_TERMINALISH_STATUSES,
  ]),
  [SUPPORT_TICKET_STATUS.TRIAGE]: Object.freeze([
    SUPPORT_TICKET_STATUS.ASSIGNED,
    ...SUPPORT_TERMINALISH_STATUSES,
  ]),
  [SUPPORT_TICKET_STATUS.ASSIGNED]: Object.freeze([
    SUPPORT_TICKET_STATUS.IN_PROGRESS,
    ...SUPPORT_TERMINALISH_STATUSES,
  ]),
  [SUPPORT_TICKET_STATUS.IN_PROGRESS]: Object.freeze([
    SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER,
    SUPPORT_TICKET_STATUS.WAITING_FOR_INTERNAL_TEAM,
    SUPPORT_TICKET_STATUS.WAITING_FOR_VENDOR,
    SUPPORT_TICKET_STATUS.RESOLVED,
  ]),
  [SUPPORT_TICKET_STATUS.WAITING_FOR_CUSTOMER]: Object.freeze([
    SUPPORT_TICKET_STATUS.IN_PROGRESS,
    SUPPORT_TICKET_STATUS.RESOLVED,
  ]),
  [SUPPORT_TICKET_STATUS.WAITING_FOR_INTERNAL_TEAM]: Object.freeze([
    SUPPORT_TICKET_STATUS.IN_PROGRESS,
    SUPPORT_TICKET_STATUS.RESOLVED,
  ]),
  [SUPPORT_TICKET_STATUS.WAITING_FOR_VENDOR]: Object.freeze([
    SUPPORT_TICKET_STATUS.IN_PROGRESS,
    SUPPORT_TICKET_STATUS.RESOLVED,
  ]),
  [SUPPORT_TICKET_STATUS.RESOLVED]: Object.freeze([
    SUPPORT_TICKET_STATUS.CUSTOMER_CONFIRMED,
    SUPPORT_TICKET_STATUS.CLOSED,
    SUPPORT_TICKET_STATUS.REOPENED,
  ]),
  [SUPPORT_TICKET_STATUS.CUSTOMER_CONFIRMED]: Object.freeze([
    SUPPORT_TICKET_STATUS.CLOSED,
    SUPPORT_TICKET_STATUS.REOPENED,
  ]),
  [SUPPORT_TICKET_STATUS.CLOSED]: Object.freeze([SUPPORT_TICKET_STATUS.REOPENED]),
  [SUPPORT_TICKET_STATUS.REOPENED]: Object.freeze([
    SUPPORT_TICKET_STATUS.TRIAGE,
    SUPPORT_TICKET_STATUS.ASSIGNED,
    SUPPORT_TICKET_STATUS.IN_PROGRESS,
  ]),
  [SUPPORT_TICKET_STATUS.DUPLICATE]: Object.freeze([]),
  [SUPPORT_TICKET_STATUS.MERGED]: Object.freeze([]),
  [SUPPORT_TICKET_STATUS.CANCELLED]: Object.freeze([]),
  [SUPPORT_TICKET_STATUS.SPAM]: Object.freeze([]),
});

/** SUP-YYYY-###### (UTC year of create). */
export const SUPPORT_TICKET_NUMBER_RE = /^SUP-\d{4}-\d{6}$/;

export const SUPPORT_LIST_MAX_LIMIT = 100;
export const SUPPORT_LIST_DEFAULT_LIMIT = 50;

/**
 * Message types — COMMUNICATION_VISIBILITY_MATRIX.
 * INTERNAL / RESTRICTED must never appear in projectForCustomer.
 */
export const SUPPORT_MESSAGE_TYPE = Object.freeze({
  CUSTOMER_MESSAGE: 'CUSTOMER_MESSAGE',
  PUBLIC_AGENT_REPLY: 'PUBLIC_AGENT_REPLY',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
  RESTRICTED_INTERNAL_NOTE: 'RESTRICTED_INTERNAL_NOTE',
  SYSTEM_EVENT: 'SYSTEM_EVENT',
});

export const SUPPORT_MESSAGE_TYPES = Object.freeze(Object.values(SUPPORT_MESSAGE_TYPE));

/** Types safe for customer portal projection (portal deferred; helper tested now). */
export const SUPPORT_CUSTOMER_VISIBLE_MESSAGE_TYPES = Object.freeze([
  SUPPORT_MESSAGE_TYPE.CUSTOMER_MESSAGE,
  SUPPORT_MESSAGE_TYPE.PUBLIC_AGENT_REPLY,
]);

/** SYSTEM_EVENT codes allowed through a limited customer filter (none by default — fail closed). */
export const SUPPORT_CUSTOMER_SAFE_SYSTEM_EVENT_CODES = Object.freeze([]);

/**
 * Attachment scan states — ATTACHMENT_SECURITY_MATRIX.
 * Only CLEAN is downloadable (with ACL). Fail closed on all others.
 */
export const SUPPORT_ATTACHMENT_STATE = Object.freeze({
  UPLOADED: 'UPLOADED',
  PENDING_SCAN: 'PENDING_SCAN',
  CLEAN: 'CLEAN',
  QUARANTINED: 'QUARANTINED',
  INFECTED: 'INFECTED',
  SCAN_FAILED: 'SCAN_FAILED',
  REJECTED: 'REJECTED',
  DELETED: 'DELETED',
});

export const SUPPORT_ATTACHMENT_STATES = Object.freeze(Object.values(SUPPORT_ATTACHMENT_STATE));

export const SUPPORT_ATTACHMENT_NON_DOWNLOADABLE_STATES = Object.freeze([
  SUPPORT_ATTACHMENT_STATE.UPLOADED,
  SUPPORT_ATTACHMENT_STATE.PENDING_SCAN,
  SUPPORT_ATTACHMENT_STATE.QUARANTINED,
  SUPPORT_ATTACHMENT_STATE.INFECTED,
  SUPPORT_ATTACHMENT_STATE.SCAN_FAILED,
  SUPPORT_ATTACHMENT_STATE.REJECTED,
  SUPPORT_ATTACHMENT_STATE.DELETED,
]);

/** Server-side MIME allow-list for Wave 2 uploads. */
export const SUPPORT_ALLOWED_MIME_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
]);

export const SUPPORT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Queue codes — QUEUE_TEAM_MATRIX (definitions only; liveStatus stays NOT_FOUND
 * until real org owners exist — do not invent staffing metrics).
 */
export const SUPPORT_QUEUE_CODE = Object.freeze({
  GENERAL_SUPPORT: 'GENERAL_SUPPORT',
  ACCOUNT_ACCESS: 'ACCOUNT_ACCESS',
  BILLING: 'BILLING',
  MRA_EIS: 'MRA_EIS',
  PRODUCT: 'PRODUCT',
  TECHNICAL: 'TECHNICAL',
  ANDROID: 'ANDROID',
  SECURITY: 'SECURITY',
  ESCALATIONS: 'ESCALATIONS',
});

export const SUPPORT_QUEUE_CODES = Object.freeze(Object.values(SUPPORT_QUEUE_CODE));

export const SUPPORT_QUEUE_DEFINITIONS = Object.freeze(
  SUPPORT_QUEUE_CODES.map((code) => ({
    code,
    typicalOwnership: {
      GENERAL_SUPPORT: 'Support',
      ACCOUNT_ACCESS: 'Support/Technical',
      BILLING: 'Support/Finance',
      MRA_EIS: 'EIS specialists',
      PRODUCT: 'Product/Support',
      TECHNICAL: 'Technical',
      ANDROID: 'Mobile',
      SECURITY: 'Security',
      ESCALATIONS: 'Managers',
    }[code],
    liveStatus: 'NOT_FOUND',
  }))
);

/** Team stubs for assignment eligibility (Wave 2 — membership optional). */
export const SUPPORT_TEAM_CODE = Object.freeze({
  SUPPORT: 'SUPPORT',
  TECHNICAL: 'TECHNICAL',
  FINANCE: 'FINANCE',
  SECURITY: 'SECURITY',
  PRODUCT: 'PRODUCT',
  MOBILE: 'MOBILE',
  EIS: 'EIS',
  MANAGERS: 'MANAGERS',
});

export const SUPPORT_TEAM_DEFINITIONS = Object.freeze([
  { code: SUPPORT_TEAM_CODE.SUPPORT, name: 'Support', queueCodes: ['GENERAL_SUPPORT', 'ACCOUNT_ACCESS'] },
  { code: SUPPORT_TEAM_CODE.TECHNICAL, name: 'Technical', queueCodes: ['TECHNICAL', 'ACCOUNT_ACCESS'] },
  { code: SUPPORT_TEAM_CODE.FINANCE, name: 'Finance', queueCodes: ['BILLING'] },
  { code: SUPPORT_TEAM_CODE.SECURITY, name: 'Security', queueCodes: ['SECURITY'] },
  { code: SUPPORT_TEAM_CODE.PRODUCT, name: 'Product', queueCodes: ['PRODUCT'] },
  { code: SUPPORT_TEAM_CODE.MOBILE, name: 'Mobile', queueCodes: ['ANDROID'] },
  { code: SUPPORT_TEAM_CODE.EIS, name: 'EIS specialists', queueCodes: ['MRA_EIS'] },
  { code: SUPPORT_TEAM_CODE.MANAGERS, name: 'Managers', queueCodes: ['ESCALATIONS'] },
]);

/** Wave 4 — handoff targets (link-only). */
export const SUPPORT_HANDOFF_TARGET = Object.freeze({
  CS: 'CS',
  PRODUCT: 'PRODUCT',
  FINANCE: 'FINANCE',
  BILLING: 'BILLING',
  MRA: 'MRA',
});

export const SUPPORT_HANDOFF_TARGETS = Object.freeze(Object.values(SUPPORT_HANDOFF_TARGET));

export const SUPPORT_HANDOFF_STATUS = Object.freeze({
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  CLOSED: 'CLOSED',
});

/**
 * Reliability / recon gate states — never map failure to numeric zero.
 * AVAILABLE | PARTIAL_HISTORY | RECONCILIATION_FAILED | NOT_INSTRUMENTED | PERMISSION_RESTRICTED | UNAVAILABLE
 */
export const SUPPORT_RELIABILITY_STATUS = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  PARTIAL_HISTORY: 'PARTIAL_HISTORY',
  RECONCILIATION_FAILED: 'RECONCILIATION_FAILED',
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
  PERMISSION_RESTRICTED: 'PERMISSION_RESTRICTED',
  UNAVAILABLE: 'UNAVAILABLE',
});

/** Wave 4 foundations — explicit contracts; no fake CSAT scores. */
export const SUPPORT_FOUNDATION_KIND = Object.freeze({
  KNOWLEDGE_BASE: 'KNOWLEDGE_BASE',
  PROBLEM_MANAGEMENT: 'PROBLEM_MANAGEMENT',
  CSAT: 'CSAT',
  AUTOMATION: 'AUTOMATION',
});

export const SUPPORT_FOUNDATION_STATUS = Object.freeze({
  NOT_AVAILABLE: 'NOT_AVAILABLE',
  FOUNDATION: 'FOUNDATION',
  NOT_INSTRUMENTED: 'NOT_INSTRUMENTED',
});

export const SUPPORT_EXPORT_VERSION = 'support-export-2026-07-30';
export const SUPPORT_RECON_VERSION = 'support-recon-2026-07-30';
export const SUPPORT_WAVE4_DEFINITION_VERSION = 'support-ops-wave4-2026-07-30';
