/**
 * Phase 14 — contract-driven QR source resolution.
 * Does not invent payloads. Does not use local /verify URLs.
 */

import crypto from 'crypto';
import { QR_SOURCE_TYPE } from './qrSourceContractRegistry.js';
import { validateMraValidationUrl } from './validationUrlSecurity.js';
import { validateQrPayload } from './qrPayloadValidation.js';

function sha256(value) {
  return crypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest('hex');
}

/**
 * @param {{
 *   responseEvidence: object,
 *   qrSourceContract: object,
 *   environment: string
 * }} args
 */
export function resolveQrSource({ responseEvidence, qrSourceContract, environment }) {
  const blockers = [];
  const warnings = [];
  const sanitized = responseEvidence?.sanitizedCanonicalResponse || {};
  const validationUrl =
    responseEvidence?.validationUrl || sanitized.validationUrl || null;
  const rawQrPayload =
    sanitized.qrPayload ||
    sanitized.qrData ||
    (typeof sanitized.exactQrData === 'string' ? sanitized.exactQrData : null);

  if (!qrSourceContract?.allowsQrGeneration) {
    return {
      resolved: false,
      sourceType: QR_SOURCE_TYPE.CONTRACT_UNRESOLVED,
      exactSourceValue: null,
      normalizedValue: null,
      sourceResponseField: null,
      contractVersion: qrSourceContract?.contractVersion || null,
      validationUrl: null,
      QRPayload: null,
      blockers: ['QR_CONTRACT_UNVERIFIED', ...(qrSourceContract?.blockerCodes || [])],
      warnings,
      resolutionVersion: 'phase14-qr-resolve-v1',
      environment,
    };
  }

  const precedence = qrSourceContract.sourcePrecedence || [
    QR_SOURCE_TYPE.MRA_VALIDATION_URL,
    QR_SOURCE_TYPE.MRA_RAW_QR_PAYLOAD,
  ];

  // Detect conflict: both present with different semantics when contract forbids composite
  if (
    validationUrl &&
    rawQrPayload &&
    String(validationUrl) !== String(rawQrPayload) &&
    precedence.includes(QR_SOURCE_TYPE.COMPOSITE_VERIFIED_PAYLOAD) === false
  ) {
    // Not a hard conflict when precedence is defined — prefer first precedence match.
    warnings.push('MULTIPLE_QR_CANDIDATES_PRECEDENCE_APPLIED');
  }

  for (const sourceType of precedence) {
    if (sourceType === QR_SOURCE_TYPE.MRA_VALIDATION_URL && validationUrl) {
      const urlCheck = validateMraValidationUrl(validationUrl, qrSourceContract.URLPolicy || {});
      if (!urlCheck.valid) {
        blockers.push(urlCheck.blocker || 'VALIDATION_URL_UNTRUSTED');
        continue;
      }
      const payloadCheck = validateQrPayload({
        sourceType,
        exactValue: urlCheck.exactValue,
        contract: qrSourceContract,
      });
      if (!payloadCheck.valid) {
        blockers.push(...payloadCheck.blockers);
        continue;
      }
      return {
        resolved: true,
        sourceType,
        exactSourceValue: urlCheck.exactValue,
        normalizedValue: urlCheck.normalizedValue,
        sourceResponseField: 'validationUrl',
        contractVersion: qrSourceContract.contractVersion,
        validationUrl: urlCheck.exactValue,
        QRPayload: urlCheck.exactValue,
        exactSourceChecksum: sha256(urlCheck.exactValue),
        blockers: [],
        warnings,
        resolutionVersion: 'phase14-qr-resolve-v1',
        environment,
      };
    }

    if (sourceType === QR_SOURCE_TYPE.MRA_RAW_QR_PAYLOAD && rawQrPayload) {
      const payloadCheck = validateQrPayload({
        sourceType,
        exactValue: String(rawQrPayload),
        contract: qrSourceContract,
      });
      if (!payloadCheck.valid) {
        blockers.push(...payloadCheck.blockers);
        continue;
      }
      return {
        resolved: true,
        sourceType,
        exactSourceValue: String(rawQrPayload),
        normalizedValue: String(rawQrPayload),
        sourceResponseField: 'qrData',
        contractVersion: qrSourceContract.contractVersion,
        validationUrl: validationUrl || null,
        QRPayload: String(rawQrPayload),
        exactSourceChecksum: sha256(String(rawQrPayload)),
        blockers: [],
        warnings,
        resolutionVersion: 'phase14-qr-resolve-v1',
        environment,
      };
    }
  }

  if (sanitized.qrDataPresent && !validationUrl && !rawQrPayload) {
    blockers.push('QR_SOURCE_MISSING');
    blockers.push('QR_DATA_FLAG_WITHOUT_PERSISTED_PAYLOAD');
  } else if (!validationUrl && !rawQrPayload) {
    blockers.push('QR_SOURCE_MISSING');
  }

  return {
    resolved: false,
    sourceType: QR_SOURCE_TYPE.CONTRACT_UNRESOLVED,
    exactSourceValue: null,
    normalizedValue: null,
    sourceResponseField: null,
    contractVersion: qrSourceContract.contractVersion,
    validationUrl: validationUrl || null,
    QRPayload: null,
    blockers: blockers.length ? [...new Set(blockers)] : ['QR_SOURCE_MISSING'],
    warnings,
    resolutionVersion: 'phase14-qr-resolve-v1',
    environment,
  };
}
