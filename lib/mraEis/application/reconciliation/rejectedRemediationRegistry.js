/**
 * Phase 15 — Rejected transaction remediation classification.
 * Never edit completed Fiscal Snapshots to “fix” rejection.
 */

export const REMEDIATION_CLASS = Object.freeze({
  SOURCE_DATA_CORRECTION_REQUIRED: 'SOURCE_DATA_CORRECTION_REQUIRED',
  PRODUCT_MAPPING_CORRECTION_REQUIRED: 'PRODUCT_MAPPING_CORRECTION_REQUIRED',
  SERVICE_MAPPING_CORRECTION_REQUIRED: 'SERVICE_MAPPING_CORRECTION_REQUIRED',
  TAX_MAPPING_CORRECTION_REQUIRED: 'TAX_MAPPING_CORRECTION_REQUIRED',
  LEVY_MAPPING_CORRECTION_REQUIRED: 'LEVY_MAPPING_CORRECTION_REQUIRED',
  PAYMENT_MAPPING_CORRECTION_REQUIRED: 'PAYMENT_MAPPING_CORRECTION_REQUIRED',
  BUYER_DATA_CORRECTION_REQUIRED: 'BUYER_DATA_CORRECTION_REQUIRED',
  VAT5_AUTHORIZATION_REQUIRED: 'VAT5_AUTHORIZATION_REQUIRED',
  TERMINAL_REMEDIATION_REQUIRED: 'TERMINAL_REMEDIATION_REQUIRED',
  CONFIGURATION_REFRESH_REQUIRED: 'CONFIGURATION_REFRESH_REQUIRED',
  DUPLICATE_RECONCILIATION_REQUIRED: 'DUPLICATE_RECONCILIATION_REQUIRED',
  FISCAL_NUMBER_CONFLICT: 'FISCAL_NUMBER_CONFLICT',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  CORRECTION_DOCUMENT_REQUIRED: 'CORRECTION_DOCUMENT_REQUIRED',
  MRA_SUPPORT_REQUIRED: 'MRA_SUPPORT_REQUIRED',
  NON_RETRYABLE_REJECTION: 'NON_RETRYABLE_REJECTION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

const BY_CODE = Object.freeze({
  INVALID_PRODUCT: {
    class: REMEDIATION_CLASS.PRODUCT_MAPPING_CORRECTION_REQUIRED,
    identicalRetryAllowed: false,
    newFiscalNumberProhibited: true,
    snapshotReusable: false,
    legalCorrectionRequired: true,
    userAction: 'Correct product mapping and issue a future correction document — do not edit the completed snapshot.',
    phaseOwnership: 'Phase 10/16+',
  },
  VALIDATION_ERROR: {
    class: REMEDIATION_CLASS.SOURCE_DATA_CORRECTION_REQUIRED,
    identicalRetryAllowed: false,
    newFiscalNumberProhibited: true,
    snapshotReusable: false,
    legalCorrectionRequired: true,
    userAction: 'Review validation errors; do not mutate immutable snapshot.',
    phaseOwnership: 'Phase 15 Manual Review',
  },
  DUPLICATE: {
    class: REMEDIATION_CLASS.DUPLICATE_RECONCILIATION_REQUIRED,
    identicalRetryAllowed: false,
    newFiscalNumberProhibited: true,
    snapshotReusable: true,
    legalCorrectionRequired: false,
    userAction: 'Reconcile duplicate against MRA evidence; do not allocate a new fiscal number.',
    phaseOwnership: 'Phase 15',
  },
  DEFAULT: {
    class: REMEDIATION_CLASS.NON_RETRYABLE_REJECTION,
    identicalRetryAllowed: false,
    newFiscalNumberProhibited: true,
    snapshotReusable: true,
    legalCorrectionRequired: true,
    userAction: 'Open Manual Review. Do not blind-retry. Do not reverse accounting/inventory automatically.',
    phaseOwnership: 'Phase 15',
  },
});

export function classifyRejectedRemediation({ responseCode = null, validationErrors = [] } = {}) {
  const code =
    responseCode ||
    validationErrors?.[0]?.code ||
    'DEFAULT';
  const entry = BY_CODE[code] || BY_CODE.DEFAULT;
  return {
    responseCode: code,
    ...entry,
    registryVersion: 'rejected-remediation-v1',
    editCompletedSnapshotForbidden: true,
    accountingReversalAutomatic: false,
    inventoryReversalAutomatic: false,
  };
}

export function getRejectedRemediationRegistry() {
  return BY_CODE;
}
