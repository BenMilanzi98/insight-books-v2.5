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

export const OfflineErrors = {
  capability: make('MRA_EIS_OFFLINE_CAPABILITY', {
    message: 'Offline capability evaluation failed.',
    httpStatus: 422,
  }),
  certificationRequired: make('MRA_EIS_OFFLINE_CERTIFICATION_REQUIRED', {
    message: 'Valid offline certification is required.',
    httpStatus: 422,
  }),
  certificationExpired: make('MRA_EIS_OFFLINE_CERTIFICATION_EXPIRED', {
    message: 'Offline certification has expired.',
    httpStatus: 422,
  }),
  contractUnverified: make('MRA_EIS_OFFLINE_CONTRACT_UNVERIFIED', {
    message: 'Offline contract is unverified for this environment.',
    httpStatus: 422,
  }),
  signatureContract: make('MRA_EIS_OFFLINE_SIGNATURE_CONTRACT', {
    message: 'Offline signature contract is blocked or unverified.',
    httpStatus: 422,
  }),
  receiptContract: make('MRA_EIS_OFFLINE_RECEIPT_CONTRACT', {
    message: 'Offline receipt contract is blocked or unverified.',
    httpStatus: 422,
  }),
  agentNotRegistered: make('MRA_EIS_OFFLINE_AGENT_NOT_REGISTERED', {
    message: 'Trusted offline agent is not registered.',
    httpStatus: 422,
  }),
  agentNotActive: make('MRA_EIS_OFFLINE_AGENT_NOT_ACTIVE', {
    message: 'Trusted offline agent is not active.',
    httpStatus: 422,
  }),
  agentVersionBlocked: make('MRA_EIS_OFFLINE_AGENT_VERSION_BLOCKED', {
    message: 'Agent version is blocked for certification or security.',
    httpStatus: 422,
  }),
  deviceNotTrusted: make('MRA_EIS_OFFLINE_DEVICE_NOT_TRUSTED', {
    message: 'Device is not trusted for offline fiscalization.',
    httpStatus: 422,
  }),
  keyUnavailable: make('MRA_EIS_OFFLINE_KEY_UNAVAILABLE', {
    message: 'Offline signing key is unavailable.',
    httpStatus: 422,
  }),
  keyRevoked: make('MRA_EIS_OFFLINE_KEY_REVOKED', {
    message: 'Offline signing key is revoked.',
    httpStatus: 422,
  }),
  configurationStale: make('MRA_EIS_OFFLINE_CONFIGURATION_STALE', {
    message: 'Offline configuration package is stale or missing.',
    httpStatus: 422,
  }),
  limitExceeded: make('MRA_EIS_OFFLINE_LIMIT_EXCEEDED', {
    message: 'An offline limit has been exceeded.',
    httpStatus: 422,
  }),
  clockUntrusted: make('MRA_EIS_OFFLINE_CLOCK_UNTRUSTED', {
    message: 'Device clock is untrusted for offline Sales.',
    httpStatus: 422,
  }),
  entryNotAllowed: make('MRA_EIS_OFFLINE_ENTRY_NOT_ALLOWED', {
    message: 'Offline entry is not allowed.',
    httpStatus: 422,
  }),
  saleReadiness: make('MRA_EIS_OFFLINE_SALE_READINESS', {
    message: 'Offline Sale readiness failed.',
    httpStatus: 422,
  }),
  sequenceUnavailable: make('MRA_EIS_OFFLINE_SEQUENCE_UNAVAILABLE', {
    message: 'Offline fiscal sequence is unavailable.',
    httpStatus: 422,
  }),
  signatureGeneration: make('MRA_EIS_OFFLINE_SIGNATURE_GENERATION', {
    message: 'Offline signature generation failed or is blocked.',
    httpStatus: 422,
  }),
  signatureVerification: make('MRA_EIS_OFFLINE_SIGNATURE_VERIFICATION', {
    message: 'Offline signature verification failed.',
    httpStatus: 422,
  }),
  queueIntegrity: make('MRA_EIS_OFFLINE_QUEUE_INTEGRITY', {
    message: 'Offline queue integrity check failed.',
    httpStatus: 422,
  }),
  uploadUnknown: make('MRA_EIS_OFFLINE_UPLOAD_UNKNOWN_OUTCOME', {
    message: 'Offline upload outcome is unknown; reconcile before retry.',
    httpStatus: 422,
  }),
  terminalBlocked: make('MRA_EIS_OFFLINE_TERMINAL_BLOCKED', {
    message: 'Terminal is blocked; new offline Sales are stopped.',
    httpStatus: 422,
  }),
  deviceCompromised: make('MRA_EIS_OFFLINE_DEVICE_COMPROMISED', {
    message: 'Device compromise detected; offline operation is blocked.',
    httpStatus: 423,
  }),
  browserProhibited: make('MRA_EIS_OFFLINE_BROWSER_ONLY_PROHIBITED', {
    message: 'Browser-only authoritative offline fiscalization is prohibited.',
    httpStatus: 422,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_OFFLINE_OPERATION', {
    message: 'Cross-tenant offline operation rejected.',
    httpStatus: 403,
  }),
  environmentMismatch: make('MRA_EIS_OFFLINE_ENVIRONMENT_MISMATCH', {
    message: 'Offline environment mismatch.',
    httpStatus: 403,
  }),
  manualReview: make('MRA_EIS_OFFLINE_MANUAL_REVIEW_REQUIRED', {
    message: 'Offline Manual Review is required.',
    httpStatus: 422,
  }),
  tamper: make('MRA_EIS_OFFLINE_TAMPER_DETECTED', {
    message: 'Offline tamper detected; operation blocked.',
    httpStatus: 423,
  }),
};
