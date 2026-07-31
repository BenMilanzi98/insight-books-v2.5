/**
 * Customer portfolio scope — Wave 3 ownership gate.
 *
 * Rules (documented):
 * - Super Admin: see all tenants
 * - Admin with customers.read / managePortfolios and ZERO ACTIVE ownership
 *   rows as ownerAdminId: see all (manager pattern)
 * - Admin with >=1 ACTIVE ownership as ownerAdminId: ONLY those tenants
 *   (portfolio-scoped agent). Platform Support / agents with ownership are
 *   restricted; without ownership rows they follow the manager "see all" path
 *   when they hold customers.read.
 *
 * Not AdminTenantAccess / Tenant.ownerUserId.
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { resolveCustomerAccess } from './authz.js';

export const OWNERSHIP_STATUS = Object.freeze({
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
});

/**
 * Active ownership predicate for a point in time.
 * @param {Date} [now]
 */
export function activeOwnershipWhere(now = new Date()) {
  return {
    status: OWNERSHIP_STATUS.ACTIVE,
    OR: [{ endAt: null }, { endAt: { gt: now } }],
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} ownerAdminId
 * @param {Date} [now]
 * @returns {Promise<string[]>}
 */
export async function listOwnedTenantIds(prisma, ownerAdminId, now = new Date()) {
  if (!prisma?.customerOwnership?.findMany || !ownerAdminId) return [];
  const rows = await prisma.customerOwnership.findMany({
    where: {
      ownerAdminId: String(ownerAdminId),
      ...activeOwnershipWhere(now),
    },
    select: { tenantId: true },
  });
  return [...new Set((rows || []).map((r) => r.tenantId).filter(Boolean))];
}

/**
 * Resolve whether the admin is portfolio-scoped and which tenant ids apply.
 *
 * Scope rules (documented):
 * - Super Admin: all
 * - customers.read / managePortfolios / dashboard.view (via resolveCustomerAccess)
 *   with ZERO ACTIVE ownership as ownerAdminId: all (manager)
 * - >=1 ACTIVE ownership as ownerAdminId: ONLY those tenants (agent)
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object|null|undefined} admin
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{
 *   mode: 'all'|'owned'|'none',
 *   tenantIds: string[]|null,
 *   isSuperAdmin: boolean,
 *   isManager: boolean,
 *   isAgentScoped: boolean,
 *   canViewCustomers: boolean,
 * }>}
 */
export async function resolvePortfolioScope(prisma, admin, opts = {}) {
  const now = opts.now || new Date();
  const empty = {
    mode: 'none',
    tenantIds: [],
    isSuperAdmin: false,
    isManager: false,
    isAgentScoped: false,
    canViewCustomers: false,
  };

  if (!admin) return empty;

  const isSuper = isSuperAdminRole(admin.role);
  const access = resolveCustomerAccess(admin);
  const manage = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.managePortfolios,
  });
  const canViewCustomers = Boolean(isSuper || access.canView || manage.allowed);

  if (isSuper) {
    return {
      mode: 'all',
      tenantIds: null,
      isSuperAdmin: true,
      isManager: false,
      isAgentScoped: false,
      canViewCustomers: true,
    };
  }

  if (!canViewCustomers) {
    return { ...empty, canViewCustomers: false };
  }

  let ownedIds = [];
  try {
    ownedIds = await listOwnedTenantIds(prisma, admin.id, now);
  } catch {
    // Missing table / client → treat as manager (no ownership rows) so directory
    // still works until SQL fallback / prisma generate is applied.
    ownedIds = [];
  }

  if (ownedIds.length >= 1) {
    return {
      mode: 'owned',
      tenantIds: ownedIds,
      isSuperAdmin: false,
      isManager: false,
      isAgentScoped: true,
      canViewCustomers: true,
    };
  }

  // Zero ownership assignments → manager: see all
  return {
    mode: 'all',
    tenantIds: null,
    isSuperAdmin: false,
    isManager: true,
    isAgentScoped: false,
    canViewCustomers: true,
  };
}

/**
 * Assert tenant is in the admin's portfolio scope.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object|null|undefined} admin
 * @param {string} tenantId
 * @param {{ now?: Date }} [opts]
 * @returns {Promise<{ ok: true } | { ok: false, forbidden: true, reason: string }>}
 */
export async function assertTenantInPortfolio(prisma, admin, tenantId, opts = {}) {
  const tid = tenantId ? String(tenantId) : '';
  if (!tid) {
    return { ok: false, forbidden: true, reason: 'tenant_required' };
  }

  const scope = await resolvePortfolioScope(prisma, admin, opts);
  if (!scope.canViewCustomers) {
    return { ok: false, forbidden: true, reason: 'customers_forbidden' };
  }
  if (scope.mode === 'all') {
    return { ok: true };
  }
  if (scope.mode === 'owned' && scope.tenantIds?.includes(tid)) {
    return { ok: true };
  }
  return { ok: false, forbidden: true, reason: 'out_of_portfolio_scope' };
}

/**
 * Merge portfolio tenant restriction into a Prisma Tenant where clause.
 * @param {object} where
 * @param {{ mode: string, tenantIds: string[]|null }} scope
 */
export function applyPortfolioTenantWhere(where, scope) {
  const next = { ...(where || {}) };
  if (!scope || scope.mode === 'all') return next;
  if (scope.mode === 'owned') {
    const ids = Array.isArray(scope.tenantIds) ? scope.tenantIds : [];
    if (ids.length === 0) {
      next.id = { in: [] };
      return next;
    }
    if (next.id && typeof next.id === 'string') {
      next.id = ids.includes(next.id) ? next.id : { in: [] };
    } else if (next.id?.in) {
      const allowed = new Set(ids);
      next.id = { in: next.id.in.filter((id) => allowed.has(id)) };
    } else {
      next.id = { in: ids };
    }
  }
  return next;
}
