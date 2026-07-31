/**
 * Customer Success auth helpers (Phase 8 Wave 3).
 * Read: customerSuccess.read
 * Manage cases/tasks/interventions: customerSuccess.manageCases
 * Renewal outcomes: customerSuccess.manageRenewals
 * Portfolio scope via Phase 7 resolvePortfolioScope / assertTenantInPortfolio.
 */

import { isSuperAdminRole } from '@/lib/admin/authorization/catalogue.js';
import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  assertTenantInPortfolio,
  resolvePortfolioScope,
  applyPortfolioTenantWhere,
} from '@/lib/admin/customers/portfolioScope.js';
import { resolveCustomerAccess } from '@/lib/admin/customers/authz.js';

/**
 * @param {object|null|undefined} admin
 */
export function resolveCsAccess(admin) {
  const read = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.customerSuccess.read,
  });
  const manageCases = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageCases,
  });
  const manageRenewals = authorizeAdminDecision({
    admin,
    permission: SYSTEM_ADMIN_PERMISSIONS.customerSuccess.manageRenewals,
  });
  const customers = resolveCustomerAccess(admin);
  const isSuper = isSuperAdminRole(admin?.role);

  return {
    canView: Boolean(isSuper || read.allowed),
    canManageCases: Boolean(isSuper || manageCases.allowed),
    canManageRenewals: Boolean(isSuper || manageRenewals.allowed),
    customersAllowed: customers.canView,
    isSuperAdmin: isSuper,
  };
}

/**
 * Portfolio scope for CS lists. Prefer customers.read portfolio rules;
 * CS-read holders with ownership still scope; zero ownership + CS read only → empty
 * (never unscoped fleet for agents without customers manager path).
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object|null|undefined} admin
 * @param {{ now?: Date }} [opts]
 */
export async function resolveCsPortfolioScope(prisma, admin, opts = {}) {
  const access = resolveCsAccess(admin);
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

  if (access.isSuperAdmin) {
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

  // Holders of customers.read follow Phase 7 (owned | manager all)
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

  // CS-only: reuse portfolio resolve but deny manager-all without customers.read
  const scope = await resolvePortfolioScope(prisma, admin, opts);
  if (scope.isAgentScoped) {
    return {
      mode: 'owned',
      tenantIds: scope.tenantIds || [],
      isSuperAdmin: false,
      isManager: false,
      isAgentScoped: true,
      canView: true,
      canViewCustomers: false,
    };
  }

  // CS read without customers.read and without ownership → empty (not fleet-wide)
  return {
    mode: 'owned',
    tenantIds: [],
    isSuperAdmin: false,
    isManager: false,
    isAgentScoped: true,
    canView: true,
    canViewCustomers: false,
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} admin
 * @param {string} tenantId
 * @param {{ now?: Date }} [opts]
 */
export async function assertCsTenantAccess(prisma, admin, tenantId, opts = {}) {
  const access = resolveCsAccess(admin);
  if (!access.canView) {
    return { ok: false, forbidden: true, reason: 'cs_forbidden' };
  }

  const tid = tenantId ? String(tenantId) : '';
  if (!tid) {
    return { ok: false, forbidden: true, reason: 'tenant_required' };
  }

  if (access.isSuperAdmin) return { ok: true };

  if (access.customersAllowed) {
    return assertTenantInPortfolio(prisma, admin, tid, opts);
  }

  const scope = await resolveCsPortfolioScope(prisma, admin, opts);
  if (scope.mode === 'all') return { ok: true };
  if (scope.mode === 'owned' && scope.tenantIds?.includes(tid)) {
    return { ok: true };
  }
  return { ok: false, forbidden: true, reason: 'out_of_portfolio_scope' };
}

/**
 * @param {{ mode: string, tenantIds: string[]|null }} scope
 * @returns {null|{ in: string[] }}
 */
export function csTenantIdFilter(scope) {
  if (!scope || scope.mode === 'all') return null;
  if (scope.mode === 'owned') {
    return { in: Array.isArray(scope.tenantIds) ? scope.tenantIds : [] };
  }
  return { in: [] };
}

export {
  resolvePortfolioScope,
  assertTenantInPortfolio,
  applyPortfolioTenantWhere,
};
