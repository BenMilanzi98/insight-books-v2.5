/**
 * Safe user messaging + Transaction EIS status projection — Phase 11.
 * Never claims MRA acceptance / validated / fiscalized.
 */

export const TRANSACTION_EIS_STATUS = Object.freeze({
  EIS_NOT_APPLICABLE: 'EIS_NOT_APPLICABLE',
  EIS_SETUP_REQUIRED: 'EIS_SETUP_REQUIRED',
  EIS_PREFLIGHT_READY: 'EIS_PREFLIGHT_READY',
  EIS_PREFLIGHT_BLOCKED: 'EIS_PREFLIGHT_BLOCKED',
  EIS_COMPLIANCE_HOLD: 'EIS_COMPLIANCE_HOLD',
  EIS_ELIGIBLE: 'EIS_ELIGIBLE',
  EIS_BRIDGE_PENDING: 'EIS_BRIDGE_PENDING',
  EIS_READY_FOR_FISCAL_SNAPSHOT: 'EIS_READY_FOR_FISCAL_SNAPSHOT',
  EIS_FISCAL_SNAPSHOT_CREATED: 'EIS_FISCAL_SNAPSHOT_CREATED',
  EIS_TRANSMISSION_PENDING: 'EIS_TRANSMISSION_PENDING',
  EIS_ACCEPTED: 'EIS_ACCEPTED',
  EIS_REJECTED: 'EIS_REJECTED',
  EIS_MANUAL_REVIEW: 'EIS_MANUAL_REVIEW',
});

/** Phase 11 may set only up to READY_FOR_FISCAL_SNAPSHOT */
export const PHASE_11_MAX_STATUS = TRANSACTION_EIS_STATUS.EIS_READY_FOR_FISCAL_SNAPSHOT;

const BLOCKER_MESSAGES = {
  PRODUCT_MAPPING_REQUIRED: 'A product on this sale is not mapped to an active MRA product.',
  SERVICE_MAPPING_REQUIRED: 'A service on this sale is not mapped to an active MRA service.',
  NO_ACTIVE_TERMINAL: 'No active MRA terminal is available for this sale.',
  TERMINAL_AMBIGUOUS: 'Multiple MRA terminals match this sale. Resolve terminal assignment.',
  TERMINAL_BLOCKED: 'The MRA terminal is blocked and cannot fiscalize this sale.',
  CONFIGURATION_STALE: 'MRA configuration must be refreshed before this sale can be finalized.',
  SITE_MAPPING_MISSING: 'MRA EIS setup is incomplete for this branch (site mapping).',
  SPLIT_PAYMENT_UNSUPPORTED: 'The selected payment combination is not currently supported for MRA fiscalization.',
  BUYER_TIN_REQUIRED: 'Buyer TIN is required for this business-to-business invoice.',
  VAT5_RUNTIME_VALIDATION_REQUIRED: 'VAT5 validation is required before this invoice can proceed.',
  VAT5_AUTHORIZATION_REQUIRED: 'Buyer authorization is required for this VAT5 transaction.',
  CREDIT_PAYMENT_MAPPING_REQUIRED: 'Credit sale payment mapping is required before fiscalization.',
  BUNDLE_REQUIRES_MRA_CLARIFICATION: 'Bundle items cannot be fiscalized until MRA bundle policy is verified.',
};

export function safeEligibilityMessage({ decision, blockers = [], applicabilityReason = null } = {}) {
  if (decision === 'NOT_APPLICABLE' || applicabilityReason?.startsWith('NOT_APPLICABLE')) {
    if (applicabilityReason === 'NOT_APPLICABLE_DRAFT') {
      return 'Draft — not yet eligible for MRA fiscalization';
    }
    if (applicabilityReason === 'NOT_APPLICABLE_TRANSACTION_TYPE') {
      return 'This document type is not a fiscal sale for MRA EIS.';
    }
    return 'This business is not enrolled for MRA EIS. The transaction will follow the normal InsightBooks workflow.';
  }
  if (decision === 'BLOCKED' || decision === 'COMPLIANCE_HOLD') {
    const first = blockers[0];
    return BLOCKER_MESSAGES[first] || 'MRA EIS eligibility is blocked. Resolve the listed requirements and try again.';
  }
  if (decision === 'ELIGIBLE' || decision === 'ELIGIBLE_WITH_WARNINGS') {
    return 'Eligible for fiscal snapshot creation. Not yet submitted to MRA.';
  }
  if (decision === 'MANUAL_REVIEW') {
    return 'This sale requires manual review before MRA EIS processing.';
  }
  return 'MRA EIS status evaluated.';
}

