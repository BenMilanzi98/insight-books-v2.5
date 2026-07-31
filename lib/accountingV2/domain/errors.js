/**
 * Accounting V2 — typed error hierarchy.
 *
 * Every error carries a stable machine code, a user-safe message, internal diagnostic
 * context (never serialized to clients), correlation identifiers, and retryability.
 */

export class AccountingV2Error extends Error {
  /**
   * @param {string} code stable machine-readable code
   * @param {string} userMessage safe for end users — must not leak tenant data or SQL
   * @param {object} [options]
   * @param {number} [options.httpStatus]
   * @param {boolean} [options.retryable]
   * @param {object} [options.diagnostic] internal-only context (logged, never returned)
   * @param {string} [options.requestId]
   * @param {string} [options.correlationId]
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
  }

  /** Client-safe serialization — deliberately excludes `diagnostic` and stack. */
  toSafeJSON() {
    return {
      error: this.code,
      message: this.userMessage,
      retryable: this.retryable,
      requestId: this.requestId,
      correlationId: this.correlationId,
    };
  }
}

export class AccountingConfigurationError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('ACCOUNTING_CONFIGURATION_ERROR', userMessage, { httpStatus: 500, ...options });
  }
}

export class MissingAccountMappingError extends AccountingV2Error {
  constructor(mappingKey, options) {
    super(
      'MISSING_ACCOUNT_MAPPING',
      `Required account mapping "${mappingKey}" is not configured for this business.`,
      { httpStatus: 422, ...options }
    );
    this.mappingKey = mappingKey;
  }
}

export class InvalidAccountingPeriodError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('INVALID_ACCOUNTING_PERIOD', userMessage, options);
  }
}

export class ClosedAccountingPeriodError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('CLOSED_ACCOUNTING_PERIOD', userMessage, { httpStatus: 409, ...options });
  }
}

export class UnbalancedJournalError extends AccountingV2Error {
  /** @param {{debitMinor:number, creditMinor:number}} totals */
  constructor(totals, options) {
    super('UNBALANCED_JOURNAL', 'Journal debits and credits do not balance.', {
      httpStatus: 422,
      diagnostic: totals,
      ...options,
    });
    this.debitMinor = totals.debitMinor;
    this.creditMinor = totals.creditMinor;
  }
}

export class DuplicateAccountingEventError extends AccountingV2Error {
  constructor(idempotencyKey, existingEventId, options) {
    super(
      'DUPLICATE_ACCOUNTING_EVENT',
      'This accounting event has already been recorded.',
      { httpStatus: 409, diagnostic: { idempotencyKey, existingEventId }, ...options }
    );
    this.existingEventId = existingEventId;
  }
}

export class ConflictingIdempotencyKeyError extends AccountingV2Error {
  constructor(idempotencyKey, options) {
    super(
      'CONFLICTING_IDEMPOTENCY_KEY',
      'A different accounting command was already submitted with the same identity.',
      { httpStatus: 409, diagnostic: { idempotencyKey }, ...options }
    );
  }
}

export class CrossTenantAccountingError extends AccountingV2Error {
  constructor(options) {
    super(
      'CROSS_TENANT_ACCOUNTING',
      'The referenced accounting record does not belong to this business.',
      { httpStatus: 403, ...options }
    );
  }
}

export class InactiveAccountError extends AccountingV2Error {
  constructor(accountRef, options) {
    super('INACTIVE_ACCOUNT', 'One or more accounts are inactive and cannot receive postings.', {
      diagnostic: { accountRef },
      ...options,
    });
  }
}

export class NonPostingAccountError extends AccountingV2Error {
  constructor(accountRef, options) {
    super(
      'NON_POSTING_ACCOUNT',
      'Postings must target posting-level accounts, not header or retired accounts.',
      { diagnostic: { accountRef }, ...options }
    );
  }
}

export class InvalidCurrencyError extends AccountingV2Error {
  constructor(currency, options) {
    super('INVALID_CURRENCY', `Currency "${currency}" is not permitted for this business.`, options);
  }
}

