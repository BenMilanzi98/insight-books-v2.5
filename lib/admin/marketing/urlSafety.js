/**
 * Marketing URL safety — allow only http/https destinations for campaign links.
 * Reject javascript:, data:, file:, credential-bearing URLs, and relative abuse.
 */

const MAX_URL_LENGTH = 2048;

const BLOCKED_SCHEMES = /^(javascript|data|file|vbscript):/i;

/**
 * @param {unknown} url
 * @returns {boolean}
 */
export function isSafeMarketingUrl(url) {
  if (url == null || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return false;

  if (BLOCKED_SCHEMES.test(trimmed)) return false;

  // Reject protocol-relative and bare-relative URLs (no host — open redirect / abuse vector)
  if (trimmed.startsWith('//') || trimmed.startsWith('/') || trimmed.startsWith('.')) {
    return false;
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  if (!parsed.hostname) {
    return false;
  }

  return true;
}

/**
 * @param {unknown} url
 * @returns {{ ok: true, url: string } | { ok: false, error: string }}
 */
export function normalizeMarketingUrl(url) {
  if (url == null || typeof url !== 'string') {
    return { ok: false, error: 'url_required' };
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, error: 'url_required' };
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return { ok: false, error: 'url_too_long' };
  }

  if (!isSafeMarketingUrl(trimmed)) {
    return { ok: false, error: 'unsafe_marketing_url' };
  }

  try {
    const parsed = new URL(trimmed);
    parsed.hash = '';
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, error: 'invalid_url' };
  }
}
