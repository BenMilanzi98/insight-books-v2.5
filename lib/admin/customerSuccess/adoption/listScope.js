/**
 * Shared portfolio / tenant list scope for adoption lists.
 * Fail closed for non–Super Admin when scope is empty — never unscoped fleet.
 */

import { resolveCsAccess, resolveCsPortfolioScope } from '../authz.js';

export async function resolveAdoptionListScope(prisma, admin, args = {}) {
  if (Array.isArray(args.portfolioTenantIds)) {
    if (args.portfolioTenantIds.length === 0) {
      return { ok: false, reason: 'portfolio_scope_empty' };
    }
    return {
      ok: true,
      tenantScope: args.portfolioTenantIds.map(String),
      portfolioScoped: true,
      isSuperAdmin: false,
    };
  }

  const access = resolveCsAccess(admin);
  if (!access.canView && !access.canManageCases && !access.isSuperAdmin) {
    return { ok: false, reason: 'adoption_scope_forbidden', forbidden: true };
  }

  const scope = await resolveCsPortfolioScope(prisma, admin, { now: args.now });

  if (access.isSuperAdmin && scope.mode === 'all' && scope.isSuperAdmin) {
    return {
      ok: true,
      tenantScope: null,
      portfolioScoped: false,
      isSuperAdmin: true,
    };
  }

  const ids = Array.isArray(scope.tenantIds) ? scope.tenantIds.map(String) : [];
  if (!ids.length) {
    return { ok: false, reason: 'portfolio_scope_required' };
  }

  return {
    ok: true,
    tenantScope: ids,
    portfolioScoped: true,
    isSuperAdmin: Boolean(access.isSuperAdmin),
  };
}

export function tenantWhereFromScope(tenantScope) {
  if (tenantScope == null) return {};
  return { tenantId: { in: tenantScope } };
}

/**
 * Fail-closed write/list tenant check: portfolio empty → deny; foreign tenant → deny.
 * Super Admin unscoped (tenantScope null) may write any tenant (including null pins).
 */
export async function assertAdoptionTenantInScope(prisma, admin, args = {}, tenantId = null) {
  const scopeResult = await resolveAdoptionListScope(prisma, admin, args);
  if (!scopeResult.ok) {
    if (scopeResult.forbidden) {
      return { ok: false, forbidden: true, error: 'adoption_access_forbidden' };
    }
    return {
      ok: false,
      forbidden: true,
      notFound: true,
      error: 'adoption_tenant_out_of_scope',
      reason: scopeResult.reason,
    };
  }

  if (scopeResult.tenantScope != null) {
    const tid = tenantId != null && String(tenantId).trim() ? String(tenantId).trim() : '';
    if (!tid || !scopeResult.tenantScope.includes(tid)) {
      return {
        ok: false,
        forbidden: true,
        notFound: true,
        error: 'adoption_tenant_out_of_scope',
        lockedTenantId: tid || null,
      };
    }
  }

  return { ok: true, scopeResult };
}
