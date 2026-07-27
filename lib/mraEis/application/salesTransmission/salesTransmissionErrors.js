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

export const SalesTransmissionErrors = {
  readiness: make('MRA_EIS_ONLINE_TRANSMISSION_READINESS', {
    message: 'Online Sales transmission readiness failed.',
    httpStatus: 422,
  }),
  contractUnverified: make('MRA_EIS_SALES_CONTRACT_UNVERIFIED', {
    message: 'Sales endpoint contract is unverified for this environment.',
    httpStatus: 422,
  }),
  integrity: make('MRA_EIS_FISCAL_SNAPSHOT_INTEGRITY', {
    message: 'Fiscal snapshot integrity verification failed.',
    httpStatus: 422,
  }),
  alreadyAccepted: make('MRA_EIS_TRANSMISSION_ALREADY_ACCEPTED', {
    message: 'Transmission already accepted — resubmission prohibited.',
    httpStatus: 409,
  }),
  inProgress: make('MRA_EIS_TRANSMISSION_ALREADY_IN_PROGRESS', {
    message: 'Transmission already in progress.',
    httpStatus: 409,
  }),
  payloadValidation: make('MRA_EIS_SALES_PAYLOAD_VALIDATION', {
    message: 'Sales payload validation failed.',
    httpStatus: 422,
  }),
  payloadMapping: make('MRA_EIS_SALES_PAYLOAD_MAPPING', {
    message: 'Sales payload mapping failed.',
    httpStatus: 422,
  }),
  requestHash: make('MRA_EIS_SALES_REQUEST_HASH', {
    message: 'Request message hash could not be generated under verified contract.',
    httpStatus: 422,
  }),
  credential: make('MRA_EIS_TERMINAL_CREDENTIAL_UNAVAILABLE', {
    message: 'Terminal JWT credential unavailable.',
    httpStatus: 422,
  }),
  unknownOutcome: make('MRA_EIS_SALES_UNKNOWN_OUTCOME', {
    message: 'Sales submission outcome is unknown — reconcile before retry.',
    httpStatus: 409,
    retryable: false,
  }),
  retryNotSafe: make('MRA_EIS_SALES_RETRY_NOT_SAFE', {
    message: 'Retry is not safe for this transmission outcome.',
    httpStatus: 409,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_SALES_TRANSMISSION', {
    message: 'Cross-tenant sales transmission rejected.',
    httpStatus: 403,
  }),
  environment: make('MRA_EIS_SALES_TRANSMISSION_ENVIRONMENT_MISMATCH', {
    message: 'Snapshot and terminal environments do not match.',
    httpStatus: 422,
  }),
  rejected: make('MRA_EIS_SALES_REJECTED', {
    message: 'Sale rejected by MRA application status.',
    httpStatus: 422,
  }),
  vat5: make('MRA_EIS_VAT5_SUBMISSION_BLOCKED', {
    message: 'VAT5 submission blocked until validation contract verified.',
    httpStatus: 422,
  }),
};
