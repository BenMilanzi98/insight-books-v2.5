/**
 * Central JWT secret for server-side sign/verify (admin, affiliate, registration tokens).
 *
 * Resolution order:
 * 1. JWT_SECRET (trimmed, min 16 chars) when set.
 * 2. SESSION_SECRET (trimmed, min 16 chars) when JWT_SECRET is unset or too short — common
 *    on hosts that only configured session/docker env and omitted JWT_SECRET.
 * 3. Development: fixed local fallback when neither is usable.
 * 4. Production: throws if no usable secret (fail closed).
 */

const DEV_FALLBACK =
  'insightbooks-local-dev-only-jwt-secret-min-32-chars';

function pickSecret(value) {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length >= 16 ? t : '';
}

/**
 * @returns {string} Secret material.
 * @throws {Error} In production when no usable JWT or session secret is configured.
 */
export function getJwtSecret() {
  const fromJwt = pickSecret(process.env.JWT_SECRET);
  if (fromJwt) return fromJwt;
  const fromSession = pickSecret(process.env.SESSION_SECRET);
  if (fromSession) return fromSession;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET (or SESSION_SECRET as fallback) must be set to at least 16 characters in production.'
    );
  }
  return DEV_FALLBACK;
}

/** Alias for signing paths (same rules as getJwtSecret). */
export function requireJwtSecretForSigning() {
  return getJwtSecret();
}
