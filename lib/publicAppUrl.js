/**
 * Canonical base URL for **user-facing links inside emails** (login, password reset, etc.).
 *
 * Why IPs appear today: `NEXT_PUBLIC_APP_URL` / `APP_URL` are often set to `http://203.0.113.1:3000`
 * in dev, or `x-forwarded-host` / `request.url` resolves to an internal IP behind a proxy.
 * Those values are fine for server-to-server calls but are wrong in customer inboxes.
 *
 * Resolution order:
 * 1. `PUBLIC_APP_URL` — recommended: production web origin for emails only (e.g. https://app.example.com)
 * 2. `APP_URL` / `NEXT_PUBLIC_APP_URL` — only used if hostname is **not** a bare IPv4 / localhost
 * 3. `x-forwarded-proto` + `x-forwarded-host` — only if host is not IP/localhost
 * 4. Fallback: https://insightbooksafrica.com
 *
 * To force an IP or localhost in email links (rare): set `PUBLIC_APP_URL` to that full origin.
 */

const DEFAULT_EMAIL_APP_BASE = 'https://insightbooksafrica.com';

function isIpV4(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname || '');
}

function isLocalOrIpHost(hostname) {
  if (!hostname) return true;
  const h = String(hostname).toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  if (isIpV4(h)) return true;
  return false;
}

function normalizeOriginAnyHost(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) return null;
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const u = new URL(withScheme);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

/**
 * @param {string} raw - Full URL or host-like string
 * @returns {string|null} Normalized origin (no trailing slash) or null if unusable for email
 */
function normalizeOriginCandidate(raw) {
  const any = normalizeOriginAnyHost(raw);
  if (!any) return null;
  try {
    const u = new URL(any);
    if (isLocalOrIpHost(u.hostname)) return null;
    return any;
  } catch {
    return null;
  }
}

/**
 * @param {{ forwardedProto?: string | null, forwardedHost?: string | null }} [options] - From incoming Request headers when building reset links on the server
 * @returns {string} Origin without trailing slash
 */
export function getPublicAppBaseUrlForEmail(options = {}) {
  const fromDedicated = normalizeOriginAnyHost(process.env.PUBLIC_APP_URL);
  if (fromDedicated) return fromDedicated;

  const fromApp = normalizeOriginCandidate(process.env.APP_URL);
  if (fromApp) return fromApp;

  const fromNext = normalizeOriginCandidate(process.env.NEXT_PUBLIC_APP_URL);
  if (fromNext) return fromNext;

  const proto = (options.forwardedProto || 'https').replace(/:$/, '');
  const hostHeader = (options.forwardedHost || '').split(',')[0].trim();
  if (hostHeader) {
    const hostOnly = hostHeader.includes(']')
      ? hostHeader.replace(/^\[/, '').split(']')[0]
      : hostHeader.split(':')[0];
    if (!isLocalOrIpHost(hostOnly)) {
      return `${proto}://${hostHeader}`;
    }
  }

  return DEFAULT_EMAIL_APP_BASE;
}
