import crypto from 'crypto';
import { ACTIVATION_OUTCOME } from '../../domain/operationalEnums.js';
import { redactSecrets } from '../../infrastructure/security/redaction.js';

/**
 * Parse and classify activation responses.
 * HTTP 200 alone is NOT acceptance.
 */
export function parseActivationResponse({ httpStatus, body }) {
  const responseChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');

  const statusCode = body?.statusCode;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const errCode = String(errors[0]?.code || '').toUpperCase();
  const data = body?.data?.activatedTerminal || body?.data || null;
  const credentials = data?.terminalCredentials || {};
  const jwtToken = credentials.jwtToken || credentials.jwt || null;
  const secretKey = credentials.secretKey || null;
  const mraTerminalId = data?.terminalId || null;

  let outcome = ACTIVATION_OUTCOME.UNKNOWN_OUTCOME;
  let retryClassification = 'RECONCILE_BEFORE_RETRY';

  if (httpStatus === 429) {
    outcome = ACTIVATION_OUTCOME.RATE_LIMITED;
    retryClassification = 'AUTOMATIC_RETRY';
  } else if (httpStatus >= 500) {
    outcome = ACTIVATION_OUTCOME.TEMPORARY_MRA_FAILURE;
    retryClassification = 'AUTOMATIC_RETRY';
  } else if (httpStatus === 200 && Number(statusCode) === 1) {
    if (!mraTerminalId) {
      outcome = ACTIVATION_OUTCOME.INVALID_RESPONSE;
      retryClassification = 'MANUAL_REVIEW_REQUIRED';
    } else if (!jwtToken) {
      outcome = ACTIVATION_OUTCOME.INVALID_RESPONSE;
      retryClassification = 'MANUAL_REVIEW_REQUIRED';
    } else if (!secretKey) {
      outcome = ACTIVATION_OUTCOME.INVALID_RESPONSE;
      retryClassification = 'MANUAL_REVIEW_REQUIRED';
    } else {
      outcome = ACTIVATION_OUTCOME.ACTIVATION_ACCEPTED;
      retryClassification = 'NOT_APPLICABLE';
    }
  } else if (httpStatus === 200) {
    if (errCode.includes('INVALID_TAC')) outcome = ACTIVATION_OUTCOME.INVALID_TAC;
    else if (errCode.includes('TAC_EXPIRED')) outcome = ACTIVATION_OUTCOME.TAC_EXPIRED;
    else if (errCode.includes('TAC_ALREADY_USED')) outcome = ACTIVATION_OUTCOME.TAC_ALREADY_USED;
    else if (errCode.includes('PRODUCT')) outcome = ACTIVATION_OUTCOME.PRODUCT_NOT_APPROVED;
    else outcome = ACTIVATION_OUTCOME.ACTIVATION_REJECTED_CORRECTABLE;
    retryClassification = [
      ACTIVATION_OUTCOME.TAC_EXPIRED,
      ACTIVATION_OUTCOME.TAC_ALREADY_USED,
      ACTIVATION_OUTCOME.PRODUCT_NOT_APPROVED,
    ].includes(outcome)
      ? 'NO_RETRY'
      : 'DATA_CORRECTION_REQUIRED';
  } else {
    outcome = ACTIVATION_OUTCOME.INVALID_RESPONSE;
    retryClassification = 'MANUAL_REVIEW_REQUIRED';
  }

  const accepted = outcome === ACTIVATION_OUTCOME.ACTIVATION_ACCEPTED;

  return {
    httpStatus,
    mraApplicationStatus: statusCode != null ? String(statusCode) : null,
    remark: body?.remark || null,
    outcome,
    retryClassification,
    accepted,
    mraTerminalId,
    jwtToken: accepted ? jwtToken : null,
    secretKey: accepted ? secretKey : null,
    activationDate: data?.activationDate || null,
    globalConfiguration: data?.globalConfiguration || null,
    terminalConfiguration: data?.terminalConfiguration || null,
    taxpayerConfiguration: data?.taxpayerConfiguration || null,
    responseChecksum,
    sanitizedResponse: redactSecrets({
      statusCode,
      remark: body?.remark,
      errors,
      terminalId: mraTerminalId,
      hasJwt: Boolean(jwtToken),
      hasSecretKey: Boolean(secretKey),
      configVersions: {
        global: data?.globalConfiguration?.version || null,
        terminal: data?.terminalConfiguration?.version || null,
        taxpayer: data?.taxpayerConfiguration?.version || null,
      },
    }),
    parserVersion: 'phase7-activation-parser-v1',
  };
}

export function parseConfirmationResponse({ httpStatus, body }) {
  const responseChecksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(body ?? {}))
    .digest('hex');
  const statusCode = body?.statusCode;
  const accepted = httpStatus === 200 && Number(statusCode) === 1;
  return {
    httpStatus,
    mraApplicationStatus: statusCode != null ? String(statusCode) : null,
    accepted,
    outcome: accepted ? 'CONFIRMATION_ACCEPTED' : 'CONFIRMATION_REJECTED',
    responseChecksum,
    sanitizedResponse: redactSecrets({
      statusCode,
      remark: body?.remark,
      errors: body?.errors,
      confirmed: Boolean(body?.data?.confirmed),
    }),
    parserVersion: 'phase7-confirmation-parser-v1',
  };
}
