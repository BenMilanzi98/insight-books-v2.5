/**
 * Shared options for the tenant app session cookie so login / switch / refresh stay aligned.
 * Supports signed v2 tokens (HMAC) and legacy unsigned base64 payloads.
 */

import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const BASE64_SESSION_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
const V2_PREFIX = 'v2.';

function getSigningSecret() {
  return (
    process.env.SESSION_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    null
  );
}

/**
 * Parse session payload (signed v2 or legacy base64 JSON). Returns null if invalid.
 * Kept free of Prisma so middleware can import it safely.
 */
export function parseSessionPayload(sessionValue) {
  if (sessionValue == null || typeof sessionValue !== 'string') return null;
  const trimmed = sessionValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(V2_PREFIX)) {
    const rest = trimmed.slice(V2_PREFIX.length);
    const lastDot = rest.lastIndexOf('.');
    if (lastDot <= 0) return null;
    const b64 = rest.slice(0, lastDot);
    const sig = rest.slice(lastDot + 1);
    const secret = getSigningSecret();
    if (!secret) return null;
    const expected = createHmac('sha256', secret).update(`${V2_PREFIX}${b64}`).digest('hex');
    try {
      const a = Buffer.from(sig, 'hex');
      const b = Buffer.from(expected, 'hex');
      if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    } catch {
      return null;
    }
    try {
      const json = Buffer.from(b64, 'base64url').toString('utf8');
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return null;
      const userId = normalizeUserId(data.userId);
      if (!userId) return null;
      return { ...data, userId, _signed: true };
    } catch {
      return null;
    }
  }

  // Legacy unsigned base64
  if (process.env.ALLOW_LEGACY_UNSIGNED_SESSION === 'false') return null;
  if (!BASE64_SESSION_REGEX.test(trimmed) && !/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    // allow standard base64
  }
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (!decoded?.trim()) return null;
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    const userId = normalizeUserId(data.userId);
    if (!userId) return null;
    return { ...data, userId, _signed: false, _legacy: true };
  } catch {
    return null;
  }
}

function normalizeUserId(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw != null && (typeof raw === 'number' || typeof raw === 'bigint')) return String(raw);
  return '';
}

export function getSessionCookieOptions(overrides = {}) {
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_COOKIE_MAX_AGE,
    ...overrides,
  };
}
