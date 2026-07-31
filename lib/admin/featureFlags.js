/**
 * Foundation-only admin feature flags (env-driven).
 * No business Intelligence/CRM flags here.
 */

export const ADMIN_FOUNDATION_FLAGS = Object.freeze({
  NOTIFICATION_CENTRE: 'ADMIN_FF_NOTIFICATION_CENTRE',
  STRICT_API_ENVELOPE: 'ADMIN_FF_STRICT_API_ENVELOPE',
});

/**
 * @param {string} flagName env key
 * @param {NodeJS.ProcessEnv|Record<string,string|undefined>} [env]
 */
export function isAdminFoundationFlagEnabled(flagName, env = process.env) {
  const raw = env?.[flagName];
  if (raw == null || raw === '') return false;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase());
}
