/**
 * Compliance Hold policy — Phase 11.
 * Versioned, environment-aware. Does not invent offline permission.
 */

export const COMPLIANCE_HOLD_POLICY_VERSION = 'phase11-compliance-hold-v1';

export const COMPLIANCE_HOLD_POLICY = Object.freeze({
  BLOCK_FINALIZATION: 'BLOCK_FINALIZATION',
  FINALIZE_LOCALLY_AND_HOLD_FISCAL_BRIDGE: 'FINALIZE_LOCALLY_AND_HOLD_FISCAL_BRIDGE',
  ALLOW_ONLY_IN_CERTIFIED_OFFLINE_MODE: 'ALLOW_ONLY_IN_CERTIFIED_OFFLINE_MODE',
  MANUAL_APPROVAL_REQUIRED: 'MANUAL_APPROVAL_REQUIRED',
  BUSINESS_POLICY_DEPENDENT: 'BUSINESS_POLICY_DEPENDENT',
});

const STRUCTURAL_BLOCKERS = new Set([
  'PRODUCT_MAPPING_REQUIRED',
  'SERVICE_MAPPING_REQUIRED',
  'TAX_MAPPING_REQUIRED',
  'PAYMENT_MAPPING_REQUIRED',
  'SPLIT_PAYMENT_UNSUPPORTED',
  'BUYER_TIN_REQUIRED',
  'VAT5_RUNTIME_VALIDATION_REQUIRED',
  'VAT5_AUTHORIZATION_REQUIRED',
  'NO_ACTIVE_TERMINAL',
  'TERMINAL_AMBIGUOUS',
  'TERMINAL_BLOCKED',
  'CONFIGURATION_STALE',
  'SITE_MAPPING_MISSING',
  'BUNDLE_REQUIRES_MRA_CLARIFICATION',
  'CREDIT_PAYMENT_MAPPING_REQUIRED',
  'UNSUPPORTED_CURRENCY',
]);

/**
 * Structural blockers known before finalization → BLOCK_FINALIZATION.
 * Temporary internal bridge failure after local commit → recovery (separate path).
 */
export function getComplianceHoldPolicy({
  environment = 'SANDBOX',
  blockers = [],
  purpose = 'PREFLIGHT',
  certifiedOffline = false,
} = {}) {
  const codes = blockers.map((b) => (typeof b === 'string' ? b : b.code)).filter(Boolean);
  const hasStructural = codes.some((c) => STRUCTURAL_BLOCKERS.has(c));

  if (codes.includes('MANUAL_REVIEW') || codes.includes('TERMINAL_AMBIGUOUS')) {
    return {
      policy: COMPLIANCE_HOLD_POLICY.MANUAL_APPROVAL_REQUIRED,
      environment,
      purpose,
      version: COMPLIANCE_HOLD_POLICY_VERSION,
      allowDraftSave: true,
      allowFiscalFinalization: false,
      allowLocalFinalization: false,
      message: 'Manual review is required before MRA EIS fiscalization can proceed.',
    };
  }

  if (hasStructural) {
    return {
      policy: COMPLIANCE_HOLD_POLICY.BLOCK_FINALIZATION,
      environment,
      purpose,
      version: COMPLIANCE_HOLD_POLICY_VERSION,
      allowDraftSave: true,
      allowFiscalFinalization: false,
      allowLocalFinalization: false,
      message: 'MRA EIS setup or mapping blockers must be resolved before finalization.',
      blockers: codes,
    };
  }

  if (certifiedOffline) {
    return {
      policy: COMPLIANCE_HOLD_POLICY.ALLOW_ONLY_IN_CERTIFIED_OFFLINE_MODE,
      environment,
      purpose,
      version: COMPLIANCE_HOLD_POLICY_VERSION,
      allowDraftSave: true,
      allowFiscalFinalization: false,
      allowLocalFinalization: false,
      message: 'Certified offline mode is not enabled in Phase 11.',
    };
  }

  return {
    policy: COMPLIANCE_HOLD_POLICY.BLOCK_FINALIZATION,
    environment,
    purpose,
    version: COMPLIANCE_HOLD_POLICY_VERSION,
    allowDraftSave: true,
    allowFiscalFinalization: false,
    allowLocalFinalization: false,
    message: 'Compliance hold blocks fiscal finalization.',
    blockers: codes,
  };
}
