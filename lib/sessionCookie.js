/**
 * Shared options for the tenant app session cookie so login / switch / refresh stay aligned.
 */
export const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

const BASE64_SESSION_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;

/**
 * Parse base64 JSON session payload (same format as login sets). Returns null if invalid.
 * Kept in this file (no Prisma) so middleware can import it safely.
 */
export function parseSessionPayload(sessionValue) {
  if (sessionValue == null || typeof sessionValue !== 'string') return null;
  const trimmed = sessionValue.trim();
  if (!trimmed || !BASE64_SESSION_REGEX.test(trimmed)) return null;
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf8');
    if (!decoded?.trim()) return null;
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    const raw = data.userId;
    const userId =
      typeof raw === 'string'
        ? raw.trim()
        : raw != null && (typeof raw === 'number' || typeof raw === 'bigint')
          ? String(raw)
          : '';
    if (!userId) return null;
    return { ...data, userId };
  } catch {
    return null;
  }
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
