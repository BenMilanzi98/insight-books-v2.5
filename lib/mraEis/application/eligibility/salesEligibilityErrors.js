/**
 * Typed Phase 11 sales eligibility / bridge errors.
 */
import { MraEisControlError } from '../../domain/errors.js';

function make(code, defaults = {}) {
  return (opts = {}) =>
    new MraEisControlError({
      code,
      message: opts.message || defaults.message || code,
      httpStatus: opts.httpStatus ?? defaults.httpStatus ?? 400,
      requiredAction: opts.requiredAction || defaults.requiredAction || null,
      retryable: opts.retryable ?? defaults.retryable ?? false,
      ...opts,
      details: {
        eligibilityStage: opts.details?.stage || opts.eligibilityStage || null,
        ...(opts.details || {}),
      },
    });
}

export const SalesEligibilityErrors = {
  notApplicable: make('MRA_EIS_SALE_NOT_APPLICABLE', {
    message: 'This transaction is not applicable for MRA EIS.',
    httpStatus: 200,
  }),
  eligibilityBlocked: make('MRA_EIS_SALE_ELIGIBILITY_BLOCKED', {
    message: 'MRA EIS eligibility is blocked for this sale.',
    httpStatus: 422,
    requiredAction: 'RESOLVE_BLOCKERS',
  }),
  complianceHold: make('MRA_EIS_SALE_COMPLIANCE_HOLD', {
    message: 'This sale is on compliance hold for MRA EIS.',
    httpStatus: 422,
  }),
  sourceVersionConflict: make('MRA_EIS_SALE_SOURCE_VERSION_CONFLICT', {
    message: 'The sale version changed before finalization completed.',
    httpStatus: 409,
    retryable: true,
  }),
  alreadyFinalized: make('MRA_EIS_SALE_ALREADY_FINALIZED', {
    message: 'This sale is already finalized.',
    httpStatus: 409,
  }),
  finalizationIdentityConflict: make('MRA_EIS_SALE_FINALIZATION_IDENTITY_CONFLICT', {
    message: 'Finalization identity conflict.',
    httpStatus: 409,
  }),
  unsupportedType: make('MRA_EIS_UNSUPPORTED_SALES_TRANSACTION_TYPE', {
    message: 'Unsupported transaction type for MRA EIS sales fiscalization.',
    httpStatus: 422,
  }),
  draft: make('MRA_EIS_DRAFT_TRANSACTION', {
    message: 'Draft — not yet eligible for MRA fiscalization.',
    httpStatus: 422,
  }),
  quotation: make('MRA_EIS_QUOTATION_NOT_FISCAL', {
    message: 'Quotation — not a fiscal sale.',
    httpStatus: 422,
  }),
  proforma: make('MRA_EIS_PROFORMA_NOT_FISCAL', {
    message: 'Proforma — not a fiscal sale.',
    httpStatus: 422,
  }),
  purchase: make('MRA_EIS_PURCHASE_NOT_FISCAL', {
    message: 'Purchase transactions are not MRA EIS sales.',
    httpStatus: 422,
  }),
  customerPayment: make('MRA_EIS_CUSTOMER_PAYMENT_NOT_FISCAL', {
    message: 'Customer payments are not new MRA EIS sales.',
    httpStatus: 422,
  }),
  correctionUnsupported: make('MRA_EIS_CORRECTION_WORKFLOW_UNSUPPORTED', {
    message: 'This correction workflow is not implemented for MRA EIS yet.',
    httpStatus: 422,
  }),
  terminalResolution: make('MRA_EIS_TERMINAL_RESOLUTION', {
    message: 'MRA terminal could not be resolved for this sale.',
    httpStatus: 422,
  }),
  terminalAmbiguous: make('MRA_EIS_TERMINAL_AMBIGUOUS', {
    message: 'Multiple MRA terminals match this sale.',
    httpStatus: 422,
  }),
  terminalBlocked: make('MRA_EIS_TERMINAL_BLOCKED', {
    message: 'The MRA terminal is blocked.',
    httpStatus: 422,
  }),
  configurationNotCurrent: make('MRA_EIS_CONFIGURATION_NOT_CURRENT', {
    message: 'MRA configuration must be refreshed before this sale can be finalized.',
    httpStatus: 422,
  }),
  siteResolution: make('MRA_EIS_SITE_RESOLUTION', {
    message: 'MRA site could not be resolved for this sale.',
    httpStatus: 422,
  }),
  productLine: make('MRA_EIS_PRODUCT_LINE_RESOLUTION', {
    message: 'A product line could not be resolved for MRA EIS.',
    httpStatus: 422,
  }),
  serviceLine: make('MRA_EIS_SERVICE_LINE_RESOLUTION', {
    message: 'A service line could not be resolved for MRA EIS.',
    httpStatus: 422,
  }),
  splitPayment: make('MRA_EIS_SPLIT_PAYMENT_UNSUPPORTED', {
    message: 'The selected payment combination is not currently supported for MRA fiscalization.',
    httpStatus: 422,
  }),
  buyerTin: make('MRA_EIS_BUYER_TIN_REQUIRED', {
    message: 'Buyer TIN is required for this business-to-business invoice.',
    httpStatus: 422,
  }),
  buyerAuth: make('MRA_EIS_BUYER_AUTHORIZATION_REQUIRED', {
    message: 'Buyer authorization is required for this transaction.',
    httpStatus: 422,
  }),
  vat5: make('MRA_EIS_VAT5_VALIDATION_REQUIRED', {
    message: 'VAT5 validation is required before this invoice can proceed.',
    httpStatus: 422,
  }),
  totalsMismatch: make('MRA_EIS_SALES_TOTALS_MISMATCH', {
    message: 'Sale totals do not reconcile for MRA EIS eligibility.',
    httpStatus: 422,
  }),
  bridgeAlreadyExists: make('MRA_EIS_BRIDGE_ALREADY_EXISTS', {
    message: 'An EIS bridge already exists for this finalization identity.',
    httpStatus: 409,
  }),
  bridgeIdempotencyConflict: make('MRA_EIS_BRIDGE_IDEMPOTENCY_CONFLICT', {
    message: 'Bridge identity conflict with different source data.',
    httpStatus: 409,
  }),
  bridgeStateTransition: make('MRA_EIS_BRIDGE_STATE_TRANSITION', {
    message: 'Invalid EIS bridge state transition.',
    httpStatus: 409,
  }),
  bridgeCreation: make('MRA_EIS_BRIDGE_CREATION', {
    message: 'Failed to create EIS sales bridge.',
    httpStatus: 500,
    retryable: true,
  }),
  outboxCreation: make('MRA_EIS_OUTBOX_CREATION', {
    message: 'Failed to create EIS outbox event.',
    httpStatus: 500,
    retryable: true,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_SALES_BRIDGE', {
    message: 'Cross-tenant sales bridge attempt rejected.',
    httpStatus: 403,
  }),
  businessMismatch: make('MRA_EIS_SALES_BUSINESS_CONTEXT_MISMATCH', {
    message: 'Business context mismatch for EIS sales bridge.',
    httpStatus: 403,
  }),
};
