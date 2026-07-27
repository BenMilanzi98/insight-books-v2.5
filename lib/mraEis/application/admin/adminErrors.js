/**
 * Phase 18 — Typed admin / dashboard / export errors.
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

export const AdminErrors = {
  context: make('MRA_EIS_ADMIN_CONTEXT', {
    message: 'EIS admin context is invalid or unauthorized.',
    httpStatus: 403,
  }),
  authorization: make('MRA_EIS_DASHBOARD_AUTHORIZATION', {
    message: 'Not authorized for this EIS dashboard or resource.',
    httpStatus: 403,
  }),
  aggregation: make('MRA_EIS_DASHBOARD_AGGREGATION', {
    message: 'Dashboard aggregation failed.',
    httpStatus: 500,
  }),
  stale: make('MRA_EIS_DASHBOARD_READ_MODEL_STALE', {
    message: 'Read model is stale. Refresh or rebuild projection.',
    httpStatus: 409,
  }),
  partial: make('MRA_EIS_DASHBOARD_PARTIAL_DATA', {
    message: 'Dashboard data is partial. Totals may be incomplete.',
    httpStatus: 206,
  }),
  searchAuth: make('MRA_EIS_SEARCH_AUTHORIZATION', {
    message: 'Search is not authorized for this scope.',
    httpStatus: 403,
  }),
  reportAuth: make('MRA_EIS_REPORT_AUTHORIZATION', {
    message: 'Report access denied.',
    httpStatus: 403,
  }),
  reportRange: make('MRA_EIS_REPORT_RANGE', {
    message: 'Report date range exceeds allowed maximum.',
    httpStatus: 400,
  }),
  exportAuth: make('MRA_EIS_EXPORT_AUTHORIZATION', {
    message: 'Export not authorized.',
    httpStatus: 403,
  }),
  exportExpired: make('MRA_EIS_EXPORT_EXPIRED', {
    message: 'Export download link has expired.',
    httpStatus: 410,
  }),
  restrictedEvidence: make('MRA_EIS_RESTRICTED_EVIDENCE_ACCESS', {
    message: 'Restricted evidence requires elevated permission.',
    httpStatus: 403,
  }),
  commandAuth: make('MRA_EIS_COMMAND_AUTHORIZATION', {
    message: 'Command not authorized.',
    httpStatus: 403,
  }),
  commandState: make('MRA_EIS_COMMAND_STATE_CONFLICT', {
    message: 'Command conflicts with current authoritative state.',
    httpStatus: 409,
  }),
  commandApproval: make('MRA_EIS_COMMAND_APPROVAL_REQUIRED', {
    message: 'Approval is required before this command can execute.',
    httpStatus: 422,
  }),
  commandIdempotency: make('MRA_EIS_COMMAND_IDEMPOTENCY_CONFLICT', {
    message: 'Duplicate command with conflicting payload.',
    httpStatus: 409,
  }),
  crossTenant: make('MRA_EIS_CROSS_TENANT_ADMIN_ACCESS', {
    message: 'Cross-tenant EIS admin access rejected.',
    httpStatus: 403,
  }),
  businessScope: make('MRA_EIS_BUSINESS_SCOPE_ADMIN', {
    message: 'Business scope mismatch.',
    httpStatus: 403,
  }),
  environment: make('MRA_EIS_ENVIRONMENT_SCOPE', {
    message: 'Environment scope invalid or mixed.',
    httpStatus: 403,
  }),
  finalStateForbidden: make('MRA_EIS_FINAL_STATE_MUTATION_FORBIDDEN', {
    message: 'UI cannot set arbitrary final states. Use domain intent commands.',
    httpStatus: 400,
  }),
};
