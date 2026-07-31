import {
  coerceLocale,
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  normalizeLocale,
} from './locales.js';

function parseCookieHeader(cookieHeader, name) {
  if (!cookieHeader) return null;
  const parts = String(cookieHeader).split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) {
      try {
        return decodeURIComponent(rest.join('=') || '');
      } catch {
        return rest.join('=') || '';
      }
    }
  }
  return null;
}

function fromAcceptLanguage(header) {
  if (!header) return null;
  const tags = String(header)
    .split(',')
    .map((s) => s.trim().split(';')[0]);
  for (const tag of tags) {
    const n = normalizeLocale(tag);
    if (n) return n;
  }
  return null;
}

/**
 * Deterministic locale resolution (preference-based routing).
 */
export function resolveRequestLocale({
  request = null,
  cookieHeader = null,
  userPreferredLanguage = null,
  tenantDefaultLanguage = null,
  acceptLanguage = null,
} = {}) {
  const cookies =
    cookieHeader ||
    (request?.headers?.get ? request.headers.get('cookie') : null) ||
    '';
  const accept =
    acceptLanguage ||
    (request?.headers?.get ? request.headers.get('accept-language') : null) ||
    '';

  const fromCookie = normalizeLocale(parseCookieHeader(cookies, LOCALE_COOKIE));
  if (fromCookie) {
    return { locale: fromCookie, source: 'cookie' };
  }

  const fromUser = normalizeLocale(userPreferredLanguage);
  if (fromUser) {
    return { locale: fromUser, source: 'user' };
  }

  const fromTenant = normalizeLocale(tenantDefaultLanguage);
  if (fromTenant) {
    return { locale: fromTenant, source: 'tenant' };
  }

  const fromBrowser = fromAcceptLanguage(accept);
  if (fromBrowser) {
    return { locale: fromBrowser, source: 'accept-language' };
  }

  return { locale: DEFAULT_LOCALE, source: 'fallback' };
}

export function buildLocaleCookieOptions(locale) {
  return {
    name: LOCALE_COOKIE,
    value: coerceLocale(locale),
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE,
    sameSite: 'lax',
    httpOnly: false,
  };
}
