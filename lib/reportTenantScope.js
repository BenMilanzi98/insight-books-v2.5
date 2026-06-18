/**
 * Shared tenant/business scope resolution for reports, exports, and accounting views.
 * Reuses dashboard scope contract: ?aggregate=all | ?tenantIds=id1,id2 | default session tenant.
 */
import prisma from '@/lib/prisma';
import {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
} from '@/lib/dashboardTenantScope';
import { resolveHiddenPrimaryBranchId } from '@/lib/hiddenPrimaryBranch';

export {
  getAccessibleTenantIdsForUser,
  parseDashboardTenantScope,
  tenantWhereIn,
  userForDashboardBranchFilter,
};

/**
 * @param {Request} request
 * @returns {URLSearchParams}
 */
export function getReportSearchParams(request) {
  const url = request.nextUrl ?? request.url;
  if (typeof url === 'object' && url?.searchParams) return url.searchParams;
  return new URL(typeof url === 'string' ? url : '', 'http://localhost').searchParams;
}

/**
 * Parse optional group reporting currency (ISO 4217, e.g. MWK, USD).
 * @param {URLSearchParams} searchParams
 * @returns {string|null}
 */
export function parseReportingCurrencyParam(searchParams) {
  const raw = String(searchParams?.get('reportingCurrency') || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(raw) ? raw : null;
}

/**
 * Build report header metadata for UI and exports.
 * @param {{ id: string, name: string }[]} tenants
 * @param {{ tenantIds: string[], branchScoped: boolean }} scope
 */
export function buildReportScopeMetadata(tenants, scope, extra = {}) {
  const ordered = (scope.tenantIds || [])
    .map((id) => tenants.find((t) => t.id === id))
    .filter(Boolean);

  const mode =
    ordered.length === 0
      ? 'none'
      : ordered.length === 1
        ? 'single'
        : 'multi';

  return {
    mode,
    tenantIds: scope.tenantIds,
    branchScoped: scope.branchScoped,
    businessNames: ordered.map((t) => t.name),
    businessLabel:
      mode === 'single'
        ? ordered[0]?.name || 'Business'
        : mode === 'multi'
          ? ordered.map((t) => t.name).join(', ')
          : 'No businesses selected',
    businesses: ordered.map((t) => ({ id: t.id, name: t.name })),
    ...extra,
  };
}

/**
 * Resolve authorized tenant scope for a report/export request.
 * @returns {Promise<
 *   | { ok: false, status: number, error: string }
 *   | {
 *       ok: true,
 *       tenantIds: string[],
 *       branchScoped: boolean,
 *       tenants: { id: string, name: string, logoUrl?: string|null }[],
 *       scope: ReturnType<typeof buildReportScopeMetadata>,
 *       branchId: string|null,
 *       userQ: object,
 *       tw: object,
 *     }
 * >}
 */
export async function resolveReportTenantScope(request, user, options = {}) {
  if (!user?.id) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const accessible = await getAccessibleTenantIdsForUser(user);
  if (!accessible.length) {
    return { ok: false, status: 403, error: 'No businesses assigned to this user' };
  }

  const searchParams = getReportSearchParams(request);
  const scopeResult = parseDashboardTenantScope(searchParams, user, accessible);
  if (!scopeResult.ok) {
    return { ok: false, status: 403, error: scopeResult.error || 'No permitted businesses in scope' };
  }

  const { tenantIds, branchScoped } = scopeResult;
  const reportingCurrency = parseReportingCurrencyParam(searchParams);

  let branchId = null;
  if (branchScoped && tenantIds.length === 1) {
    branchId = await resolveHiddenPrimaryBranchId(tenantIds[0]);
  }

  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true, logoUrl: true },
    orderBy: { name: 'asc' },
  });

  const scope = buildReportScopeMetadata(tenants, scopeResult, {
    reportingCurrency,
    ...options.extraScope,
  });

  return {
    ok: true,
    tenantIds,
    branchScoped,
    tenants,
    scope,
    reportingCurrency,
    branchId,
    userQ: userForDashboardBranchFilter(user, branchScoped),
    tw: tenantWhereIn(tenantIds),
  };
}

/**
 * Reject unauthorized tenant IDs in request body (mutations).
 */
export function filterAuthorizedTenantIds(requestedIds, accessibleIds) {
  const allowed = new Set(accessibleIds || []);
  return (requestedIds || []).filter((id) => allowed.has(id));
}
