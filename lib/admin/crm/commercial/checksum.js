/**
 * SHA-256 checksum helpers for commercial artifacts — Phase 15 Wave 3.
 */

import { createHash } from 'crypto';

export const CRM_CHECKSUM_ALGORITHM = 'SHA256';

export function sha256Hex(bufferOrString) {
  const buf = Buffer.isBuffer(bufferOrString)
    ? bufferOrString
    : Buffer.from(String(bufferOrString ?? ''), 'utf8');
  return createHash('sha256').update(buf).digest('hex');
}

export function assertChecksumMatch(expected, actual) {
  const a = String(expected || '')
    .trim()
    .toLowerCase();
  const b = String(actual || '')
    .trim()
    .toLowerCase();
  if (!a || !b || a !== b) {
    const err = new Error('checksum_mismatch');
    err.code = 'checksum_mismatch';
    throw err;
  }
  return true;
}
