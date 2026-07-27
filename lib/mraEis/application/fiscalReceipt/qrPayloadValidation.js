/**
 * Phase 14 — QR payload validation (exact semantics preserved).
 */

import { QR_SOURCE_TYPE } from './qrSourceContractRegistry.js';
import { validateMraValidationUrl } from './validationUrlSecurity.js';

const CONTROL = /[\u0000-\u001F\u007F]/;
const LOCAL_APP_HINT = /\/verify\/|insightbooks|localhost|127\.0\.0\.1/i;
const SECRET_HINT = /bearer\s|authorization|buyerAuthorizationCode|tac[=:]|jwt[=:]/i;

export function validateQrPayload({ sourceType, exactValue, contract }) {
  const blockers = [];
  const value = exactValue == null ? '' : String(exactValue);

  if (!value) {
    return { valid: false, blockers: ['QR_PAYLOAD_EMPTY'] };
  }

  const max = contract?.maximumLength || contract?.URLPolicy?.maxLength || 2048;
  if (value.length > max) {
    blockers.push('QR_PAYLOAD_OVERSIZED');
  }

  if (CONTROL.test(value)) {
    blockers.push('QR_PAYLOAD_CONTROL_CHARACTERS');
  }

  if (value.includes('\0')) {
    blockers.push('QR_PAYLOAD_NULL_BYTE');
  }

  if (SECRET_HINT.test(value)) {
    blockers.push('QR_PAYLOAD_SECRET_PATTERN');
  }

  if (LOCAL_APP_HINT.test(value)) {
    blockers.push('QR_PAYLOAD_LOCAL_APP_URL_FORBIDDEN');
  }

  if (contract?.requiredPrefix && !value.startsWith(contract.requiredPrefix)) {
    blockers.push('QR_PAYLOAD_PREFIX_MISMATCH');
  }

  if (sourceType === QR_SOURCE_TYPE.MRA_VALIDATION_URL) {
    const url = validateMraValidationUrl(value, contract?.URLPolicy || {});
    if (!url.valid) blockers.push(url.blocker || 'VALIDATION_URL_INVALID');
  }

  return {
    valid: blockers.length === 0,
    blockers,
    exactValue: value,
    length: value.length,
    // Do not trim — preserve exact semantic payload
    preservedExactly: true,
  };
}
