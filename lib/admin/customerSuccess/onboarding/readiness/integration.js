/**
 * Integration coordination readiness — Phase 21 Wave 2 (G21-14).
 * Metadata + readiness only; secrets redacted; no fiscal submit.
 */

import { READINESS_STATUS } from './tenant.js';

const SECRET_KEYS = new Set([
  'apikey',
  'api_key',
  'clientsecret',
  'client_secret',
  'password',
  'secret',
  'token',
  'accesstoken',
  'access_token',
  'refreshtoken',
  'refresh_token',
  'privatekey',
  'private_key',
  'credential',
  'credentials',
  'authorization',
]);

function isSecretKey(key) {
  const k = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
  if (SECRET_KEYS.has(k)) return true;
  return /secret|password|token|apikey|credential/i.test(String(key || ''));
}

/**
 * Deep-ish redact of secret-bearing fields for notes/exports/evidence.
 */
export function redactIntegrationSecrets(value) {
  if (value == null) return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactIntegrationSecrets(v));
  }
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (isSecretKey(key)) {
      out[key] = 'REDACTED';
    } else if (v && typeof v === 'object') {
      out[key] = redactIntegrationSecrets(v);
    } else {
      out[key] = v;
    }
  }
  return out;
}

/**
 * @returns {{ status: string, evidence: object }}
 */
export async function evaluateIntegrationReadiness(prisma, project, args = {}) {
  if (args.dimensionOverrides?.integrations) {
    return {
      status: String(args.dimensionOverrides.integrations).toUpperCase(),
      evidence: { override: true },
    };
  }

  const raw = args.integrationConfig || args.config || null;
  if (!raw) {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { reason: 'integration_config_unavailable' },
    };
  }

  const config = redactIntegrationSecrets(raw);
  const status = String(raw.status || raw.readinessStatus || '')
    .trim()
    .toUpperCase();

  if (!status || status === 'UNKNOWN') {
    return {
      status: READINESS_STATUS.UNKNOWN,
      evidence: { config, reason: 'integration_status_unknown' },
    };
  }

  if (status === 'READY' || status === 'CONFIGURED' || status === 'ACTIVE') {
    return {
      status: READINESS_STATUS.READY,
      evidence: { config, integrationStatus: status },
    };
  }

  if (status === 'NOT_REQUIRED' || status === 'NOT_APPLICABLE') {
    return {
      status: READINESS_STATUS.NOT_APPLICABLE,
      evidence: { config, integrationStatus: status },
    };
  }

  return {
    status: READINESS_STATUS.NOT_READY,
    evidence: { config, integrationStatus: status },
  };
}
