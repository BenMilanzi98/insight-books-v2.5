import { MraEisControlError } from '../../domain/errors.js';

function make(code, defaults = {}) {
  return (opts = {}) =>
    new MraEisControlError({
      code,
      message: opts.message || defaults.message || code,
      httpStatus: opts.httpStatus ?? defaults.httpStatus ?? 400,
      ...opts,
      // Never allow callers to attach secret-bearing details
      details: opts.details
        ? {
            ...opts.details,
            secret: undefined,
            plaintext: undefined,
            ciphertext: undefined,
            jwt: undefined,
            tac: undefined,
          }
        : null,
    });
}

export const CryptoErrors = {
  secretProviderUnavailable: make('EIS_SECRET_PROVIDER_UNAVAILABLE', {
    message: 'EIS secret provider is unavailable.',
    httpStatus: 503,
  }),
  secretStore: make('EIS_SECRET_STORE_ERROR', {
    message: 'Failed to store EIS secret securely.',
    httpStatus: 500,
  }),
  secretAccessDenied: make('EIS_SECRET_ACCESS_DENIED', {
    message: 'Secret access denied for the requested operation.',
    httpStatus: 403,
  }),
  secretNotFound: make('EIS_SECRET_NOT_FOUND', {
    message: 'Credential secret was not found.',
    httpStatus: 404,
  }),
  secretExpired: make('EIS_SECRET_EXPIRED', {
    message: 'Credential secret has expired.',
    httpStatus: 409,
  }),
  secretRevoked: make('EIS_SECRET_REVOKED', {
    message: 'Credential secret has been revoked.',
    httpStatus: 409,
  }),
  environmentMismatch: make('EIS_SECRET_ENVIRONMENT_MISMATCH', {
    message: 'Credential environment does not match the request.',
    httpStatus: 403,
  }),
  terminalMismatch: make('EIS_SECRET_TERMINAL_MISMATCH', {
    message: 'Credential terminal does not match the request.',
    httpStatus: 403,
  }),
  encryption: make('EIS_ENCRYPTION_ERROR', {
    message: 'Encryption failed.',
    httpStatus: 500,
  }),
  decryption: make('EIS_DECRYPTION_ERROR', {
    message: 'Decryption failed.',
    httpStatus: 500,
  }),
  ciphertextIntegrity: make('EIS_CIPHERTEXT_INTEGRITY_ERROR', {
    message: 'Ciphertext integrity check failed.',
    httpStatus: 400,
  }),
  unsupportedKeyVersion: make('EIS_UNSUPPORTED_KEY_VERSION', {
    message: 'Unsupported encryption key version.',
    httpStatus: 409,
  }),
  keyRotation: make('EIS_KEY_ROTATION_ERROR', {
    message: 'Key rotation failed.',
    httpStatus: 500,
  }),
  credentialRotation: make('EIS_CREDENTIAL_ROTATION_ERROR', {
    message: 'Credential rotation failed.',
    httpStatus: 500,
  }),
  ephemeralExpired: make('EIS_EPHEMERAL_SECRET_EXPIRED', {
    message: 'Ephemeral secret expired or already consumed.',
    httpStatus: 409,
  }),
  canonicalization: make('EIS_CANONICALIZATION_ERROR', {
    message: 'Payload canonicalization failed.',
    httpStatus: 400,
  }),
  unsupportedCanonicalization: make('EIS_UNSUPPORTED_CANONICALIZATION_VERSION', {
    message: 'Unsupported canonicalization version.',
    httpStatus: 409,
  }),
  contractUnverified: make('EIS_CRYPTOGRAPHIC_CONTRACT_UNVERIFIED', {
    message: 'Cryptographic contract is unverified and fails closed.',
    httpStatus: 409,
  }),
  signing: make('EIS_SIGNING_ERROR', {
    message: 'Signing operation failed.',
    httpStatus: 500,
  }),
  messageHash: make('EIS_MESSAGE_HASH_ERROR', {
    message: 'Message hash operation failed.',
    httpStatus: 500,
  }),
  offlineUnavailable: make('EIS_OFFLINE_SIGNING_UNAVAILABLE', {
    message: 'Offline signing is unavailable until contract verification and certification.',
    httpStatus: 403,
  }),
  encoding: make('EIS_ENCODING_ERROR', {
    message: 'Encoding operation failed.',
    httpStatus: 400,
  }),
  leakageDetected: make('EIS_SECRET_LEAKAGE_DETECTED', {
    message: 'Potential secret leakage was blocked.',
    httpStatus: 500,
  }),
  masterKeyMissing: make('EIS_MASTER_KEY_MISSING', {
    message: 'EIS credential master key is not configured.',
    httpStatus: 503,
  }),
};
