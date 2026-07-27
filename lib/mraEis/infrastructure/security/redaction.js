/**
 * EIS-focused secret redaction. Extends SecV2 patterns with MRA-specific keys.
 */
import { CryptoErrors } from './cryptoErrors.js';

const SENSITIVE_KEY =
  /^(authorization|bearer|jwt|token|access[_-]?token|refresh[_-]?token|secret|secret[_-]?key|api[_-]?key|activation[_-]?code|tac|buyer[_-]?authorization|password|private[_-]?key|wrapped[_-]?data[_-]?key|ciphertext|client[_-]?secret|vault[_-]?token|cookie|session)$/i;

const JWT_LIKE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi;

export function redactSecrets(value, depth = 0) {
  if (value == null) return value;
  if (depth > 8) return '[REDACTED_DEPTH]';
  if (typeof value === 'string') {
    return value.replace(JWT_LIKE, '[REDACTED_JWT]').replace(BEARER, 'Bearer [REDACTED]');
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 100).map((v) => redactSecrets(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactSecrets(v, depth + 1);
    }
  }
  return out;
}

/** Throws if payload appears to contain secret material (for outbox/audit guards). */
export function assertNoSecretMaterial(payload, label = 'payload') {
  const json = JSON.stringify(payload ?? {});
  JWT_LIKE.lastIndex = 0;
  if (
    JWT_LIKE.test(json) ||
    /"secretKey"\s*:\s*"[^"]+"/i.test(json) ||
    /"activationCode"\s*:\s*"[^"]+"/i.test(json) ||
    /"buyerAuthorizationCode"\s*:\s*"[^"]+"/i.test(json)
  ) {
    JWT_LIKE.lastIndex = 0;
    throw CryptoErrors.leakageDetected({ message: `Secret material blocked in ${label}.` });
  }
  JWT_LIKE.lastIndex = 0;
}

export function safeFingerprint(value) {
  if (!value) return null;
  const s = String(value);
  if (s.length < 8) return '****';
  return `…${s.slice(-4)}`;
}
