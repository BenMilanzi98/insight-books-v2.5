/**
 * Phase 19 — Typed migration errors.
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
    });
}

export const MigrationErrors = {
  source: make('MRA_EIS_MIGRATION_SOURCE', { message: 'Migration source error.' }),
  sourceReadOnly: make('MRA_EIS_MIGRATION_SOURCE_READ_ONLY', {
    message: 'Source access must be read-only.',
    httpStatus: 403,
  }),
  sourceChecksum: make('MRA_EIS_MIGRATION_SOURCE_CHECKSUM', {
    message: 'Source checksum mismatch. Re-profile and re-run Dry Run.',
    httpStatus: 409,
  }),
  ownership: make('MRA_EIS_MIGRATION_OWNERSHIP', {
    message: 'Ownership could not be proven. Quarantine / Manual Review required.',
    httpStatus: 422,
  }),
  crossTenant: make('MRA_EIS_MIGRATION_CROSS_TENANT', {
    message: 'Cross-tenant migration conflict blocked.',
    httpStatus: 403,
  }),
  environment: make('MRA_EIS_MIGRATION_ENVIRONMENT', {
    message: 'Environment classification conflict or unknown.',
    httpStatus: 422,
  }),
  duplicate: make('MRA_EIS_MIGRATION_DUPLICATE', {
    message: 'Duplicate fiscal or source identity conflict.',
    httpStatus: 409,
  }),
  fiscalConflict: make('MRA_EIS_MIGRATION_FISCAL_NUMBER_CONFLICT', {
    message: 'Fiscal-number conflict. Quarantine required.',
    httpStatus: 409,
  }),
  accountingMismatch: make('MRA_EIS_MIGRATION_ACCOUNTING_MISMATCH', {
    message: 'Accounting linkage mismatch.',
    httpStatus: 422,
  }),
  inventoryMismatch: make('MRA_EIS_MIGRATION_INVENTORY_MISMATCH', {
    message: 'Inventory linkage mismatch.',
    httpStatus: 422,
  }),
  credentialLeak: make('MRA_EIS_MIGRATION_CREDENTIAL_LEAK', {
    message: 'Credential or secret material detected. Migration blocked.',
    httpStatus: 403,
  }),
  dryRunRequired: make('MRA_EIS_MIGRATION_DRY_RUN_REQUIRED', {
    message: 'Approved Dry Run required before Production migration.',
    httpStatus: 422,
  }),
  approvalRequired: make('MRA_EIS_MIGRATION_APPROVAL_REQUIRED', {
    message: 'Production migration requires approval.',
    httpStatus: 422,
  }),
  historicalTransmissionBlocked: make('MRA_EIS_HISTORICAL_TRANSMISSION_BLOCKED', {
    message: 'Historical Sales must never be submitted or uploaded during migration.',
    httpStatus: 403,
  }),
  rollbackNotAllowed: make('MRA_EIS_MIGRATION_ROLLBACK_NOT_ALLOWED', {
    message: 'Rollback blocked: dependent operational activity or non-migration records.',
    httpStatus: 409,
  }),
  idempotency: make('MRA_EIS_MIGRATION_IDEMPOTENCY_CONFLICT', {
    message: 'Migration idempotency conflict.',
    httpStatus: 409,
  }),
  state: make('MRA_EIS_MIGRATION_STATE', {
    message: 'Invalid migration run state for this action.',
    httpStatus: 409,
  }),
  quarantine: make('MRA_EIS_MIGRATION_QUARANTINE', {
    message: 'Record is quarantined and cannot become operational automatically.',
    httpStatus: 422,
  }),
  manualReview: make('MRA_EIS_MIGRATION_MANUAL_REVIEW_REQUIRED', {
    message: 'Manual Review is required.',
    httpStatus: 422,
  }),
  hookIsolation: make('MRA_EIS_MIGRATION_HOOK_ISOLATION', {
    message: 'Migration context forbids financial, Inventory, transmission and receipt hooks.',
    httpStatus: 403,
  }),
};
