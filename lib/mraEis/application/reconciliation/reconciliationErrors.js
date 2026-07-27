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

export const ReconciliationErrors = {
  readiness: make('MRA_EIS_RECONCILIATION_READINESS', {
    message: 'Reconciliation readiness failed.',
    httpStatus: 422,
  }),
  contractUnverified: make('MRA_EIS_RECONCILIATION_CONTRACT_UNVERIFIED', {
    message: 'Reconciliation contract unverified for this environment.',
    httpStatus: 422,
  }),
  alreadyExists: make('MRA_EIS_RECONCILIATION_ALREADY_EXISTS', {
    message: 'An active reconciliation case already exists for this trigger.',
    httpStatus: 409,
  }),
  idempotencyConflict: make('MRA_EIS_RECONCILIATION_IDEMPOTENCY_CONFLICT', {
    message: 'Reconciliation identity conflict with different evidence.',
    httpStatus: 409,
  }),
  state: make('MRA_EIS_RECONCILIATION_STATE', {
    message: 'Invalid reconciliation state transition.',
    httpStatus: 409,
  }),
  localEvidenceInvalid: make('MRA_EIS_LOCAL_EVIDENCE_INVALID', {
    message: 'Local reconciliation evidence is invalid or inconsistent.',
    httpStatus: 422,
  }),
  dispatchCertaintyUnknown: make('MRA_EIS_DISPATCH_CERTAINTY_UNKNOWN', {
    message: 'Dispatch certainty is ambiguous; reconcile before retry.',
    httpStatus: 422,
  }),
  lastOnlineQuery: make('MRA_EIS_LAST_ONLINE_TRANSACTION_QUERY', {
    message: 'Last Online Transaction query failed or is blocked.',
    httpStatus: 422,
  }),
  lastOfflineQuery: make('MRA_EIS_LAST_OFFLINE_TRANSACTION_QUERY', {
    message: 'Last Offline Transaction query failed or is blocked.',
    httpStatus: 422,
  }),
  responseParsing: make('MRA_EIS_RECONCILIATION_RESPONSE_PARSING', {
    message: 'Reconciliation response could not be parsed.',
    httpStatus: 422,
  }),
  evidenceConflict: make('MRA_EIS_RECONCILIATION_EVIDENCE_CONFLICT', {
    message: 'Local and MRA evidence conflict.',
    httpStatus: 422,
  }),
  matchInsufficient: make('MRA_EIS_TRANSACTION_MATCH_INSUFFICIENT', {
    message: 'Match evidence is insufficient for conclusive recovery.',
    httpStatus: 422,
  }),
  acceptanceNotProven: make('MRA_EIS_ACCEPTANCE_RECOVERY_NOT_PROVEN', {
    message: 'Acceptance recovery requires conclusive MRA evidence.',
    httpStatus: 422,
  }),
  rejectionNotProven: make('MRA_EIS_REJECTION_RECOVERY_NOT_PROVEN', {
    message: 'Rejection recovery requires conclusive MRA evidence.',
    httpStatus: 422,
  }),
  stillUnknown: make('MRA_EIS_TRANSACTION_STILL_UNKNOWN', {
    message: 'Outcome remains unknown; retry is not permitted.',
    httpStatus: 422,
  }),
  duplicateConflict: make('MRA_EIS_DUPLICATE_OUTCOME_CONFLICT', {
    message: 'Duplicate outcome requires manual review.',
    httpStatus: 422,
  }),
  retryNotAuthorized: make('MRA_EIS_SAFE_RETRY_NOT_AUTHORIZED', {
    message: 'Safe retry is not authorized for this transmission.',
    httpStatus: 422,
  }),
  retryAuthExpired: make('MRA_EIS_RETRY_AUTHORIZATION_EXPIRED', {
    message: 'Retry authorization has expired.',
    httpStatus: 422,
  }),
  retryLimit: make('MRA_EIS_RETRY_ATTEMPT_LIMIT_EXCEEDED', {
    message: 'Retry attempt limit exceeded.',
    httpStatus: 422,
  }),
  retryWindow: make('MRA_EIS_RETRY_WINDOW_EXPIRED', {
    message: 'Retry window has expired.',
    httpStatus: 422,
  }),
  activeAttempt: make('MRA_EIS_RETRY_ACTIVE_ATTEMPT', {
    message: 'An active submission attempt already exists.',
    httpStatus: 409,
  }),
  terminalBlocked: make('MRA_EIS_RETRY_TERMINAL_BLOCKED', {
    message: 'Terminal is blocked; retry is not permitted.',
    httpStatus: 422,
  }),
  configNotReady: make('MRA_EIS_RETRY_CONFIGURATION_NOT_READY', {
    message: 'Configuration refresh required before retry.',
    httpStatus: 422,
  }),
  credentialNotReady: make('MRA_EIS_RETRY_CREDENTIAL_NOT_READY', {
    message: 'Credential remediation required before retry.',
    httpStatus: 422,
  }),
  circuitOpen: make('MRA_EIS_RETRY_CIRCUIT_BREAKER_OPEN', {
    message: 'Circuit breaker is open; ordinary retries are paused.',
    httpStatus: 503,
    retryable: true,
  }),
  sequence: make('MRA_EIS_SEQUENCE_RECONCILIATION', {
    message: 'Fiscal sequence reconciliation failed.',
    httpStatus: 422,
  }),
  sequenceMraAhead: make('MRA_EIS_SEQUENCE_MRA_AHEAD', {
    message: 'MRA sequence is ahead of local evidence.',
    httpStatus: 422,
  }),
  sequenceLocalAhead: make('MRA_EIS_SEQUENCE_LOCAL_AHEAD', {
    message: 'Local sequence is ahead of MRA evidence.',
    httpStatus: 422,
  }),
  sequenceAdjustDenied: make('MRA_EIS_SEQUENCE_ADJUSTMENT_NOT_ALLOWED', {
    message: 'Sequence adjustment is not allowed.',
    httpStatus: 403,
  }),
  missingResponse: make('MRA_EIS_MISSING_RESPONSE_RECOVERY', {
    message: 'Missing response evidence recovery failed.',
    httpStatus: 422,
  }),
  missingEvent: make('MRA_EIS_MISSING_EVENT_RECOVERY', {
    message: 'Missing outbox event recovery failed.',
    httpStatus: 422,
  }),
  missingReceipt: make('MRA_EIS_MISSING_RECEIPT_RECOVERY', {
    message: 'Missing fiscal receipt recovery failed.',
    httpStatus: 422,
  }),
  deadLetter: make('MRA_EIS_DEAD_LETTER_RECOVERY', {
    message: 'Dead-letter recovery requires policy evaluation.',
    httpStatus: 422,
  }),
  manualReview: make('MRA_EIS_MANUAL_REVIEW_REQUIRED', {
    message: 'Manual review is required.',
    httpStatus: 422,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_RECONCILIATION', {
    message: 'Cross-tenant reconciliation access denied.',
    httpStatus: 403,
  }),
  businessMismatch: make('MRA_EIS_RECONCILIATION_BUSINESS_CONTEXT_MISMATCH', {
    message: 'Reconciliation business context mismatch.',
    httpStatus: 403,
  }),
  environmentMismatch: make('MRA_EIS_RECONCILIATION_ENVIRONMENT_MISMATCH', {
    message: 'Reconciliation environment mismatch.',
    httpStatus: 422,
  }),
};
