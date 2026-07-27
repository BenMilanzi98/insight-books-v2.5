/**
 * Cryptographic version registry — fail closed when not verified to required level.
 */
import { CryptoErrors } from './cryptoErrors.js';

export const CRYPTO_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_WITH_TEST_VECTOR: 'VERIFIED_WITH_TEST_VECTOR',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL: 'PROVISIONAL',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
  DEPRECATED: 'DEPRECATED',
});

export const CRYPTOGRAPHIC_VERSION_REGISTRY = Object.freeze({
  ACTIVATION_CONFIRMATION_HMAC_SHA512_V1: {
    algorithm: 'HMAC-SHA512',
    inputContract: 'UTF-8 Terminal Activation Code string',
    keyType: 'MRA_TERMINAL_SECRET',
    encoding: 'BASE64_STANDARD_V1',
    outputFormat: 'standard-base64',
    paddingRule: 'standard-with-padding',
    contractStatus: CRYPTO_CONTRACT_STATUS.VERIFIED_WITH_TEST_VECTOR,
    verificationSource: 'Phase 1 TERMINAL_ACTIVATION_CONFIRMATION_CONTRACT KAT',
    knownAnswerTestStatus: 'PASS',
    sandboxVerificationStatus: 'PENDING',
    productionEnabled: false,
    allowedEnvironments: ['SANDBOX', 'TEST', 'DEVELOPMENT'],
  },
  REQUEST_MESSAGE_HASH_V1: {
    algorithm: 'UNVERIFIED',
    inputContract: 'unknown',
    keyType: 'MRA_TERMINAL_SECRET',
    encoding: 'UNKNOWN',
    contractStatus: CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    verificationSource: 'Phase 1 Q-010/Q-011',
    knownAnswerTestStatus: 'NONE',
    sandboxVerificationStatus: 'NONE',
    productionEnabled: false,
  },
  OFFLINE_SIGNATURE_HMAC_SHA256_V1: {
    algorithm: 'HMAC-SHA256',
    inputContract: 'query-parameter string (order unresolved)',
    keyType: 'MRA_TERMINAL_SECRET',
    encoding: 'BASE64_URL_SAFE_V1',
    contractStatus: CRYPTO_CONTRACT_STATUS.BLOCKED,
    verificationSource: 'Phase 1 Q-040 offline KAT missing',
    knownAnswerTestStatus: 'NONE',
    sandboxVerificationStatus: 'NONE',
    productionEnabled: false,
  },
  FISCAL_NUMBER_ENCODING_V1: {
    algorithm: 'BASE64_COMPONENT_JOIN',
    contractStatus: CRYPTO_CONTRACT_STATUS.BLOCKED,
    verificationSource: 'Phase 1 Q-021',
    productionEnabled: false,
  },
  PAYLOAD_CANONICALIZATION_V1: {
    algorithm: 'SORTED_KEY_JSON_UTF8',
    contractStatus: CRYPTO_CONTRACT_STATUS.VERIFIED,
    verificationSource: 'Internal security control (Phase 6)',
    productionEnabled: true,
  },
  BASE64_STANDARD_V1: {
    algorithm: 'BASE64',
    contractStatus: CRYPTO_CONTRACT_STATUS.VERIFIED,
    productionEnabled: true,
  },
  BASE64_URL_SAFE_V1: {
    algorithm: 'BASE64URL',
    contractStatus: CRYPTO_CONTRACT_STATUS.VERIFIED,
    productionEnabled: true,
  },
  ENV_ENVELOPE_V1: {
    algorithm: 'AES-256-GCM envelope',
    contractStatus: CRYPTO_CONTRACT_STATUS.VERIFIED,
    verificationSource: 'Internal security control (Phase 6)',
    productionEnabled: true,
  },
});

export function getCryptoVersion(id) {
  return CRYPTOGRAPHIC_VERSION_REGISTRY[id] || null;
}

export function assertCryptoAllowed(id, { forProduction = false } = {}) {
  const entry = getCryptoVersion(id);
  if (!entry) {
    throw CryptoErrors.contractUnverified({ message: `Unknown cryptographic version ${id}.` });
  }
  const blocked = [
    CRYPTO_CONTRACT_STATUS.BLOCKED,
    CRYPTO_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    CRYPTO_CONTRACT_STATUS.DEPRECATED,
  ];
  if (blocked.includes(entry.contractStatus)) {
    throw CryptoErrors.contractUnverified({
      message: `Cryptographic version ${id} is ${entry.contractStatus}.`,
      details: { id, status: entry.contractStatus },
    });
  }
  if (forProduction && !entry.productionEnabled) {
    throw CryptoErrors.contractUnverified({
      message: `Cryptographic version ${id} is not enabled for production.`,
      details: { id },
    });
  }
  if (forProduction && entry.contractStatus === CRYPTO_CONTRACT_STATUS.PROVISIONAL) {
    throw CryptoErrors.contractUnverified({
      message: `Provisional cryptographic version ${id} rejected for production.`,
    });
  }
  return entry;
}
