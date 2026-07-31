/**
 * Typed Business Setup Wizard errors — safe for API clients.
 */

export class BusinessSetupError extends Error {
  /**
   * @param {string} code
   * @param {string} userMessage
   * @param {object} [options]
   */
  constructor(code, userMessage, options = {}) {
    super(userMessage);
    this.name = new.target.name;
    this.code = code;
    this.userMessage = userMessage;
    this.httpStatus = options.httpStatus ?? 422;
    this.retryable = options.retryable ?? false;
    this.diagnostic = options.diagnostic ?? {};
    this.requestId = options.requestId ?? null;
    this.correlationId = options.correlationId ?? null;
    this.setupRunId = options.setupRunId ?? null;
    this.setupVersion = options.setupVersion ?? null;
    this.stepId = options.stepId ?? null;
  }

  toSafeJSON() {
    return {
      error: this.code,
      message: this.userMessage,
      retryable: this.retryable,
      setupRunId: this.setupRunId,
      setupVersion: this.setupVersion,
      stepId: this.stepId,
      requestId: this.requestId,
      correlationId: this.correlationId,
    };
  }
}

export class BusinessSetupNotFoundError extends BusinessSetupError {
  constructor(options) {
    super('BUSINESS_SETUP_NOT_FOUND', 'Setup run was not found for this business.', {
      httpStatus: 404,
      ...options,
    });
  }
}

export class BusinessSetupAlreadyCompletedError extends BusinessSetupError {
  constructor(options) {
    super('BUSINESS_SETUP_ALREADY_COMPLETED', 'Setup is already completed for this business.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class BusinessSetupVersionConflictError extends BusinessSetupError {
  constructor(options) {
    super(
      'BUSINESS_SETUP_VERSION_CONFLICT',
      'This setup step was changed by another user. Refresh and try again.',
      { httpStatus: 409, retryable: true, ...options }
    );
  }
}

export class ExistingBusinessActivityConflictError extends BusinessSetupError {
  constructor(classification, options) {
    super(
      'EXISTING_BUSINESS_ACTIVITY_CONFLICT',
      'This business has existing financial activity. Use controlled conversion mode with approval.',
      {
        httpStatus: 409,
        diagnostic: { classification },
        ...options,
      }
    );
    this.classification = classification;
  }
}

export class SetupReopenNotAllowedError extends BusinessSetupError {
  constructor(options) {
    super('SETUP_REOPEN_NOT_ALLOWED', 'Setup cannot be reopened with the current permissions or status.', {
      httpStatus: 403,
      ...options,
    });
  }
}

export class InvalidSetupTransitionError extends BusinessSetupError {
  constructor(from, to, options) {
    super(
      'INVALID_SETUP_TRANSITION',
      `Setup cannot change from ${from} to ${to}.`,
      { httpStatus: 422, diagnostic: { from, to }, ...options }
    );
  }
}

export class CrossBusinessSetupDataError extends BusinessSetupError {
  constructor(options) {
    super('CROSS_BUSINESS_SETUP_DATA', 'Setup data belongs to another business.', {
      httpStatus: 403,
      ...options,
    });
  }
}

export class OpeningTrialBalanceOutOfBalanceError extends BusinessSetupError {
  constructor(options) {
    super(
      'OPENING_TRIAL_BALANCE_OUT_OF_BALANCE',
      'Opening Trial Balance debits and credits do not balance. Resolve differences before posting.',
      { httpStatus: 422, ...options }
    );
  }
}

export class SetupApprovalRequiredError extends BusinessSetupError {
  constructor(options) {
    super('SETUP_APPROVAL_REQUIRED', 'Setup must be approved before posting.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class SetupPostingInProgressError extends BusinessSetupError {
  constructor(options) {
    super('SETUP_POSTING_IN_PROGRESS', 'Setup posting is already in progress.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class BusinessSetupAlreadyPostedError extends BusinessSetupError {
  constructor(options) {
    super('BUSINESS_SETUP_ALREADY_POSTED', 'This setup version has already been posted.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class MissingSystemAccountMappingError extends BusinessSetupError {
  constructor(purpose, options) {
    super(
      'MISSING_SYSTEM_ACCOUNT_MAPPING',
      `Required system account mapping "${purpose}" is missing or invalid.`,
      { httpStatus: 422, diagnostic: { purpose }, ...options }
    );
    this.purpose = purpose;
  }
}

export class ControlAccountMismatchError extends BusinessSetupError {
  constructor(control, options) {
    super(
      'CONTROL_ACCOUNT_MISMATCH',
      `Subledger does not reconcile to the ${control} control account.`,
      { httpStatus: 422, diagnostic: { control }, ...options }
    );
  }
}

/**
 * @param {unknown} error
 * @param {string} [fallbackMessage]
 */
export function setupErrorResponse(error, fallbackMessage = 'Setup request failed.') {
  if (error instanceof BusinessSetupError) {
    return {
      status: error.httpStatus,
      body: error.toSafeJSON(),
    };
  }
  console.error('[setupWizard]', fallbackMessage, error);
  return {
    status: 500,
    body: {
      error: 'SETUP_INTERNAL_ERROR',
      message: fallbackMessage,
      retryable: true,
    },
  };
}
