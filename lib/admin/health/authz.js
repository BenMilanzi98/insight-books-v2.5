/**
 * Customer Health auth helpers.
 * Read: intel.customerHealth.read OR intel.customers.read OR dashboard.view
 * Manage definitions / rebuild: dedicated perms (Super Admin break-glass).
 *
 * Portfolio scope for fleet endpoints:
 * - Super Admin → all
 * - customers.read holders → Phase 7 resolvePortfolioScope (owned | manager all)
 * - health.read only → ownership constrains; zero ownership → empty (never fleet-wide)
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { resolveCustomerAccess } from '@/lib/admin/customers/authz.js';
import {
  assertTenantInPortfolio,
  listOwnedTenantIds,
  resolvePortfolioScope,
} from '@/lib/admin/customers/portfolioScope.js';

/**
 * @param {object|null|undefined} admin
 */
export function resolveHealthAccess(admin) {
  const healthRead = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRead,
  });
  const customers = resolveCustomerAccess(admin);
  const manageDefinitions = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthManageDefinitions,
  });
  const rebuild = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.intel.customerHealthRebuild,
  });

  const canView = Boolean(healthRead.allowed || customers.canView);
  return {
    canView,
    canManageDefinitions: Boolean(manageDefinitions.allowed),
    canRebuild: Boolean(rebuild.allowed),
    healthReadAllowed: healthRead.allowed,
    customersAllowed: customers.canView,
    financeOk: customers.financeOk,
    financeMasked: customers.financeMasked,
  };
}

/**
 * Portfolio scope for health list/overview/export.
 * Never returns unscoped fleet data for non–super-admin health-only readers.
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
 *   canView: boolean,
 *   canViewCustomers: boolean,
 * }>}
 */
export async function resolveHealthPortfolioScope(prisma, admin, opts = {}) {
  const access = resolveHealthAccess(admin);
  const empty = {
    mode: 'none',
    tenantIds: [],
    isSuperAdmin: false,
    isManager: false,
    isAgentScoped: false,
    canView: false,
    canViewCustomers: false,
  };

  if (!admin || !access.canView) return empty;

  if (isSuperAdminRole(admin.role)) {
    return {
      mode: 'all',
      tenantIds: null,
      isSuperAdmin: true,
      isManager: false,
      isAgentScoped: false,
      canView: true,
      canViewCustomers: true,
    };
  }

  // Holders of customers.read follow Phase 7 portfolio rules (owned | manager all)
  if (access.customersAllowed) {
    const scope = await resolvePortfolioScope(prisma, admin, opts);
    return {
      mode: scope.mode,
      tenantIds: scope.tenantIds,
      isSuperAdmin: scope.isSuperAdmin,
      isManager: scope.isManager,
      isAgentScoped: scope.isAgentScoped,
      canView: true,
      canViewCustomers: scope.canViewCustomers,
    };
  }

  // Health-only reader: ownership constrains; no ownership → empty (not fleet-wide)
  const now = opts.now || new Date();
  let ownedIds = [];
  try {
    ownedIds = await listOwnedTenantIds(prisma, admin.id, now);
  } catch {
    ownedIds = [];
  }

  return {
    mode: 'owned',
    tenantIds: ownedIds,
    isSuperAdmin: false,
    isManager: false,
    isAgentScoped: true,
    canView: true,
    canViewCustomers: false,
  };
}

/**
 * Portfolio-scoped tenant gate for health reads.
 * Reuses Phase 7 ownership rules; health.read alone is enough to enter the gate.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} admin
 * @param {string} tenantId
 * @param {{ now?: Date }} [opts]
 */
export async function assertHealthTenantAccess(prisma, admin, tenantId, opts = {}) {
  const access = resolveHealthAccess(admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'health_forbidden' };
  }

  const tid = tenantId ? String(tenantId) : '';
  if (!tid) {
    return { ok: false, forbidden: true, reason: 'tenant_required' };
  }

  if (isSuperAdminRole(admin?.role)) {
    return { ok: true };
  }

  // Prefer Phase 7 portfolio assert when customers view is available
  if (access.customersAllowed) {
    return assertTenantInPortfolio(prisma, admin, tid, opts);
  }

  // Health-only: must be in ownership portfolio (empty portfolio → forbid)
  const scope = await resolveHealthPortfolioScope(prisma, admin, opts);
  if (scope.mode === 'all') return { ok: true };
  if (scope.mode === 'owned' && scope.tenantIds?.includes(tid)) {
    return { ok: true };
  }
  return { ok: false, forbidden: true, reason: 'out_of_portfolio_scope' };
}

/**
 * Build Prisma where.tenantId filter from health portfolio scope.
 * @param {{ mode: string, tenantIds: string[]|null }} scope
 * @returns {null|{ in: string[] }|undefined} null = no filter (all); undefined unused
 */
export function healthTenantIdFilter(scope) {
  if (!scope || scope.mode === 'all') return null;
  if (scope.mode === 'owned') {
    return { in: Array.isArray(scope.tenantIds) ? scope.tenantIds : [] };
  }
  // mode none → empty set (never unscoped fleet)
  return { in: [] };
}

export { resolvePortfolioScope, assertTenantInPortfolio };
