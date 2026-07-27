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
    });
}

export const RestrictionErrors = {
  operationBlocked: make('MRA_EIS_OPERATION_BLOCKED', {
    message: 'Operation is blocked by an active compliance restriction.',
    httpStatus: 422,
  }),
  terminalMraBlocked: make('MRA_EIS_TERMINAL_MRA_BLOCKED', {
    message: 'Terminal is blocked by MRA. Tenant users cannot clear this restriction.',
    httpStatus: 422,
  }),
  platformPause: make('MRA_EIS_PLATFORM_EMERGENCY_PAUSE', {
    message: 'Platform emergency pause is active.',
    httpStatus: 503,
  }),
  directActiveForbidden: make('MRA_EIS_TERMINAL_DIRECT_ACTIVE_FORBIDDEN', {
    message: 'Terminal cannot be set ACTIVE directly. Use Phase 17 unblock + revalidation.',
    httpStatus: 409,
  }),
  unblockNotPermitted: make('MRA_EIS_UNBLOCK_NOT_PERMITTED', {
    message: 'Unblock is not permitted for this restriction source.',
    httpStatus: 422,
  }),
  unblockAuthorityMismatch: make('MRA_EIS_UNBLOCK_AUTHORITY_MISMATCH', {
    message: 'Clearance authority does not match restriction source.',
    httpStatus: 403,
  }),
  unblockContractUnverified: make('MRA_EIS_UNBLOCK_CONTRACT_UNVERIFIED', {
    message: 'MRA unblock-status contract is unverified for this environment.',
    httpStatus: 422,
  }),
  clearanceNotProven: make('MRA_EIS_UNBLOCK_CLEARANCE_NOT_PROVEN', {
    message: 'Clearance is not proven. HTTP success alone is insufficient.',
    httpStatus: 422,
  }),
  revalidationFailed: make('MRA_EIS_POST_UNBLOCK_REVALIDATION', {
    message: 'Post-unblock revalidation failed.',
    httpStatus: 422,
  }),
  remainingRestriction: make('MRA_EIS_REMAINING_RESTRICTION', {
    message: 'Other active restrictions remain after clearance.',
    httpStatus: 422,
  }),
  idempotencyConflict: make('MRA_EIS_RESTRICTION_IDEMPOTENCY_CONFLICT', {
    message: 'Restriction identity conflict with different evidence.',
    httpStatus: 409,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_RESTRICTION', {
    message: 'Cross-tenant restriction access rejected.',
    httpStatus: 403,
  }),
  environmentMismatch: make('MRA_EIS_RESTRICTION_ENVIRONMENT_MISMATCH', {
    message: 'Restriction environment mismatch.',
    httpStatus: 403,
  }),
  manualReview: make('MRA_EIS_RESTRICTION_MANUAL_REVIEW_REQUIRED', {
    message: 'Restriction Manual Review is required.',
    httpStatus: 422,
  }),
  unblockRequestState: make('MRA_EIS_UNBLOCK_REQUEST_STATE', {
    message: 'Unblock Request is not in a valid state for this action.',
    httpStatus: 409,
  }),
  unblockApprovalRequired: make('MRA_EIS_UNBLOCK_APPROVAL_REQUIRED', {
    message: 'Unblock Request requires approval. Self-approval is prohibited.',
    httpStatus: 422,
  }),
};