export class InvalidExchangeRateError extends AccountingV2Error {
  constructor(options) {
    super('INVALID_EXCHANGE_RATE', 'Exchange rate must be a positive decimal value.', options);
  }
}

export class ApprovalRequiredError extends AccountingV2Error {
  constructor(options) {
    super('APPROVAL_REQUIRED', 'This accounting action requires approval before posting.', {
      httpStatus: 403,
      ...options,
    });
  }
}

export class JournalImmutableError extends AccountingV2Error {
  constructor(options) {
    super(
      'JOURNAL_IMMUTABLE',
      'Posted journals are immutable. Use a reversal or adjustment instead.',
      { httpStatus: 409, ...options }
    );
  }
}

export class ReversalNotAllowedError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('REVERSAL_NOT_ALLOWED', userMessage, { httpStatus: 409, ...options });
  }
}

export class SourceTransactionNotFoundError extends AccountingV2Error {
  constructor(options) {
    super('SOURCE_TRANSACTION_NOT_FOUND', 'The source transaction for this accounting event was not found.', {
      httpStatus: 404,
      ...options,
    });
  }
}

export class AccountingConcurrencyError extends AccountingV2Error {
  constructor(options) {
    super('ACCOUNTING_CONCURRENCY', 'The accounting operation conflicted with a concurrent update. Retry safely.', {
      httpStatus: 409,
      retryable: true,
      ...options,
    });
  }
}

export class LegacyArchitectureError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('LEGACY_ARCHITECTURE_ERROR', userMessage, { httpStatus: 502, ...options });
  }
}

export class AccountingValidationError extends AccountingV2Error {
  /** @param {string} userMessage @param {Array<{path:string,message:string}>} issues */
  constructor(userMessage, issues = [], options = {}) {
    super('ACCOUNTING_VALIDATION', userMessage, { httpStatus: 422, diagnostic: { issues }, ...options });
    this.issues = issues;
  }
}

export class PostingDisabledError extends AccountingV2Error {
  constructor(options) {
    super('POSTING_DISABLED', 'Financial posting is currently disabled for this module.', {
      httpStatus: 503,
      ...options,
    });
  }
}

/* ── Phase 4 — posting-engine error catalogue ─────────────────────────────── */

export class InvalidPostingCommandError extends AccountingV2Error {
  /** @param {Array<{path:string,message:string}>} issues */
  constructor(issues = [], options = {}) {
    super('INVALID_POSTING_COMMAND', 'The posting command is invalid.', {
      httpStatus: 422,
      diagnostic: { issues },
      ...options,
    });
    this.issues = issues;
  }
}

export class AccountingContextRequiredError extends AccountingV2Error {
  constructor(options) {
    super('ACCOUNTING_CONTEXT_REQUIRED', 'An authenticated business context is required for posting.', {
      httpStatus: 401,
      ...options,
    });
  }
}

export class SourceNotPostableError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('SOURCE_NOT_POSTABLE', userMessage ?? 'The source transaction is not in a postable state.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class SourceAlreadyPostedError extends AccountingV2Error {
  constructor(options) {
    super('SOURCE_ALREADY_POSTED', 'This source transaction has already been posted for this event.', {
      httpStatus: 409,
      ...options,
    });
  }
}

export class PostingInProgressError extends AccountingV2Error {
  constructor(options) {
    super('POSTING_IN_PROGRESS', 'A posting for this event is already in progress. Retry shortly.', {
      httpStatus: 409,
      retryable: true,
      ...options,
    });
  }
}

export class ApprovalInvalidError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('APPROVAL_INVALID', userMessage ?? 'The supplied approval is not valid for this posting.', {
      httpStatus: 403,
      ...options,
    });
  }
}

