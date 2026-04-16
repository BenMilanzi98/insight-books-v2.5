/**
 * Tenant-scoped roles that should have full product permissions (mirrors `/api/auth/me` backfill intent).
 * Used server-side (auth) and client-side (permissions) — keep free of Prisma/server-only imports.
 */

/**
 * @param {{ role?: { name?: string | null } | null } | null | undefined} | null | undefined} user
 * @returns {boolean}
 */
export function isFullAccessTenantRole(user) {
  const name = user?.role?.name;
  if (!name || typeof name !== 'string') return false;
  const n = name.trim().toUpperCase();
  return n === 'OWNER' || n === 'ADMIN' || n === 'MASTER_ADMIN';
}
