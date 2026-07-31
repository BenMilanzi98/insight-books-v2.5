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
  // UI / SaaS labels often say "Business Owner" while the tenant role is still full-access.
  if (key === 'business_owner' || key === 'tenant_owner') return true;
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

/** Tenant pages Sales users may open (POS shell + account/subscription/switching). */
export function isPathAllowedForPosOnlyShell(pathname) {
  if (!pathname || pathname[0] !== '/') return false;
  if (pathname === '/pos' || pathname.startsWith('/pos/')) return true;
  if (pathname === '/switch-tenant' || pathname.startsWith('/switch-tenant/')) return true;
  if (pathname === '/subscription' || pathname.startsWith('/subscription/')) return true;
  if (pathname === '/account' || pathname.startsWith('/account/')) return true;
  if (pathname === '/profile' || pathname.startsWith('/profile/')) return true;
  return false;
}

/**
 * Same rule as {@link isPosDefaultLandingRole}, for session cookie `role` string (middleware).
 * @param {string | null | undefined} roleName
 */
export function isPosOnlyShellRoleName(roleName) {
  return isPosDefaultLandingRole({ role: { name: roleName } });
}
