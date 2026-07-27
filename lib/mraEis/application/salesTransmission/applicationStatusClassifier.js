/**
 * Separate HTTP transport classification from MRA application status — Phase 13.
 * HTTP 200 alone is never acceptance.
 */

export const CLASSIFIER_VERSION = 'phase13-app-status-classifier-v1';

export const TRANSPORT_CLASS = Object.freeze({
  HTTP_SUCCESS: 'HTTP_SUCCESS',
  CLIENT_AUTHENTICATION_ERROR: 'CLIENT_AUTHENTICATION_ERROR',
  CLIENT_CONTRACT_ERROR: 'CLIENT_CONTRACT_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  TEMPORARY_SERVER_ERROR: 'TEMPORARY_SERVER_ERROR',
  NO_RESPONSE: 'NO_RESPONSE',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_FAILURE: 'CONNECTION_FAILURE',
  INVALID_CONTENT_TYPE: 'INVALID_CONTENT_TYPE',
  RESPONSE_TOO_LARGE: 'RESPONSE_TOO_LARGE',
  UNKNOWN_TRANSPORT_OUTCOME: 'UNKNOWN_TRANSPORT_OUTCOME',
});

export const APP_OUTCOME = Object.freeze({
  ACCEPTED: 'ACCEPTED',
  ACCEPTED_WITH_CONFIGURATION_REFRESH: 'ACCEPTED_WITH_CONFIGURATION_REFRESH',
  ACCEPTED_WITH_TERMINAL_BLOCK: 'ACCEPTED_WITH_TERMINAL_BLOCK',
  REJECTED_VALIDATION: 'REJECTED_VALIDATION',
  REJECTED_BUSINESS_RULE: 'REJECTED_BUSINESS_RULE',
  REJECTED_DUPLICATE: 'REJECTED_DUPLICATE',
  REJECTED_AUTHENTICATION: 'REJECTED_AUTHENTICATION',
  TEMPORARY_MRA_FAILURE: 'TEMPORARY_MRA_FAILURE',
  CONFIGURATION_REFRESH_REQUIRED: 'CONFIGURATION_REFRESH_REQUIRED',
  TERMINAL_BLOCKED: 'TERMINAL_BLOCKED',
  CONTRACT_MISMATCH: 'CONTRACT_MISMATCH',
  UNKNOWN_APPLICATION_STATUS: 'UNKNOWN_APPLICATION_STATUS',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export const RETRY_CLASS = Object.freeze({
  SAFE_RETRY_BEFORE_DISPATCH: 'SAFE_RETRY_BEFORE_DISPATCH',
  RECONCILE_BEFORE_RETRY: 'RECONCILE_BEFORE_RETRY',
  DO_NOT_RETRY_REJECTED: 'DO_NOT_RETRY_REJECTED',
  DO_NOT_RETRY_ACCEPTED: 'DO_NOT_RETRY_ACCEPTED',
  DO_NOT_RETRY_TERMINAL_BLOCKED: 'DO_NOT_RETRY_TERMINAL_BLOCKED',
  DO_NOT_RETRY_CONTRACT_ERROR: 'DO_NOT_RETRY_CONTRACT_ERROR',
  MANUAL_REVIEW_REQUIRED: 'MANUAL_REVIEW_REQUIRED',
  RETRY_AFTER_RATE_LIMIT: 'RETRY_AFTER_RATE_LIMIT',
  RETRY_AFTER_CREDENTIAL_REMEDIATION: 'RETRY_AFTER_CREDENTIAL_REMEDIATION',
});

export function classifyHttpTransport({
  httpStatus = null,
  contentType = null,
  responseByteLength = 0,
  maxResponseBytes = 512000,
  errorKind = null,
} = {}) {
  if (errorKind === 'TIMEOUT') return TRANSPORT_CLASS.TIMEOUT;
  if (errorKind === 'CONNECTION') return TRANSPORT_CLASS.CONNECTION_FAILURE;
  if (errorKind === 'NO_RESPONSE') return TRANSPORT_CLASS.NO_RESPONSE;
  if (httpStatus == null) return TRANSPORT_CLASS.UNKNOWN_TRANSPORT_OUTCOME;
  if (responseByteLength > maxResponseBytes) return TRANSPORT_CLASS.RESPONSE_TOO_LARGE;
  if (httpStatus === 401 || httpStatus === 403) return TRANSPORT_CLASS.CLIENT_AUTHENTICATION_ERROR;
  if (httpStatus === 429) return TRANSPORT_CLASS.RATE_LIMITED;
  if (httpStatus >= 500) return TRANSPORT_CLASS.TEMPORARY_SERVER_ERROR;
  if (httpStatus >= 400) return TRANSPORT_CLASS.CLIENT_CONTRACT_ERROR;
  if (httpStatus >= 200 && httpStatus < 300) {
    if (contentType && !String(contentType).includes('application/json')) {
      return TRANSPORT_CLASS.INVALID_CONTENT_TYPE;
    }
    return TRANSPORT_CLASS.HTTP_SUCCESS;
  }
  return TRANSPORT_CLASS.UNKNOWN_TRANSPORT_OUTCOME;
}

/**
 * Classify application outcome using contract accepted/rejected lists.
 * Empty accepted lists → fail closed (UNKNOWN) except mock provisional.
 */
export function classifyApplicationStatus({
  body = null,
  contract = null,
  transportClass,
} = {}) {
  const refresh =
    Boolean(body?.shouldRefreshConfiguration) || Boolean(body?.refreshConfiguration);
  const block = Boolean(body?.shouldBlockTerminal) || Boolean(body?.blockTerminal);
  const statusRaw = body?.[contract?.applicationStatusField || 'responseCode'];
  const status = statusRaw == null ? null : String(statusRaw);
  const mraTransactionId =
    body?.mraTransactionId || body?.transactionId || body?.externalTransactionId || null;
  const validationUrl = body?.validationUrl || null;
  const qrData = body?.qrData || null;
  const remark = body?.remark || body?.message || null;

  if (transportClass !== TRANSPORT_CLASS.HTTP_SUCCESS) {
    let outcome = APP_OUTCOME.UNKNOWN_APPLICATION_STATUS;
    let retry = RETRY_CLASS.RECONCILE_BEFORE_RETRY;
    if (transportClass === TRANSPORT_CLASS.CLIENT_AUTHENTICATION_ERROR) {
      outcome = APP_OUTCOME.REJECTED_AUTHENTICATION;
      retry = RETRY_CLASS.RETRY_AFTER_CREDENTIAL_REMEDIATION;
    } else if (transportClass === TRANSPORT_CLASS.RATE_LIMITED) {
      outcome = APP_OUTCOME.TEMPORARY_MRA_FAILURE;
      retry = RETRY_CLASS.RETRY_AFTER_RATE_LIMIT;
    } else if (
      transportClass === TRANSPORT_CLASS.TIMEOUT ||
      transportClass === TRANSPORT_CLASS.CONNECTION_FAILURE ||
      transportClass === TRANSPORT_CLASS.NO_RESPONSE ||
      transportClass === TRANSPORT_CLASS.TEMPORARY_SERVER_ERROR
    ) {
      outcome = APP_OUTCOME.UNKNOWN_APPLICATION_STATUS;
      retry = RETRY_CLASS.RECONCILE_BEFORE_RETRY;
    } else if (transportClass === TRANSPORT_CLASS.CLIENT_CONTRACT_ERROR) {
      outcome = APP_OUTCOME.CONTRACT_MISMATCH;
      retry = RETRY_CLASS.DO_NOT_RETRY_CONTRACT_ERROR;
    }
    return pack({
      outcome,
      retry,
      status,
      mraTransactionId,
      validationUrl,
      qrData,
      remark,
      refresh,
      block,
      accepted: false,
    });
  }

  // HTTP success — still require application acceptance
  const acceptedValues = contract?.acceptedStatusValues || [];
  const rejectedValues = contract?.rejectedStatusValues || [];

  if (!status) {
    return pack({
      outcome: APP_OUTCOME.UNKNOWN_APPLICATION_STATUS,
      retry: RETRY_CLASS.RECONCILE_BEFORE_RETRY,
      status,
      mraTransactionId,
      validationUrl,
      qrData,
      remark,
      refresh,
      block,
      accepted: false,
      reason: 'APPLICATION_STATUS_MISSING',
    });
  }

  if (acceptedValues.length && acceptedValues.map(String).includes(status)) {
    if (!mraTransactionId) {
      return pack({
        outcome: APP_OUTCOME.UNKNOWN_APPLICATION_STATUS,
        retry: RETRY_CLASS.MANUAL_REVIEW_REQUIRED,
        status,
        mraTransactionId,
        validationUrl,
        qrData,
        remark,
        refresh,
        block,
        accepted: false,
        reason: 'ACCEPTED_STATUS_WITHOUT_TRANSACTION_ID',
      });
    }
    let outcome = APP_OUTCOME.ACCEPTED;
    if (refresh) outcome = APP_OUTCOME.ACCEPTED_WITH_CONFIGURATION_REFRESH;
    if (block) outcome = APP_OUTCOME.ACCEPTED_WITH_TERMINAL_BLOCK;
    return pack({
      outcome,
      retry: RETRY_CLASS.DO_NOT_RETRY_ACCEPTED,
      status,
      mraTransactionId,
      validationUrl,
      qrData,
      remark,
      refresh,
      block,
      accepted: true,
    });
  }

  if (rejectedValues.length && rejectedValues.map(String).includes(status)) {
    const dup = /dup/i.test(String(remark || '')) || status === 'DUPLICATE';
    return pack({
      outcome: dup ? APP_OUTCOME.REJECTED_DUPLICATE : APP_OUTCOME.REJECTED_VALIDATION,
      retry: dup ? RETRY_CLASS.RECONCILE_BEFORE_RETRY : RETRY_CLASS.DO_NOT_RETRY_REJECTED,
      status,
      mraTransactionId,
      validationUrl,
      qrData,
      remark,
      refresh,
      block,
      accepted: false,
    });
  }

  // Unrecognized application status — fail closed
  return pack({
    outcome: APP_OUTCOME.UNKNOWN_APPLICATION_STATUS,
    retry: RETRY_CLASS.MANUAL_REVIEW_REQUIRED,
    status,
    mraTransactionId,
    validationUrl,
    qrData,
    remark,
    refresh,
    block,
    accepted: false,
    reason: 'UNRECOGNIZED_APPLICATION_STATUS',
  });
}

function pack(partial) {
  return {
    classifierVersion: CLASSIFIER_VERSION,
    http200AloneIsNotAcceptance: true,
    ...partial,
  };
}
