/**
 * Phase 16 — Offline signer boundary.
 * Browser never receives private keys. Production signing blocked until contract verified.
 * Mock uses synthetic HMAC key material that must never be treated as certification evidence.
 */

import crypto from 'crypto';
import { resolveOfflineSignatureContract } from './offlineContractRegistry.js';
import { OfflineErrors } from './offlineErrors.js';

const MOCK_KEY_ALIAS = 'mock-offline-signing-key-v1-NOT-FOR-PRODUCTION';

export function canonicalizeOfflinePayload(payload) {
  // Deterministic JSON: sorted keys, exact decimal strings preserved, UTF-8
  return Buffer.from(stableStringify(payload), 'utf8');
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}

/**
 * Sign exact canonical bytes under verified contract.
 */
export async function signOfflineFiscalEnvelope({
  agentId = null,
  terminalId = null,
  environment = 'SANDBOX',
  mode = 'MOCK',
  signatureContractVersion = null,
  exactCanonicalBytes,
  keyReference = null,
  browserContext = false,
} = {}) {
  if (browserContext) {
    throw OfflineErrors.browserProhibited({
      message: 'Browser JavaScript cannot generate authoritative offline signatures.',
    });
  }

  const resolved = resolveOfflineSignatureContract({ environment, mode });
  if (!resolved.allowsSigning) {
    throw OfflineErrors.signatureContract({
      message: 'Offline signature contract blocked for this environment.',
      details: { decision: resolved.decision },
    });
  }

  if (resolved.contract.onlineJwtForbiddenAsSigningKey !== false && keyReference === 'ONLINE_JWT') {
    throw OfflineErrors.keyUnavailable({
      message: 'Online JWT must not be reused as an offline signing key.',
    });
  }

  if (!exactCanonicalBytes || !Buffer.isBuffer(exactCanonicalBytes)) {
    throw OfflineErrors.signatureGeneration({
      message: 'Exact canonical bytes are required for signing.',
    });
  }

  const contractVersion = signatureContractVersion || resolved.contract.contractVersion;
  const signedBytesChecksum = crypto.createHash('sha256').update(exactCanonicalBytes).digest('hex');

  // Mock synthetic key only — never production
  const keyMaterial = crypto.createHash('sha256').update(MOCK_KEY_ALIAS).digest();
  const signature = crypto.createHmac('sha256', keyMaterial).update(exactCanonicalBytes).digest('base64');

  const verification = verifyOfflineSignature({
    exactCanonicalBytes,
    signature,
    environment,
    mode,
  });

  if (!verification.valid) {
    throw OfflineErrors.signatureVerification({
      message: 'Local signature verification failed after generation.',
    });
  }

  return {
    signature,
    signatureEncoding: 'base64',
    signatureAlgorithm: resolved.contract.algorithm,
    signatureContractVersion: contractVersion,
    signedBytesChecksum,
    keyReference: keyReference || 'MOCK_SYNTHETIC_KEY_REF',
    keyVersion: 'mock-v1',
    certificateReference: null,
    generatedAt: new Date().toISOString(),
    verificationResult: verification,
    signerIdentity: {
      agentId,
      terminalId,
      environment,
      browserHadPrivateKey: false,
    },
    // never include key material
  };
}

export function verifyOfflineSignature({
  exactCanonicalBytes,
  signature,
  environment = 'SANDBOX',
  mode = 'MOCK',
} = {}) {
  const resolved = resolveOfflineSignatureContract({ environment, mode });
  if (!resolved.allowsSigning) {
    return { valid: false, reason: 'CONTRACT_BLOCKED' };
  }
  if (!Buffer.isBuffer(exactCanonicalBytes) || !signature) {
    return { valid: false, reason: 'MISSING_INPUT' };
  }
  const keyMaterial = crypto.createHash('sha256').update(MOCK_KEY_ALIAS).digest();
  const expected = crypto.createHmac('sha256', keyMaterial).update(exactCanonicalBytes).digest('base64');
  const ok =
    expected.length === signature.length &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  return {
    valid: ok,
    reason: ok ? 'OK' : 'SIGNATURE_MISMATCH',
    algorithm: resolved.contract.algorithm,
    contractVersion: resolved.contract.contractVersion,
  };
}
