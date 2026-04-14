/**
 * Central JWT secret for server-side sign/verify (admin, affiliate, registration tokens).
 *
 * - Production: JWT_SECRET must be set (min 16 chars) or getJwtSecret() throws (fail closed).
 * - Development: a fixed fallback is used only when JWT_SECRET is unset.
 */

const DEV_FALLBACK =
  'insightbooks-local-dev-only-jwt-secret-min-32-chars';

/**
 * @returns {string} Secret material.
 * @throws {Error} In production when JWT_SECRET is missing or too short.
 */
export function getJwtSecret() {
  const s = process.env.JWT_SECRET?.trim();
  if (s && s.length >= 16) return s;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT_SECRET must be set to a strong value (at least 16 characters) in production.'
    );
  }
  return DEV_FALLBACK;
}

/** Alias for signing paths (same rules as getJwtSecret). */
export function requireJwtSecretForSigning() {
  return getJwtSecret();
}
