/**
 * x-eis-message-hash — Phase 13.
 * Live MRA hash contract remains REQUIRES_MRA_CLARIFICATION (Q-010/Q-011).
 * MOCK mode only: synthetic SHA-256 hex of exact transmitted UTF-8 bytes (clearly non-verified).
 */
import crypto from 'crypto';
import { hashEisMessage } from '../../infrastructure/security/messageHasher.js';
import { SalesTransmissionErrors } from './salesTransmissionErrors.js';

export const MOCK_MESSAGE_HASH_VERSION = 'MOCK_SYNTHETIC_X_EIS_MESSAGE_HASH_V1';

/**
 * Hash exact transmitted bytes once. Never re-serialize after hashing.
 */
export async function generateSalesMessageHash({
  transmittedBytes,
  mode = 'MOCK',
  contractHashMode = 'MOCK_SYNTHETIC_SHA256_HEX',
} = {}) {
  if (!Buffer.isBuffer(transmittedBytes) && typeof transmittedBytes !== 'string') {
    throw SalesTransmissionErrors.requestHash({ message: 'transmittedBytes required.' });
  }
  const buf = Buffer.isBuffer(transmittedBytes)
    ? transmittedBytes
    : Buffer.from(transmittedBytes, 'utf8');

  const m = String(mode).toUpperCase();
  if (m === 'MOCK' && contractHashMode === 'MOCK_SYNTHETIC_SHA256_HEX') {
    const digest = crypto.createHash('sha256').update(buf).digest('hex');
    return {
      headerName: 'x-eis-message-hash',
      headerValue: digest,
      algorithm: 'SHA-256',
      encoding: 'HEX',
      hasherVersion: MOCK_MESSAGE_HASH_VERSION,
      isMraVerified: false,
      inputByteLength: buf.length,
      inputChecksum: digest,
      note: 'Synthetic mock hash of exact transmitted bytes — not a verified MRA message-hash algorithm.',
    };
  }

  // Live path: fail closed via Phase 6 hasher
  try {
    await hashEisMessage({ bytes: buf });
  } catch (err) {
    throw SalesTransmissionErrors.requestHash({
      message:
        err?.message ||
        'x-eis-message-hash contract unverified — live transmission blocked (Q-010/Q-011).',
      details: { mode: m },
    });
  }
  throw SalesTransmissionErrors.requestHash({
    message: 'Message hasher unexpectedly reached implementation.',
  });
}

/**
 * Serialize DTO once to immutable UTF-8 bytes (compact JSON, sorted keys via canonicalize).
 */
export function serializeSalesRequestBytes(canonicalObject, { canonicalizeFn } = {}) {
  if (!canonicalizeFn) {
    throw new Error('canonicalizeFn required');
  }
  const { canonicalJson, bytes, checksum } = canonicalizeFn(canonicalObject, {
    contractVersion: '1',
  });
  return {
    transmittedBytes: Buffer.from(canonicalJson, 'utf8'),
    canonicalJson,
    payloadChecksum: checksum,
    byteLength: bytes?.length ?? Buffer.byteLength(canonicalJson, 'utf8'),
  };
}
