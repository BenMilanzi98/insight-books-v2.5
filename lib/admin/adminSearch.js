/**
 * Permission-aware platform search helpers (pure).
 */

import { adminHasPermission, SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * Which searchable domains the admin may query.
 * @param {object|null} admin
 * @param {(admin: object, permission: string) => boolean} [hasPermission]
 * @returns {{ tenants: boolean, users: boolean, affiliates: boolean }}
 */
export function resolveSearchScopes(admin, hasPermission = adminHasPermission) {
  return {
    tenants: hasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.tenants.view),
    users: hasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.users.view),
    affiliates: hasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.affiliates.view),
  };
}

/**
 * Server page size: default 10, max 25.
 * @param {unknown} limit
 * @returns {number}
 */
export function clampSearchLimit(limit) {
  const n = parseInt(String(limit ?? '10'), 10);
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(n, 25);
}

/**
 * Strip secrets from a user-like search hit.
 * @param {object} user
 */
export function sanitizeUserSearchHit(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    type: 'user',
  };
}

/**
 * Strip secrets from an affiliate search hit.
 * @param {object} affiliate
 */
export function sanitizeAffiliateSearchHit(affiliate) {
  if (!affiliate || typeof affiliate !== 'object') return null;
  return {
    id: affiliate.id,
    name: affiliate.name,
    email: affiliate.email,
    referralCode: affiliate.referralCode ?? null,
    type: 'affiliate',
  };
}

/**
 * Sanitize tenant search hit (no credentials).
 * @param {object} tenant
 */
export function sanitizeTenantSearchHit(tenant) {
  if (!tenant || typeof tenant !== 'object') return null;
  return {
    id: tenant.id,
    name: tenant.name,
    subdomain: tenant.subdomain,
    status: tenant.status ?? null,
    type: 'tenant',
  };
}
