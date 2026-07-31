/**
 * Light customer reconciliation (Phase 7 Wave 4).
 * Tenant count vs directory count, ownership orphans — basic, no false zeroes.
 */

import { resolveCustomerAccess } from './authz.js';
import { CUSTOMER_CATALOGUE_VERSION } from './catalogue.js';
import {
  activeOwnershipWhere,
  applyPortfolioTenantWhere,
  resolvePortfolioScope,
} from './portfolioScope.js';
import { listUnassignedTenantIds } from './segments.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ admin: object, now?: Date }} opts
 */
export async function buildCustomerReconciliation(prisma, opts = {}) {
  const access = resolveCustomerAccess(opts.admin);
  if (!access.canView) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  const now = opts.now || new Date();
  const scope = await resolvePortfolioScope(prisma, opts.admin, { now });
  if (!scope.canViewCustomers) {
    return {
      ok: false,
      forbidden: true,
      catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    };
  }

  const tenantWhere = applyPortfolioTenantWhere({}, scope);
  const cards = [];
  const limitations = [
    'Light reconciliation only — tenant inventory vs ownership coverage.',
    'Does not reconcile MRR, GL, or Tenant Sale (Tenant Sale is out of scope).',
    'Portfolio scope applied to countable tenants.',
  ];

  let tenantCount = null;
  let tenantCountStatus = 'UNAVAILABLE';
  try {
    if (typeof prisma?.tenant?.count !== 'function') {
      throw new Error('Tenant model unavailable');
    }
    tenantCount = await prisma.tenant.count({ where: tenantWhere });
    tenantCountStatus = 'READY';
  } catch (e) {
    limitations.push(`Tenant count UNAVAILABLE: ${e?.message || 'query failed'}`);
  }

  cards.push({
    id: 'tenant_count',
    label: 'Tenants in scope',
    value: tenantCount,
    status: tenantCountStatus,
    source: 'Tenant',
  });

  // Directory count uses the same scoped Tenant universe (identity = Tenant)
  cards.push({
    id: 'directory_count',
    label: 'Directory count (same Tenant universe)',
    value: tenantCount,
    status: tenantCountStatus,
    source: 'Tenant (directory = Tenant)',
    note:
      tenantCountStatus === 'READY'
        ? 'Directory rows are Tenants; count matches scoped tenant inventory.'
        : null,
  });

  let delta = null;
  let deltaStatus = 'UNAVAILABLE';
  if (tenantCountStatus === 'READY' && tenantCount != null) {
    delta = 0;
    deltaStatus = 'READY';
  }
  cards.push({
    id: 'tenant_vs_directory_delta',
    label: 'Tenant vs directory delta',
    value: delta,
    status: deltaStatus,
    note:
      deltaStatus === 'READY'
        ? 'Zero by construction — directory is Tenant-backed (no separate CRM identity store).'
        : 'Delta UNAVAILABLE when tenant count is UNAVAILABLE (not coerced to 0).',
  });

  let ownershipRows = null;
  let ownershipStatus = 'UNAVAILABLE';
  let distinctOwned = null;
  try {
    if (typeof prisma?.customerOwnership?.findMany !== 'function') {
      throw new Error('CustomerOwnership model unavailable');
    }
    const ownedWhere = {
      ...activeOwnershipWhere(now),
    };
    if (scope.mode === 'owned') {
      ownedWhere.tenantId = { in: scope.tenantIds || [] };
    }
    const rows = await prisma.customerOwnership.findMany({
      where: ownedWhere,
      select: { tenantId: true },
    });
    ownershipRows = (rows || []).length;
    distinctOwned = new Set((rows || []).map((r) => r.tenantId).filter(Boolean)).size;
    ownershipStatus = 'READY_WITH_LIMITATIONS';
  } catch (e) {
    limitations.push(`Ownership coverage UNAVAILABLE: ${e?.message || 'query failed'}`);
  }

  cards.push({
    id: 'active_ownership_rows',
    label: 'Active ownership rows',
    value: ownershipRows,
    status: ownershipStatus,
    source: 'CustomerOwnership',
  });

  cards.push({
    id: 'distinct_owned_tenants',
    label: 'Distinct owned tenants',
    value: distinctOwned,
    status: ownershipStatus,
    source: 'CustomerOwnership.tenantId',
  });

  let unassignedCount = null;
  let unassignedStatus = 'UNAVAILABLE';
  try {
    const unassigned = await listUnassignedTenantIds(prisma, { now, take: 2000 });
    if (unassigned.ok) {
      let ids = unassigned.tenantIds || [];
      if (scope.mode === 'owned') {
        const allowed = new Set(scope.tenantIds || []);
        ids = ids.filter((id) => allowed.has(id));
      }
      unassignedCount = ids.length;
      unassignedStatus = 'READY_WITH_LIMITATIONS';
      limitations.push(
        'Unassigned scan is capped (take≤2000) — not a guaranteed global orphan census.'
      );
    } else {
      limitations.push(`Unassigned scan UNAVAILABLE: ${unassigned.error || 'failed'}`);
    }
  } catch (e) {
    limitations.push(`Unassigned scan UNAVAILABLE: ${e?.message || 'query failed'}`);
  }

  cards.push({
    id: 'ownership_orphans',
    label: 'Ownership orphans (unassigned tenants)',
    value: unassignedCount,
    status: unassignedStatus,
    source: 'Tenant minus ACTIVE CustomerOwnership',
  });

  let coveragePct = null;
  let coverageStatus = 'UNAVAILABLE';
  if (
    tenantCountStatus === 'READY' &&
    typeof tenantCount === 'number' &&
    tenantCount > 0 &&
    typeof distinctOwned === 'number'
  ) {
    coveragePct = Math.round((distinctOwned / tenantCount) * 1000) / 10;
    coverageStatus = 'READY_WITH_LIMITATIONS';
  } else if (tenantCountStatus === 'READY' && tenantCount === 0) {
    // Empty universe — coverage UNAVAILABLE (not 0% fake)
    coverageStatus = 'UNAVAILABLE';
    limitations.push('Ownership coverage UNAVAILABLE when tenant universe is empty.');
  }

  cards.push({
    id: 'ownership_coverage_pct',
    label: 'Ownership coverage %',
    value: coveragePct,
    status: coverageStatus,
    unit: 'percent',
  });

  return {
    ok: true,
    catalogueVersion: CUSTOMER_CATALOGUE_VERSION,
    generatedAt: now.toISOString(),
    scope: {
      mode: scope.mode,
      isAgentScoped: scope.isAgentScoped,
      isManager: scope.isManager,
      isSuperAdmin: scope.isSuperAdmin,
    },
    cards,
    limitations,
  };
}
