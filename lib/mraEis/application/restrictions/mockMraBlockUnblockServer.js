/**
 * Phase 17 — Deterministic mock MRA block/unblock status server.
 * Synthetic data only. Production live calls remain BLOCKED.
 */

import crypto from 'crypto';

const SCENARIOS = Object.freeze({
  TERMINAL_ACTIVE: {
    httpStatus: 200,
    applicationStatus: 'TERMINAL_ACTIVE',
    normalizedOutcome: 'STILL_BLOCKED', // "active" means not a clearance event for a blocked terminal query path
    blockStatus: 'ACTIVE',
    unblockStatus: 'NOT_APPLICABLE',
  },
  TERMINAL_BLOCKED: {
    httpStatus: 200,
    applicationStatus: 'TERMINAL_BLOCKED',
    normalizedOutcome: 'STILL_BLOCKED',
    blockStatus: 'BLOCKED',
    unblockStatus: 'NONE',
  },
  SITE_BLOCKED: {
    httpStatus: 200,
    applicationStatus: 'SITE_BLOCKED',
    normalizedOutcome: 'STILL_BLOCKED',
    blockStatus: 'SITE_BLOCKED',
  },
  REVIEW_PENDING: {
    httpStatus: 200,
    applicationStatus: 'UNBLOCK_REVIEW_PENDING',
    normalizedOutcome: 'UNBLOCK_REVIEW_PENDING',
    unblockStatus: 'PENDING',
  },
  APPROVED: {
    httpStatus: 200,
    applicationStatus: 'UNBLOCK_APPROVED',
    normalizedOutcome: 'UNBLOCK_APPROVED',
    unblockStatus: 'APPROVED',
  },
  REJECTED: {
    httpStatus: 200,
    applicationStatus: 'UNBLOCK_REJECTED',
    normalizedOutcome: 'UNBLOCK_REJECTED',
    unblockStatus: 'REJECTED',
  },
  TERMINAL_CLEARED: {
    httpStatus: 200,
    applicationStatus: 'TERMINAL_CLEARED',
    normalizedOutcome: 'TERMINAL_CLEARED',
    blockStatus: 'CLEARED',
    unblockStatus: 'CLEARED',
    requiresConfigurationRefresh: false,
    requiresCredentialRefresh: false,
  },
  CLEARED_WITH_CONFIG_REFRESH: {
    httpStatus: 200,
    applicationStatus: 'CLEARANCE_WITH_CONFIGURATION_REFRESH',
    normalizedOutcome: 'CLEARANCE_WITH_CONFIGURATION_REFRESH',
    requiresConfigurationRefresh: true,
  },
  CLEARED_WITH_CREDENTIAL_REFRESH: {
    httpStatus: 200,
    applicationStatus: 'CLEARANCE_WITH_CREDENTIAL_REFRESH',
    normalizedOutcome: 'CLEARANCE_WITH_CREDENTIAL_REFRESH',
    requiresCredentialRefresh: true,
  },
  HTTP_200_WITHOUT_CLEARANCE: {
    httpStatus: 200,
    applicationStatus: 'OK',
    normalizedOutcome: 'STILL_BLOCKED',
    note: 'HTTP 200 alone is not clearance',
  },
  CONFLICT: {
    httpStatus: 200,
    applicationStatus: 'CONFLICTING_STATUS',
    normalizedOutcome: 'EVIDENCE_CONFLICT',
  },
  UNKNOWN_APP_CODE: {
    httpStatus: 200,
    applicationStatus: 'XYZ_UNKNOWN',
    normalizedOutcome: 'CLEARANCE_CONTRACT_UNKNOWN',
  },
  HTTP_401: { httpStatus: 401, applicationStatus: null, normalizedOutcome: 'AUTHENTICATION_FAILURE' },
  HTTP_403: { httpStatus: 403, applicationStatus: null, normalizedOutcome: 'AUTHENTICATION_FAILURE' },
  HTTP_404: {
    httpStatus: 404,
    applicationStatus: null,
    normalizedOutcome: 'UNBLOCK_REQUEST_NOT_FOUND',
  },
  HTTP_429: { httpStatus: 429, applicationStatus: null, normalizedOutcome: 'TEMPORARY_FAILURE' },
  HTTP_500: { httpStatus: 500, applicationStatus: null, normalizedOutcome: 'TEMPORARY_FAILURE' },
  HTTP_503: { httpStatus: 503, applicationStatus: null, normalizedOutcome: 'TEMPORARY_FAILURE' },
  TIMEOUT: { httpStatus: null, applicationStatus: null, normalizedOutcome: 'UNKNOWN_OUTCOME', timedOut: true },
  MALFORMED: {
    httpStatus: 200,
    applicationStatus: null,
    normalizedOutcome: 'MANUAL_REVIEW_REQUIRED',
    malformed: true,
  },
});

export function queryMockUnblockStatus({
  terminalId,
  environment = 'SANDBOX',
  scenario = 'REVIEW_PENDING',
  supportReference = null,
} = {}) {
  const base = SCENARIOS[scenario] || SCENARIOS.REVIEW_PENDING;
  const body = {
    schemaVersion: 'mock-unblock-status-v1',
    terminalId: terminalId || 'MOCK-TERMINAL',
    environment,
    supportReference,
    ...base,
    // never include secrets
    jwt: undefined,
    privateKey: undefined,
    terminalSecret: undefined,
    buyerAuthorizationCode: undefined,
  };
  const responseChecksum = crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return {
    ...body,
    evidenceId: crypto.randomUUID(),
    responseChecksum,
    receivedAt: new Date().toISOString(),
    synthetic: true,
  };
}

export function queryMockBlockStatus({ terminalId, scenario = 'TERMINAL_BLOCKED' } = {}) {
  return queryMockUnblockStatus({ terminalId, scenario });
}

export function listMockUnblockScenarios() {
  return Object.keys(SCENARIOS);
}