export class ConflictingAccountMappingError extends AccountingV2Error {
  constructor(mappingKey, options) {
    super(
      'CONFLICTING_ACCOUNT_MAPPING',
      `Account mapping "${mappingKey}" resolves to conflicting accounts for this context.`,
      { httpStatus: 422, ...options }
    );
    this.mappingKey = mappingKey;
  }
}

export class AccountNotFoundError extends AccountingV2Error {
  constructor(options) {
    super('ACCOUNT_NOT_FOUND', 'A referenced account was not found for this business.', {
      httpStatus: 404,
      ...options,
    });
  }
}

export class DeprecatedAccountError extends AccountingV2Error {
  constructor(accountRef, options) {
    super('DEPRECATED_ACCOUNT', 'Deprecated accounts cannot receive new postings.', {
      diagnostic: { accountRef },
      ...options,
    });
  }
}

export class ControlAccountDimensionError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('CONTROL_ACCOUNT_DIMENSION', userMessage ?? 'This control account requires a subledger dimension.', {
      httpStatus: 422,
      ...options,
    });
  }
}

export class InvalidPostingDateError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('INVALID_POSTING_DATE', userMessage ?? 'The posting date is not valid.', options);
  }
}

export class InvalidJournalLineError extends AccountingV2Error {
  constructor(userMessage, options) {
    super('INVALID_JOURNAL_LINE', userMessage ?? 'A journal line is invalid.', options);
  }
}

export class JournalPersistenceError extends AccountingV2Error {
  constructor(options) {
    super('JOURNAL_PERSISTENCE', 'The journal could not be persisted. No partial posting was kept.', {
      httpStatus: 500,
      retryable: true,
      ...options,
    });
  }
}

export class SourceStateUpdateError extends AccountingV2Error {
  constructor(options) {
    super('SOURCE_STATE_UPDATE', 'The source posting state could not be updated. The posting was rolled back.', {
      httpStatus: 500,
      retryable: true,
      ...options,
    });
  }
}

export class PostingTemplateNotFoundError extends AccountingV2Error {
  constructor(eventType, options) {
    super(
      'POSTING_TEMPLATE_NOT_FOUND',
      `No active posting template supports the event type "${eventType}".`,
      { httpStatus: 422, ...options }
    );
    this.eventType = eventType;
  }
}

export class PostingTemplateValidationError extends AccountingV2Error {
  /** @param {Array<{path:string,message:string}>} issues */
  constructor(issues = [], options = {}) {
    super('POSTING_TEMPLATE_VALIDATION', 'The posting template rejected this command.', {
      httpStatus: 422,
      diagnostic: { issues },
      ...options,
    });
    this.issues = issues;
  }
}

export class LegacyAndNewPostingConflictError extends AccountingV2Error {
  constructor(userMessage, options) {
    super(
      'LEGACY_NEW_POSTING_CONFLICT',
      userMessage ?? 'This event is owned by the new posting engine; the legacy posting path refused it.',
      { httpStatus: 409, ...options }
    );
  }
}

export class ShadowPostingPersistenceError extends AccountingV2Error {
  constructor(options) {
    super('SHADOW_POSTING_PERSISTENCE', 'The shadow posting could not be recorded.', {
      httpStatus: 500,
      retryable: true,
      ...options,
    });
  }
}

/**
 * Classify an unknown error for retry decisions inside the transaction boundary.
 * Business/validation errors are never retryable; only classified transient DB
 * failures are.
 * @param {unknown} err
 * @returns {{retryable: boolean, code: string}}
 */
export function classifyError(err) {
  if (err instanceof AccountingV2Error) {
    return { retryable: err.retryable, code: err.code };
  }
  const code = err && typeof err === 'object' && 'code' in err ? String(err.code) : 'UNKNOWN';
  // Prisma transient failure codes: P2034 (tx conflict/deadlock), P1017 (connection dropped),
  // P2024 (pool timeout). Postgres serialization/deadlock: 40001/40P01.
  const transient = ['P2034', 'P1017', 'P2024', '40001', '40P01'];
  return { retryable: transient.includes(code), code };
}