export function documentTypeMessage(sourceType) {
  const t = String(sourceType || '').toUpperCase();
  if (t === 'QUOTATION' || t === 'ESTIMATE') return 'Quotation — not a fiscal sale';
  if (t === 'PROFORMA_INVOICE') return 'Proforma — not a fiscal sale';
  if (t === 'DRAFT') return 'Draft — not yet eligible for MRA fiscalization';
  return null;
}

export function projectTransactionEisStatus({
  applicability = null,
  eligibilityDecision = null,
  bridgeStatus = null,
  purpose = null,
} = {}) {
  if (bridgeStatus === 'READY_FOR_FISCAL_SNAPSHOT') {
    return TRANSACTION_EIS_STATUS.EIS_READY_FOR_FISCAL_SNAPSHOT;
  }
  if (bridgeStatus === 'OUTBOX_PENDING' || bridgeStatus === 'ELIGIBLE') {
    return TRANSACTION_EIS_STATUS.EIS_BRIDGE_PENDING;
  }
  if (bridgeStatus === 'COMPLIANCE_HOLD') return TRANSACTION_EIS_STATUS.EIS_COMPLIANCE_HOLD;
  if (bridgeStatus === 'MANUAL_REVIEW') return TRANSACTION_EIS_STATUS.EIS_MANUAL_REVIEW;
  if (bridgeStatus === 'BLOCKED') return TRANSACTION_EIS_STATUS.EIS_PREFLIGHT_BLOCKED;
  if (bridgeStatus === 'NOT_APPLICABLE') return TRANSACTION_EIS_STATUS.EIS_NOT_APPLICABLE;

  if (!applicability?.applicable) {
    if (applicability?.reason === 'NOT_APPLICABLE_BUSINESS_DISABLED') {
      return TRANSACTION_EIS_STATUS.EIS_SETUP_REQUIRED;
    }
    return TRANSACTION_EIS_STATUS.EIS_NOT_APPLICABLE;
  }

  const d = eligibilityDecision?.decision || eligibilityDecision;
  if (d === 'BLOCKED') return TRANSACTION_EIS_STATUS.EIS_PREFLIGHT_BLOCKED;
  if (d === 'COMPLIANCE_HOLD') return TRANSACTION_EIS_STATUS.EIS_COMPLIANCE_HOLD;
  if (d === 'MANUAL_REVIEW') return TRANSACTION_EIS_STATUS.EIS_MANUAL_REVIEW;
  if (d === 'ELIGIBLE' || d === 'ELIGIBLE_WITH_WARNINGS') {
    return purpose === 'PREFLIGHT'
      ? TRANSACTION_EIS_STATUS.EIS_PREFLIGHT_READY
      : TRANSACTION_EIS_STATUS.EIS_ELIGIBLE;
  }
  return TRANSACTION_EIS_STATUS.EIS_NOT_APPLICABLE;
}

/** Later-phase statuses remain placeholders — never inferred from QR presence. */
export function assertPhase11StatusAllowed(status) {
  const allowed = new Set([
    TRANSACTION_EIS_STATUS.EIS_NOT_APPLICABLE,
    TRANSACTION_EIS_STATUS.EIS_SETUP_REQUIRED,
    TRANSACTION_EIS_STATUS.EIS_PREFLIGHT_READY,
    TRANSACTION_EIS_STATUS.EIS_PREFLIGHT_BLOCKED,
    TRANSACTION_EIS_STATUS.EIS_COMPLIANCE_HOLD,
    TRANSACTION_EIS_STATUS.EIS_ELIGIBLE,
    TRANSACTION_EIS_STATUS.EIS_BRIDGE_PENDING,
    TRANSACTION_EIS_STATUS.EIS_READY_FOR_FISCAL_SNAPSHOT,
    TRANSACTION_EIS_STATUS.EIS_MANUAL_REVIEW,
  ]);
  return allowed.has(status);
}
