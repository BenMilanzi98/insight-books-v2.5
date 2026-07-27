/**
 * Versioned MRA EIS Sales Eligibility Policy Registry — Phase 11.
 */

export const ELIGIBILITY_POLICY_VERSION = 'phase11-eligibility-policy-v1';

export const CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL: 'PROVISIONAL',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
  DEPRECATED: 'DEPRECATED',
});

const entries = [
  {
    policyKey: 'POS_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Phase 2 POS audit + Phase 11 finalization identity',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['DRAFT', 'VOIDED', 'NO_LINES', 'DUPLICATE_BRIDGE'],
    warningRules: ['ANONYMOUS_BUYER'],
  },
  {
    policyKey: 'SALES_INVOICE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Invoice issue/post as canonical trigger',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['DRAFT', 'PROFORMA', 'QUOTATION', 'CANCELLED'],
    warningRules: ['BACKDATED'],
  },
  {
    policyKey: 'CREDIT_SALE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Phase 9 credit payment mapping',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['CREDIT_PAYMENT_MAPPING_REQUIRED'],
    warningRules: [],
  },
  {
    policyKey: 'SPLIT_PAYMENT_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    sourceEvidence: 'Phase 9 splitPaymentPolicy fail-closed',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['SPLIT_PAYMENT_UNSUPPORTED'],
    warningRules: [],
  },
  {
    policyKey: 'PRODUCT_LINE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Phase 10 product resolution',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['PRODUCT_MAPPING_REQUIRED', 'PRODUCT_MAPPING_AMBIGUOUS'],
    warningRules: [],
  },
  {
    policyKey: 'SERVICE_LINE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Phase 10 service resolution',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['SERVICE_MAPPING_REQUIRED'],
    warningRules: [],
  },
  {
    policyKey: 'MIXED_LINE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Per-line resolution',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['UNRESOLVED_LINE'],
    warningRules: [],
  },
  {
    policyKey: 'B2B_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'Phase 1 B2B rules + Clarification Register',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['BUYER_TIN_REQUIRED'],
    warningRules: ['TIN_FORMAT_ONLY_NOT_EXTERNALLY_VALIDATED'],
  },
  {
    policyKey: 'ANONYMOUS_B2C_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'Phase 1 B2C optional buyer fields',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: [],
    warningRules: ['ANONYMOUS_B2C'],
  },
  {
    policyKey: 'VAT5_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    sourceEvidence: 'Live VAT5 validation deferred; readiness only in Phase 11',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['VAT5_RUNTIME_VALIDATION_REQUIRED', 'VAT5_AUTHORIZATION_REQUIRED'],
    warningRules: [],
  },
  {
    policyKey: 'BUYER_AUTHORIZATION_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'Phase 6 ephemeral secret architecture',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['BUYER_AUTHORIZATION_REQUIRED_NOT_PROVIDED', 'BUYER_AUTHORIZATION_EXPIRED'],
    warningRules: [],
  },
  {
    policyKey: 'CURRENCY_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'MWK primary; foreign currency clarification',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['UNSUPPORTED_CURRENCY', 'MIXED_PAYMENT_CURRENCIES_UNSUPPORTED'],
    warningRules: [],
  },
  {
    policyKey: 'DISCOUNT_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Totals reconciliation',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['TOTALS_MISMATCH'],
    warningRules: [],
  },
  {
    policyKey: 'LEVY_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.VERIFIED_IN_SANDBOX,
    sourceEvidence: 'Phase 9 levy resolution',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['LEVY_MAPPING_REQUIRED', 'LEVY_MAPPING_CONFLICT'],
    warningRules: [],
  },
  {
    policyKey: 'ROUNDING_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'Exact decimal + contract tolerance',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['ROUNDING_UNSUPPORTED_DIFFERENCE'],
    warningRules: [],
  },
  {
    policyKey: 'BUNDLE_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    sourceEvidence: 'Phase 10 bundle policy',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['BUNDLE_UNSUPPORTED', 'BUNDLE_REQUIRES_MRA_CLARIFICATION'],
    warningRules: [],
  },
  {
    policyKey: 'PRODUCT_VARIANT_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'No Variant model — explicit variant id ignored with warning',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['VARIANT_MAPPING_REQUIRED'],
    warningRules: ['VARIANT_EXPLICIT_ID_IGNORED_NO_VARIANT_MODEL'],
  },
  {
    policyKey: 'RETURN_CORRECTION_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.BLOCKED,
    sourceEvidence: 'Phase 11 correction boundary',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['BLOCKED_UNSUPPORTED_CORRECTION'],
    warningRules: [],
  },
  {
    policyKey: 'HISTORICAL_TRANSACTION_ELIGIBILITY',
    version: '1',
    contractStatus: CONTRACT_STATUS.BLOCKED,
    sourceEvidence: 'Go-live boundary; Phase 19 migration',
    enabledEnvironments: ['SANDBOX', 'PRODUCTION'],
    blockingRules: ['BEFORE_EIS_GO_LIVE'],
    warningRules: [],
  },
].map((e) => ({
  ...e,
  effectiveDate: '2026-07-22',
  deprecatedDate: null,
  testCoverage: 'test/mraEis.phase11.eligibility.test.js',
}));

export function getEligibilityPolicyEntry(policyKey) {
  return entries.find((e) => e.policyKey === policyKey) || null;
}

export function listEligibilityPolicies() {
  return [...entries];
}

export function getMraEisSalesEligibilityPolicyRegistry() {
  return {
    version: ELIGIBILITY_POLICY_VERSION,
    entries,
    blockedPolicies: entries.filter((e) => e.contractStatus === CONTRACT_STATUS.BLOCKED),
    clarificationPolicies: entries.filter(
      (e) => e.contractStatus === CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION
    ),
  };
}

/** Fail closed when policy is BLOCKED or REQUIRES_MRA_CLARIFICATION for affected flows. */
export function policyFailsClosed(policyKey) {
  const entry = getEligibilityPolicyEntry(policyKey);
  if (!entry) return true;
  return (
    entry.contractStatus === CONTRACT_STATUS.BLOCKED ||
    entry.contractStatus === CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION
  );
}
