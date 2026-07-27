/**
 * Phase 18 — Consistent EIS status vocabulary (text + visual; not colour-only).
 */

export const EIS_STATUS = Object.freeze({
  SUCCESS: {
    code: 'SUCCESS',
    label: 'Success',
    description: 'Operation completed successfully.',
    srText: 'Status success',
    tone: 'success',
  },
  WARNING: {
    code: 'WARNING',
    label: 'Warning',
    description: 'Attention required; operation may continue.',
    srText: 'Status warning',
    tone: 'warning',
  },
  ERROR: {
    code: 'ERROR',
    label: 'Error',
    description: 'Operation failed.',
    srText: 'Status error',
    tone: 'error',
  },
  BLOCKED: {
    code: 'BLOCKED',
    label: 'Blocked',
    description: 'Capability blocked by an active restriction or policy.',
    srText: 'Status blocked',
    tone: 'error',
  },
  PENDING: {
    code: 'PENDING',
    label: 'Pending',
    description: 'Awaiting processing.',
    srText: 'Status pending',
    tone: 'pending',
  },
  PROCESSING: {
    code: 'PROCESSING',
    label: 'Processing',
    description: 'Work in progress.',
    srText: 'Status processing',
    tone: 'pending',
  },
  UNKNOWN: {
    code: 'UNKNOWN',
    label: 'Unknown outcome',
    description: 'Outcome is uncertain; reconcile before retry.',
    srText: 'Status unknown outcome',
    tone: 'warning',
  },
  MANUAL_REVIEW: {
    code: 'MANUAL_REVIEW',
    label: 'Manual review',
    description: 'Requires human review through approved workflow.',
    srText: 'Status manual review',
    tone: 'warning',
  },
  INACTIVE: {
    code: 'INACTIVE',
    label: 'Inactive',
    description: 'Not currently operational.',
    srText: 'Status inactive',
    tone: 'neutral',
  },
  EXPIRED: {
    code: 'EXPIRED',
    label: 'Expired',
    description: 'Validity period ended.',
    srText: 'Status expired',
    tone: 'warning',
  },
  REVOKED: {
    code: 'REVOKED',
    label: 'Revoked',
    description: 'Revoked by authority.',
    srText: 'Status revoked',
    tone: 'error',
  },
  SANDBOX: {
    code: 'SANDBOX',
    label: 'Sandbox',
    description: 'Sandbox environment — not production.',
    srText: 'Environment sandbox',
    tone: 'sandbox',
  },
  PRODUCTION: {
    code: 'PRODUCTION',
    label: 'Production',
    description: 'Production environment.',
    srText: 'Environment production',
    tone: 'production',
  },
  CERTIFICATION: {
    code: 'CERTIFICATION',
    label: 'Certification',
    description: 'Certification context.',
    srText: 'Environment certification',
    tone: 'pending',
  },
});

export const FRESHNESS = Object.freeze({
  LIVE: 'LIVE',
  CURRENT: 'CURRENT',
  SLIGHTLY_DELAYED: 'SLIGHTLY_DELAYED',
  STALE: 'STALE',
  REBUILDING: 'REBUILDING',
  PARTIAL: 'PARTIAL',
  UNAVAILABLE: 'UNAVAILABLE',
});

export function resolveStatus(code) {
  return EIS_STATUS[code] || EIS_STATUS.UNKNOWN;
}

export function environmentBadge(environment) {
  const env = String(environment || 'SANDBOX').toUpperCase();
  if (env === 'PRODUCTION') return EIS_STATUS.PRODUCTION;
  if (env === 'CERTIFICATION') return EIS_STATUS.CERTIFICATION;
  return EIS_STATUS.SANDBOX;
}

/** Map domain transmission outcome → status */
export function transmissionOutcomeStatus(outcome) {
  const o = String(outcome || '').toUpperCase();
  if (o === 'ACCEPTED') return EIS_STATUS.SUCCESS;
  if (o === 'REJECTED') return EIS_STATUS.ERROR;
  if (o.includes('UNKNOWN')) return EIS_STATUS.UNKNOWN;
  if (o.includes('BLOCK')) return EIS_STATUS.BLOCKED;
  return EIS_STATUS.PENDING;
}
