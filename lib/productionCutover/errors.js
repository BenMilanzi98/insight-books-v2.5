/**
 * Typed Phase 18 cutover / migration errors.
 */

export class CutoverError extends Error {
  constructor(code, message, extras = {}) {
    super(message);
    this.name = 'CutoverError';
    this.code = code;
    this.retryable = Boolean(extras.retryable);
    this.stopCondition = Boolean(extras.stopCondition);
    this.context = extras.context || {};
    this.status = extras.status || 400;
  }
}

export function backupRequiredError(msg) {
  return new CutoverError('BACKUP_REQUIRED', msg || 'Verified backup required before destructive action.', {
    stopCondition: true,
    status: 409,
  });
}

export function financialControlMismatchError(msg, context) {
  return new CutoverError('FINANCIAL_CONTROL_TOTAL_MISMATCH', msg, {
    stopCondition: true,
    status: 409,
    context,
  });
}

export function trialBalanceMismatchError(msg, context) {
  return new CutoverError('TRIAL_BALANCE_MISMATCH', msg, {
    stopCondition: true,
    status: 409,
    context,
  });
}

export function crossTenantMigrationError(msg, context) {
  return new CutoverError('CROSS_TENANT_MIGRATION', msg, {
    stopCondition: true,
    status: 403,
    context,
  });
}

export function cutoverStopConditionError(msg, context) {
  return new CutoverError('CUTOVER_STOP_CONDITION', msg, {
    stopCondition: true,
    status: 409,
    context,
  });
}

export function goLiveApprovalRequiredError(msg) {
  return new CutoverError('GO_LIVE_APPROVAL_REQUIRED', msg || 'Go-live requires formal approvals.', {
    stopCondition: true,
    status: 403,
  });
}

export function migrationIdempotencyConflictError(msg, context) {
  return new CutoverError('MIGRATION_IDEMPOTENCY_CONFLICT', msg, {
    stopCondition: true,
    status: 409,
    context,
  });
}
