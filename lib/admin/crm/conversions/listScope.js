/**
 * Conversion list / metrics / export / search scope — Phase 20 Wave 4.
 * Sales-team / territory / customer / tenant fail-closed for non–Super Admin.
 * Never fail-open to global fleet counts.
 */

import { resolveCrmAccess } from '../authz.js';

function asIdList(value) {
  if (!Array.isArray(value)) return null;
  return value.map(String).filter(Boolean);
}

/**
 * @param {import('@prisma/client').PrismaClient} _prisma
 * @param {object|null|undefined} admin
 * @param {{
 *   tenantIds?: string[],
 *   portfolioTenantIds?: string[],
 *   customerIds?: string[],
 *   salesTeamIds?: string[],
 *   teamIds?: string[],
 *   territoryIds?: string[],
 * }} [args]
 */
export async function resolveConversionListScope(_prisma, admin, args = {}) {
  const access = resolveCrmAccess(admin);
  if (
    !access.canViewOpportunities &&
    !access.canView &&
    !access.canExport &&
    !access.isSuperAdmin
  ) {
    return { ok: false, reason: 'conversion_scope_forbidden', forbidden: true };
  }

  const tenantIds = asIdList(args.tenantIds ?? args.portfolioTenantIds);
  const customerIds = asIdList(args.customerIds);
  const salesTeamIds = asIdList(args.salesTeamIds ?? args.teamIds);
  const territoryIds = asIdList(args.territoryIds);

  const provided = [
    ['tenant', tenantIds, args.tenantIds ?? args.portfolioTenantIds],
    ['customer', customerIds, args.customerIds],
    ['salesTeam', salesTeamIds, args.salesTeamIds ?? args.teamIds],
    ['territory', territoryIds, args.territoryIds],
  ];

  let anyExplicit = false;
  for (const [kind, ids, raw] of provided) {
    if (raw === undefined) continue;
    anyExplicit = true;
    if (!ids || ids.length === 0) {
      return {
        ok: false,
        reason: `${kind}_scope_empty`,
        failClosed: true,
      };
    }
  }

  if (anyExplicit) {
    return {
      ok: true,
      tenantIds: tenantIds && tenantIds.length ? tenantIds : null,
      customerIds: customerIds && customerIds.length ? customerIds : null,
      salesTeamIds: salesTeamIds && salesTeamIds.length ? salesTeamIds : null,
      territoryIds: territoryIds && territoryIds.length ? territoryIds : null,
      portfolioScoped: true,
      failClosed: true,
      isSuperAdmin: Boolean(access.isSuperAdmin),
    };
  }

  if (access.isSuperAdmin) {
    return {
      ok: true,
      tenantIds: null,
      customerIds: null,
      salesTeamIds: null,
      territoryIds: null,
      portfolioScoped: false,
      isSuperAdmin: true,
    };
  }

  // Non–Super Admin without explicit scope → fail closed (never global fleet).
  return {
    ok: false,
    reason: 'conversion_scope_required',
    failClosed: true,
  };
}

/**
 * Build Prisma-style where from conversion scope.
 * Uses denormalized tenantId / customerId / teamId / territoryId on rows.
 */
export function whereFromConversionScope(scope = {}) {
  const clauses = [];
  if (Array.isArray(scope.tenantIds) && scope.tenantIds.length) {
    clauses.push({ tenantId: { in: scope.tenantIds } });
  }
  if (Array.isArray(scope.customerIds) && scope.customerIds.length) {
    clauses.push({ customerId: { in: scope.customerIds } });
  }
  if (Array.isArray(scope.salesTeamIds) && scope.salesTeamIds.length) {
    clauses.push({ teamId: { in: scope.salesTeamIds } });
  }
  if (Array.isArray(scope.territoryIds) && scope.territoryIds.length) {
    clauses.push({ territoryId: { in: scope.territoryIds } });
  }
  if (!clauses.length) return {};
  if (clauses.length === 1) return clauses[0];
  return { AND: clauses };
}
