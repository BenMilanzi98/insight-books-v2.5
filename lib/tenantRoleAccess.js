/**
 * Tenant-scoped roles that should have full product permissions (mirrors `/api/auth/me` backfill intent).
 * Used server-side (auth) and client-side (permissions) — keep free of Prisma/server-only imports.
 *
 * Matches common variants: "Owner", "Admin", "MASTER_ADMIN", "Master Admin", etc.
 * Does not match substrings like "Accountant" (exact normalized keys only).
 */

/**
 * @param {{ role?: { name?: string | null } | null } | null | undefined} | null | undefined} user
 * @returns {boolean}
 */
export function isFullAccessTenantRole(user) {
  const name = user?.role?.name;
  if (!name || typeof name !== 'string') return false;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (key === 'owner' || key === 'admin' || key === 'administrator') return true;
  if (key === 'master_admin' || key === 'masteradmin') return true;
  if (key === 'super_admin' || key === 'superadmin') return true;
  return false;
}

/** POS-first roles: never land on financial dashboard (even if legacy perms included dashboard.view). */
export function isPosDefaultLandingRole(user) {
  const name = user?.role?.name;
  if (!name || typeof name !== 'string') return false;
  const key = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return key === 'sales';
}

/**
 * Same rule as {@link isPosDefaultLandingRole}, for session cookie `role` string (middleware).
 * @param {string | null | undefined} roleName
 */
export function isPosOnlyShellRoleName(roleName) {
  return isPosDefaultLandingRole({ role: { name: roleName } });
}
