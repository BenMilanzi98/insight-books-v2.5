/**
 * UTM parameter helpers — Phase 23 Wave 1 contract only.
 *
 * UTM capture is a Wave 1 parsing/validation contract; no visitor/session persistence yet.
 * Lead source SoT remains CRM CrmLead.source / CrmCaptureRecord.
 */

export const UTM_KEYS = Object.freeze([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
]);

const UTM_KEY_SET = new Set(UTM_KEYS);

/** Max lengths per UTM key (lowercased value after normalisation). */
export const UTM_MAX_LENGTHS = Object.freeze({
  utm_source: 100,
  utm_medium: 100,
  utm_campaign: 100,
  utm_term: 200,
  utm_content: 200,
});

const UTM_VALUE_RE = /^[a-z0-9_\-.]+$/;

/**
 * @param {URLSearchParams|Record<string, string>|Iterable<[string, string]>} params
 * @returns {Record<string, string>}
 */
export function parseUtmFromSearchParams(params) {
  const out = {};
  let entries;

  if (params instanceof URLSearchParams) {
    entries = params.entries();
  } else if (params && typeof params === 'object') {
    entries = Object.entries(params);
  } else {
    return out;
  }

  for (const [key, value] of entries) {
    const k = String(key).toLowerCase();
    if (!UTM_KEY_SET.has(k)) continue;
    if (value == null || value === '') continue;
    out[k] = String(value);
  }
  return out;
}

/**
 * @param {unknown} url
 * @returns {Record<string, string>}
 */
export function parseUtmFromUrl(url) {
  if (url == null || typeof url !== 'string' || !url.trim()) {
    return {};
  }

  try {
    const parsed = new URL(url.trim());
    return parseUtmFromSearchParams(parsed.searchParams);
  } catch {
    return {};
  }
}

/**
 * Build a URL query string fragment (without leading `?`) from UTM params.
 * Only known UTM keys with validated values are included.
 *
 * @param {Record<string, unknown>} params
 * @returns {string}
 */
export function buildUtmQuery(params = {}) {
  const validated = validateUtmParams(params);
  if (!validated.ok) return '';

  const search = new URLSearchParams();
  for (const key of UTM_KEYS) {
    const value = validated.params[key];
    if (value) search.set(key, value);
  }
  return search.toString();
}

/**
 * Normalise and validate UTM params (lowercase values, charset, max lengths).
 *
 * @param {Record<string, unknown>} params
 * @returns {{ ok: true, params: Record<string, string> } | { ok: false, error: string, field?: string }}
 */
export function validateUtmParams(params = {}) {
  if (params == null || typeof params !== 'object' || Array.isArray(params)) {
    return { ok: false, error: 'invalid_utm_params' };
  }

  const out = {};

  for (const [rawKey, rawValue] of Object.entries(params)) {
    const key = String(rawKey).toLowerCase();
    if (!UTM_KEY_SET.has(key)) continue;
    if (rawValue == null || rawValue === '') continue;

    const value = String(rawValue).trim().toLowerCase();
    const maxLen = UTM_MAX_LENGTHS[key] || 100;

    if (value.length > maxLen) {
      return { ok: false, error: 'utm_value_too_long', field: key };
    }
    if (!UTM_VALUE_RE.test(value)) {
      return { ok: false, error: 'utm_invalid_charset', field: key };
    }

    out[key] = value;
  }

  return { ok: true, params: out };
}
