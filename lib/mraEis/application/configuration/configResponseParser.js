import crypto from 'crypto';
import { CONFIG_RESPONSE_OUTCOME, CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';
import { redactSecrets } from '../../infrastructure/security/redaction.js';
import { getConfigurationTypeEntry } from './configurationTypeRegistry.js';

/**
 * Parse configuration responses. HTTP 200 alone is NOT validity.
 */
export function parseConfigurationResponse({ httpStatus, body, configurationType, expectedTerminalId = null, expectedTin = null }) {
  const entry = getConfigurationTypeEntry(configurationType);
  const responseChecksum = crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
  const statusCode = body?.statusCode;
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const errCode = String(errors[0]?.code || '').toUpperCase();
  const data = body?.data?.configuration || body?.data || null;
  const version = data?.version || data?.configurationVersion || null;
  const refreshRequired = Boolean(data?.configurationRefreshRequired || body?.configurationRefreshRequired);
  const terminalBlocked = Boolean(data?.terminalBlocked || data?.blocked || errCode.includes('BLOCK'));

  let outcome = CONFIG_RESPONSE_OUTCOME.UNKNOWN_OUTCOME;
  let retryClassification = 'RECONCILE_BEFORE_RETRY';

  if (httpStatus === 429) {
    outcome = CONFIG_RESPONSE_OUTCOME.RATE_LIMITED;
    retryClassification = 'AUTOMATIC_RETRY';
  } else if (httpStatus >= 500) {
    outcome = CONFIG_RESPONSE_OUTCOME.TEMPORARY_MRA_FAILURE;
    retryClassification = 'AUTOMATIC_RETRY';
  } else if (httpStatus === 401 || httpStatus === 403 || errCode.includes('AUTH')) {
    outcome = CONFIG_RESPONSE_OUTCOME.AUTHENTICATION_FAILURE;
    retryClassification = 'NO_RETRY';
  } else if (httpStatus === 200 && Number(statusCode) === 1) {
    if (!version) {
      outcome = CONFIG_RESPONSE_OUTCOME.INVALID_RESPONSE;
      retryClassification = 'MANUAL_REVIEW_REQUIRED';
    } else if (terminalBlocked) {
      outcome = CONFIG_RESPONSE_OUTCOME.TERMINAL_BLOCKED;
      retryClassification = 'NO_RETRY';
    } else if (
      configurationType === CONFIGURATION_TYPE.TERMINAL &&
      expectedTerminalId &&
      data?.terminalId &&
      String(data.terminalId) !== String(expectedTerminalId)
    ) {
      outcome = CONFIG_RESPONSE_OUTCOME.CONTRACT_MISMATCH;
      retryClassification = 'NO_RETRY';
    } else if (
      configurationType === CONFIGURATION_TYPE.TAXPAYER &&
      expectedTin &&
      data?.tin &&
      String(data.tin) !== String(expectedTin)
    ) {
      outcome = CONFIG_RESPONSE_OUTCOME.CONTRACT_MISMATCH;
      retryClassification = 'NO_RETRY';
    } else if (data?.unchanged === true) {
      outcome = CONFIG_RESPONSE_OUTCOME.CONFIGURATION_UNCHANGED;
      retryClassification = 'NOT_APPLICABLE';
    } else {
      outcome = CONFIG_RESPONSE_OUTCOME.CONFIGURATION_RECEIVED;
      retryClassification = 'NOT_APPLICABLE';
    }
    if (refreshRequired && outcome === CONFIG_RESPONSE_OUTCOME.CONFIGURATION_RECEIVED) {
      // still received; flag for caller
    }
  } else if (httpStatus === 200) {
    outcome = CONFIG_RESPONSE_OUTCOME.CONFIGURATION_REJECTED;
    retryClassification = 'DATA_CORRECTION_REQUIRED';
  } else {
    outcome = CONFIG_RESPONSE_OUTCOME.INVALID_RESPONSE;
    retryClassification = 'MANUAL_REVIEW_REQUIRED';
  }

  const accepted =
    outcome === CONFIG_RESPONSE_OUTCOME.CONFIGURATION_RECEIVED ||
    outcome === CONFIG_RESPONSE_OUTCOME.CONFIGURATION_UNCHANGED;

  return {
    httpStatus,
    mraApplicationStatus: statusCode != null ? String(statusCode) : null,
    remark: body?.remark || null,
    outcome,
    retryClassification,
    accepted,
    version: version ? String(version) : null,
    effectiveFrom: data?.effectiveFrom || null,
    payload: accepted ? data : null,
    refreshRequired,
    terminalBlocked,
    responseChecksum,
    parserVersion: entry?.parserVersion || 'phase8-parser-v1',
    sanitizedResponse: redactSecrets({
      statusCode,
      remark: body?.remark,
      errors,
      configurationType,
      version,
      refreshRequired,
      terminalBlocked,
      unchanged: Boolean(data?.unchanged),
    }),
  };
}

export function compareConfigurationVersions({ localActiveVersion, localChecksum, remoteVersion, remoteChecksum }) {
  if (!remoteVersion) {
    return {
      relation: 'VERSION_MISSING',
      requiresSnapshot: false,
      requiresActivation: false,
      conflict: false,
      warnings: ['Remote version missing'],
    };
  }
  if (!localActiveVersion) {
    return {
      relation: 'NO_LOCAL_VERSION',
      requiresSnapshot: true,
      requiresActivation: true,
      conflict: false,
      warnings: [],
    };
  }
  if (String(localActiveVersion) === String(remoteVersion)) {
    if (localChecksum && remoteChecksum && localChecksum !== remoteChecksum) {
      return {
        relation: 'SAME_VERSION_DIFFERENT_CHECKSUM',
        requiresSnapshot: false,
        requiresActivation: false,
        conflict: true,
        warnings: ['Same version with different checksum'],
      };
    }
    return {
      relation: 'SAME_VERSION_SAME_CHECKSUM',
      requiresSnapshot: false,
      requiresActivation: false,
      conflict: false,
      warnings: [],
    };
  }
  // Equality-only ordering — do not invent semantic newer/older for arbitrary formats
  return {
    relation: 'REMOTE_NEWER',
    requiresSnapshot: true,
    requiresActivation: true,
    conflict: false,
    warnings: ['Version labels differ; treating remote as candidate (equality-based policy)'],
  };
}
