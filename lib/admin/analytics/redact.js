/**
 * Redact secrets / high-sensitivity fields before outbox/event persist.
 */

const SENSITIVE_KEY =
  /^(password|secret|token|authorization|bearer|apiKey|api_key|jwt|privateKey|gatewayResponse)$/i;

/**
 * @param {unknown} value
 * @returns {unknown}
 */
export function redactAnalyticsPayload(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(redactAnalyticsPayload);
  if (typeof value !== 'object') return value;

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
      continue;
    }
    if (k === 'email' && typeof v === 'string') {
      const at = v.indexOf('@');
      out[k] = at > 1 ? `${v[0]}***${v.slice(at)}` : '[REDACTED]';
      continue;
    }
    out[k] = redactAnalyticsPayload(v);
  }
  return out;
}

export function assertNoSecretsInPayload(payload) {
  const text = JSON.stringify(payload ?? {});
  if (/(authorization|bearer\s|secretKey|"password"\s*:)/i.test(text)) {
    const err = new Error('Analytics payload must not contain secrets');
    err.code = 'ANALYTICS_SECRET_REJECTED';
    throw err;
  }
}
