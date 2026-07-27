import './serverOnly.js';
import crypto from 'crypto';
import { CryptoErrors } from './cryptoErrors.js';

/**
 * Resolve EIS credential master key from environment.
 * Never store this in the database. Separate from ENCRYPTION_KEY / JWT secrets.
 *
 * Env vars:
 * - MRA_EIS_MASTER_KEY_v1 (preferred, 64 hex or 32 ascii)
 * - MRA_EIS_MASTER_KEY (alias)
 * - EIS_CREDENTIAL_MASTER_KEY (alias)
 *
 * For tests only: MRA_EIS_ALLOW_TEST_MASTER_KEY=1 + MRA_EIS_TEST_MASTER_KEY
 */
export function resolveMasterKey({ environment = 'DEVELOPMENT', keyVersion = 'v1' } = {}) {
  const envName = String(environment || 'DEVELOPMENT').toUpperCase();
  const versioned = process.env[`MRA_EIS_MASTER_KEY_${keyVersion}`];
  const primary =
    versioned ||
    process.env.MRA_EIS_MASTER_KEY ||
    process.env.EIS_CREDENTIAL_MASTER_KEY ||
    null;

  let raw = primary;
  if (!raw && process.env.MRA_EIS_ALLOW_TEST_MASTER_KEY === '1') {
    raw = process.env.MRA_EIS_TEST_MASTER_KEY || '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  }
  if (!raw) throw CryptoErrors.masterKeyMissing({ details: { environment: envName, keyVersion } });

  const key = normalizeKey(raw);
  const keyId = `env-envelope:${envName}:${keyVersion}:${fingerprint(key)}`;
  return Object.freeze({
    key,
    keyId,
    keyVersion,
    environment: envName,
    provider: 'ENV_ENVELOPE',
  });
}

function normalizeKey(raw) {
  const s = String(raw).trim();
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
  if (Buffer.byteLength(s, 'utf8') === 32) return Buffer.from(s, 'utf8');
  // Derive 32 bytes from longer passphrase for local/dev only — still not for production reuse across envs
  if (s.length >= 32) return crypto.createHash('sha256').update(s, 'utf8').digest();
  throw CryptoErrors.masterKeyMissing({
    message: 'Master key must be 32 bytes (64 hex chars) or a sufficiently long secret.',
  });
}

function fingerprint(keyBuf) {
  return crypto.createHash('sha256').update(keyBuf).digest('hex').slice(0, 12);
}

/** Production ciphertext must not decrypt under development keys — enforce env binding in AAD. */
export function assertEnvironmentKeyBinding(master, requestedEnvironment) {
  const req = String(requestedEnvironment || '').toUpperCase();
  const keyEnv = String(master.environment || '').toUpperCase();
  // Master key environment is the *deployment* environment (development/test/production),
  // while credential environment is SANDBOX/PRODUCTION (MRA). Cross-MRA-env blocked elsewhere.
  if (process.env.NODE_ENV === 'production' && keyEnv === 'DEVELOPMENT' && req === 'PRODUCTION') {
    throw CryptoErrors.environmentMismatch({
      message: 'Development master key cannot serve production credentials.',
    });
  }
}
