/**
 * Phase 21 — Typed certification / pilot / rollout errors.
 */

import { MraEisControlError } from '../../domain/errors.js';

function make(code, defaults = {}) {
  return (opts = {}) =>
    new MraEisControlError({
      code,
      message: opts.message || defaults.message || code,
      httpStatus: opts.httpStatus ?? defaults.httpStatus ?? 400,
      requiredAction: opts.requiredAction || defaults.requiredAction || null,
      retryable: opts.retryable ?? false,
      ...opts,
    });
}

export const Phase21Errors = {
  releaseGateFailed: make('MRA_EIS_RELEASE_GATE_FAILED', {
    message: 'Production deployment requires a passed Release Gate.',
    httpStatus: 422,
  }),
  certificationNotApproved: make('MRA_EIS_CERTIFICATION_NOT_APPROVED', {
    message: 'MRA certification is not approved for this Product/environment.',
    httpStatus: 422,
  }),
  certificationCondition: make('MRA_EIS_CERTIFICATION_CONDITION', {
    message: 'Action violates an MRA certification condition.',
    httpStatus: 422,
  }),
  productionChangeApproval: make('MRA_EIS_PRODUCTION_CHANGE_APPROVAL', {
    message: 'Approved Production change request is required.',
    httpStatus: 422,
  }),
  artifactMismatch: make('MRA_EIS_RELEASE_ARTIFACT_MISMATCH', {
    message: 'Deployed artifact does not match the tested release.',
    httpStatus: 409,
  }),
  credentialProvisioning: make('MRA_EIS_PRODUCTION_CREDENTIAL_PROVISIONING', {
    message: 'Production credentials must use Secret Provider references only.',
    httpStatus: 403,
  }),
  pilotReadiness: make('MRA_EIS_PILOT_READINESS', {
    message: 'Pilot entry criteria are not met.',
    httpStatus: 422,
  }),
  pilotScope: make('MRA_EIS_PILOT_SCOPE', {
    message: 'Pilot scope must be explicit and approved.',
    httpStatus: 422,
  }),
  pilotGoNoGo: make('MRA_EIS_PILOT_GO_NO_GO', {
    message: 'Pilot Go/No-Go criteria failed.',
    httpStatus: 422,
  }),
  cohortReadiness: make('MRA_EIS_ROLLOUT_COHORT_READINESS', {
    message: 'Cohort readiness checks failed.',
    httpStatus: 422,
  }),
  cohortEnablement: make('MRA_EIS_ROLLOUT_ENABLEMENT', {
    message: 'Cohort enablement blocked.',
    httpStatus: 422,
  }),
  hypercareExit: make('MRA_EIS_HYPERCARE_EXIT', {
    message: 'Hypercare exit criteria are not met.',
    httpStatus: 422,
  }),
  bauHandover: make('MRA_EIS_BAU_HANDOVER', {
    message: 'Business-as-Usual handover requires formal acceptance.',
    httpStatus: 422,
  }),
  historicalTransmissionBlocked: make('MRA_EIS_HISTORICAL_PRODUCTION_TRANSMISSION_BLOCKED', {
    message: 'Historical Sales / Offline Items must never be submitted in Production rollout.',
    httpStatus: 403,
  }),
  environmentMismatch: make('MRA_EIS_PRODUCTION_ENVIRONMENT_MISMATCH', {
    message: 'Sandbox and Production credentials/environments must not mix.',
    httpStatus: 403,
  }),
  autoEnableForbidden: make('MRA_EIS_AUTO_ENABLE_FORBIDDEN', {
    message: 'Tenants and Businesses must not be enabled automatically.',
    httpStatus: 403,
  }),
};
