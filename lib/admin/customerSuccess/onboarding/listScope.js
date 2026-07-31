/**
 * Shared portfolio / tenant list scope for onboarding lists, metrics, and ID loads.
 * Fail closed for non–Super Admin when scope is empty — never unscoped fleet.
 */

import { resolveCsAccess, resolveCsPortfolioScope } from '../authz.js';

/**
 * @returns {{
 *   ok: true,
 *   tenantScope: string[]|null,
 *   portfolioScoped: boolean,
 *   isSuperAdmin: boolean,
 * } | {
 *   ok: false,
 *   reason: string,
 *   forbidden?: boolean,
 * }}
 */
export async function resolveOnboardingListScope(prisma, admin, args = {}) {
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
    return { ok: false, reason: 'onboarding_scope_forbidden', forbidden: true };
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
