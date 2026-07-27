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

export const FiscalSnapshotErrors = {
  readiness: make('MRA_EIS_FISCAL_SNAPSHOT_READINESS', {
    message: 'Fiscal snapshot readiness failed.',
    httpStatus: 422,
  }),
  alreadyExists: make('MRA_EIS_FISCAL_SNAPSHOT_ALREADY_EXISTS', {
    message: 'A completed fiscal snapshot already exists for this bridge.',
    httpStatus: 409,
  }),
  idempotencyConflict: make('MRA_EIS_FISCAL_SNAPSHOT_IDEMPOTENCY_CONFLICT', {
    message: 'Snapshot identity conflict with different source checksum.',
    httpStatus: 409,
  }),
  state: make('MRA_EIS_FISCAL_SNAPSHOT_STATE', {
    message: 'Invalid fiscal snapshot state transition.',
    httpStatus: 409,
  }),
  sourceIdentity: make('MRA_EIS_SOURCE_FINALIZATION_IDENTITY_MISMATCH', {
    message: 'Source finalization identity does not match bridge evidence.',
    httpStatus: 422,
  }),
  sourceVersion: make('MRA_EIS_SOURCE_VERSION_MISMATCH', {
    message: 'Source version does not match eligibility evidence.',
    httpStatus: 422,
  }),
  sourceChecksum: make('MRA_EIS_SOURCE_CHECKSUM_MISMATCH', {
    message: 'Source checksum mismatch — material change detected.',
    httpStatus: 422,
  }),
  sourceChanged: make('MRA_EIS_SOURCE_MATERIALLY_CHANGED', {
    message: 'Source transaction materially changed after bridge eligibility.',
    httpStatus: 422,
  }),
  accountingMissing: make('MRA_EIS_ACCOUNTING_POSTING_EVIDENCE_MISSING', {
    message: 'Required accounting posting evidence is missing.',
    httpStatus: 422,
  }),
  inventoryMissing: make('MRA_EIS_INVENTORY_POSTING_EVIDENCE_MISSING', {
    message: 'Required inventory posting evidence is missing.',
    httpStatus: 422,
  }),
  totals: make('MRA_EIS_FISCAL_TOTALS_MISMATCH', {
    message: 'Fiscal snapshot totals do not reconcile.',
    httpStatus: 422,
  }),
  checksum: make('MRA_EIS_SNAPSHOT_CHECKSUM_MISMATCH', {
    message: 'Fiscal snapshot integrity checksum mismatch.',
    httpStatus: 500,
  }),
  numberContract: make('MRA_EIS_FISCAL_NUMBER_CONTRACT_UNVERIFIED', {
    message: 'Fiscal-number contract is unverified for this environment.',
    httpStatus: 422,
  }),
  scopeAmbiguous: make('MRA_EIS_FISCAL_NUMBER_SCOPE_AMBIGUOUS', {
    message: 'Fiscal-number scope is ambiguous.',
    httpStatus: 422,
  }),
  sequenceUninit: make('MRA_EIS_FISCAL_SEQUENCE_UNINITIALIZED', {
    message: 'Fiscal sequence is not initialized from verified evidence.',
    httpStatus: 422,
  }),
  sequencePaused: make('MRA_EIS_FISCAL_SEQUENCE_PAUSED', {
    message: 'Fiscal sequence is paused.',
    httpStatus: 422,
  }),
  reservationConflict: make('MRA_EIS_FISCAL_NUMBER_RESERVATION_CONFLICT', {
    message: 'Fiscal number reservation conflict.',
    httpStatus: 409,
  }),
  duplicateNumber: make('MRA_EIS_DUPLICATE_FISCAL_NUMBER', {
    message: 'Duplicate fiscal number detected.',
    httpStatus: 409,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_FISCAL_SNAPSHOT', {
    message: 'Cross-tenant fiscal snapshot attempt rejected.',
    httpStatus: 403,
  }),
  immutable: make('MRA_EIS_FISCAL_SNAPSHOT_IMMUTABLE', {
    message: 'Completed fiscal snapshots cannot be modified.',
    httpStatus: 403,
  }),
  manualReview: make('MRA_EIS_SNAPSHOT_MANUAL_REVIEW_REQUIRED', {
    message: 'Fiscal snapshot requires manual review.',
    httpStatus: 422,
  }),
};
