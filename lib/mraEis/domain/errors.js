/** Typed Phase 4 EIS control-plane errors (safe messages only). */

export class MraEisControlError extends Error {
  constructor({
    code,
    message,
    httpStatus = 400,
    tenantId = null,
    businessId = null,
    requestedOperation = null,
    currentStatus = null,
    requiredAction = null,
    retryable = false,
    requestId = null,
    correlationId = null,
    details = null,
  }) {
    super(message);
    this.name = 'MraEisControlError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.tenantId = tenantId;
    this.businessId = businessId;
    this.requestedOperation = requestedOperation;
    this.currentStatus = currentStatus;
    this.requiredAction = requiredAction;
    this.retryable = retryable;
    this.requestId = requestId;
    this.correlationId = correlationId;
    this.details = details;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        tenantId: this.tenantId,
        businessId: this.businessId,
        requestedOperation: this.requestedOperation,
        currentStatus: this.currentStatus,
        requiredAction: this.requiredAction,
        retryable: this.retryable,
        requestId: this.requestId,
        correlationId: this.correlationId,
      },
    };
  }
}

function make(code, defaults = {}) {
  return (opts = {}) =>
    new MraEisControlError({
      code,
      message: opts.message || defaults.message || code,
      httpStatus: opts.httpStatus ?? defaults.httpStatus ?? 400,
      ...opts,
    });
}

export const EisErrors = {
  platformDisabled: make('EIS_PLATFORM_DISABLED', {
    message: 'MRA EIS is disabled on the platform.',
    httpStatus: 503,
  }),
  emergencyPaused: make('EIS_PLATFORM_EMERGENCY_PAUSED', {
    message: 'MRA EIS processing is temporarily paused by the platform.',
    httpStatus: 503,
  }),
  maintenance: make('EIS_PLATFORM_MAINTENANCE', {
    message: 'MRA EIS is in maintenance mode.',
    httpStatus: 503,
  }),
  notEntitled: make('TENANT_NOT_ENTITLED', {
    message: 'This tenant is not entitled to MRA EIS.',
    httpStatus: 403,
  }),
  entitlementPending: make('TENANT_ENTITLEMENT_PENDING', {
    message: 'EIS entitlement is pending review.',
    httpStatus: 403,
  }),
  entitlementSuspended: make('TENANT_ENTITLEMENT_SUSPENDED', {
    message: 'EIS entitlement is suspended.',
    httpStatus: 403,
  }),
  entitlementRevoked: make('TENANT_ENTITLEMENT_REVOKED', {
    message: 'EIS entitlement has been revoked.',
    httpStatus: 403,
  }),
  entitlementExpired: make('TENANT_ENTITLEMENT_EXPIRED', {
    message: 'EIS entitlement has expired.',
    httpStatus: 403,
  }),
  environmentNotAuthorized: make('ENVIRONMENT_NOT_AUTHORIZED', {
    message: 'Requested EIS environment is not authorized for this tenant.',
    httpStatus: 403,
  }),
  productionNotAuthorized: make('PRODUCTION_NOT_AUTHORIZED', {
    message: 'Production EIS is not authorized for this tenant.',
    httpStatus: 403,
  }),
  certificationRequired: make('CERTIFICATION_REQUIRED', {
    message: 'Valid EIS certification is required for this action.',
    httpStatus: 403,
  }),
  notParticipating: make('TENANT_NOT_PARTICIPATING', {
    message: 'Tenant has not opted into EIS participation.',
    httpStatus: 403,
  }),
  participationPaused: make('TENANT_OPERATION_PAUSED', {
    message: 'Tenant EIS participation is paused.',
    httpStatus: 403,
  }),
  businessDisabled: make('BUSINESS_OPERATION_DISABLED', {
    message: 'Business EIS operation is disabled.',
    httpStatus: 403,
  }),
  businessPaused: make('BUSINESS_OPERATION_PAUSED', {
    message: 'Business EIS operation is paused.',
    httpStatus: 403,
  }),
  setupRequired: make('BUSINESS_SETUP_REQUIRED', {
    message: 'EIS setup must be completed before this action.',
    httpStatus: 409,
  }),
  invalidTransition: make('INVALID_STATE_TRANSITION', {
    message: 'The requested EIS control transition is not allowed.',
    httpStatus: 409,
  }),
  approvalRequired: make('APPROVAL_REQUIRED', {
    message: 'This EIS control change requires approval.',
    httpStatus: 409,
  }),
  staleApproval: make('STALE_APPROVAL', {
    message: 'The approval is no longer valid for the current control state.',
    httpStatus: 409,
  }),
  versionConflict: make('VERSION_CONFLICT', {
    message: 'The EIS control record was modified by another request. Retry with the latest version.',
    httpStatus: 409,
  }),
  disablementBlocked: make('DISABLEMENT_BLOCKED', {
    message: 'Disablement is blocked until queue-drain or reconciliation conditions are met.',
    httpStatus: 409,
  }),
  crossTenant: make('CROSS_TENANT_ACCESS', {
    message: 'Cross-tenant EIS access is prohibited.',
    httpStatus: 403,
  }),
  businessMismatch: make('BUSINESS_CONTEXT_MISMATCH', {
    message: 'Business context does not match the tenant.',
    httpStatus: 403,
  }),
  permissionDenied: make('PERMISSION_DENIED', {
    message: 'You do not have permission for this EIS control action.',
    httpStatus: 403,
  }),
  featureFlagDisabled: make('FEATURE_FLAG_DISABLED', {
    message: 'This EIS feature flag is disabled.',
    httpStatus: 403,
  }),
  reasonRequired: make('REASON_REQUIRED', {
    message: 'A reason is required for this EIS control action.',
    httpStatus: 400,
  }),
  idempotencyConflict: make('IDEMPOTENCY_CONFLICT', {
    message: 'Idempotency key reused with a different payload.',
    httpStatus: 409,
  }),
  validation: make('VALIDATION_ERROR', {
    message: 'Invalid EIS control input.',
    httpStatus: 400,
  }),
  selfEntitlement: make('SELF_ENTITLEMENT_FORBIDDEN', {
    message: 'A tenant cannot grant its own EIS entitlement.',
    httpStatus: 403,
  }),
  revokedCannotResume: make('REVOKED_CANNOT_RESUME', {
    message: 'A revoked entitlement cannot be resumed. Grant a new entitlement version.',
    httpStatus: 409,
  }),
  // Phase 5 operational errors
  terminalNotFound: make('TERMINAL_NOT_FOUND', {
    message: 'EIS terminal was not found in this Business scope.',
    httpStatus: 404,
  }),
  invalidTerminalTransition: make('INVALID_TERMINAL_TRANSITION', {
    message: 'Invalid terminal state transition.',
    httpStatus: 409,
  }),
  snapshotImmutable: make('SNAPSHOT_IMMUTABLE', {
    message: 'Queued fiscal snapshots cannot be modified.',
    httpStatus: 409,
  }),
  snapshotConflict: make('SNAPSHOT_CHECKSUM_CONFLICT', {
    message: 'Snapshot identity exists with a different checksum.',
    httpStatus: 409,
  }),
  transmissionAccepted: make('TRANSMISSION_ALREADY_ACCEPTED', {
    message: 'Accepted transmission cannot regress to a sending state.',
    httpStatus: 409,
  }),
  unknownOutcomeRetry: make('UNKNOWN_OUTCOME_REQUIRES_RECONCILIATION', {
    message: 'Unknown outcomes must be reconciled before ordinary retry.',
    httpStatus: 409,
  }),
  claimConflict: make('TRANSMISSION_CLAIM_CONFLICT', {
    message: 'Transmission claim conflict.',
    httpStatus: 409,
  }),
  offlineNotCertified: make('OFFLINE_NOT_CERTIFIED', {
    message: 'Offline queue entries cannot be created without offline certification.',
    httpStatus: 403,
  }),
  deleteProhibited: make('DELETE_PROHIBITED', {
    message: 'Ordinary deletion of fiscal evidence is prohibited.',
    httpStatus: 403,
  }),
  fiscalSequenceConflict: make('FISCAL_SEQUENCE_CONFLICT', {
    message: 'Fiscal sequence allocation conflict.',
    httpStatus: 409,
  }),
  vat5QuantityConflict: make('VAT5_QUANTITY_CONFLICT', {
    message: 'VAT5 reserved/consumed quantity exceeds eligible quantity.',
    httpStatus: 409,
  }),
  outboxConflict: make('OUTBOX_CONFLICT', {
    message: 'Outbox idempotency conflict.',
    httpStatus: 409,
  }),
  configurationVersionConflict: make('CONFIGURATION_VERSION_CONFLICT', {
    message: 'Configuration version exists with a different checksum.',
    httpStatus: 409,
  }),
  configurationActivationConflict: make('CONFIGURATION_ACTIVATION_CONFLICT', {
    message: 'Configuration cannot be activated from the current status.',
    httpStatus: 409,
  }),
  siteMappingConflict: make('SITE_MAPPING_CONFLICT', {
    message: 'Site mapping conflict or overlapping active period.',
    httpStatus: 409,
  }),
  productMappingConflict: make('PRODUCT_MAPPING_CONFLICT', {
    message: 'Product/service mapping conflict.',
    httpStatus: 409,
  }),
  taxMappingConflict: make('TAX_MAPPING_CONFLICT', {
    message: 'Tax mapping conflict.',
    httpStatus: 409,
  }),
  paymentMappingConflict: make('PAYMENT_MAPPING_CONFLICT', {
    message: 'Payment-method mapping conflict.',
    httpStatus: 409,
  }),
  reconciliationScope: make('RECONCILIATION_SCOPE_ERROR', {
    message: 'Reconciliation record is outside the Business scope.',
    httpStatus: 403,
  }),
  retentionViolation: make('RETENTION_VIOLATION', {
    message: 'Retention or legal-hold policy prohibits this action.',
    httpStatus: 403,
  }),
};

export function isMraEisControlError(err) {
  return err instanceof MraEisControlError;
}
