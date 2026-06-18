import prisma from '@/lib/prisma';

/**
 * Tenant IDs the user may use for dashboard/report aggregation.
 * Matches /api/tenant/list access resolution: memberships, M2M, owner, session tenant.
 * MASTER_ADMIN: all tenants.
 */
export async function getAccessibleTenantIdsForUser(user) {
  if (!user?.id) return [];

  if (user.role?.name === 'MASTER_ADMIN') {
    const rows = await prisma.tenant.findMany({
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  const set = new Set();
  if (user.tenantId) set.add(user.tenantId);

  const [membershipRows, userWithTenants, ownedTenants] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: {
        userId: user.id,
        status: { equals: 'active', mode: 'insensitive' },
      },
      select: { tenantId: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { tenants: { select: { id: true } } },
    }),
    prisma.tenant.findMany({
      where: { ownerUserId: user.id },
      select: { id: true },
    }),
  ]);

  for (const row of membershipRows) {
    if (row.tenantId) set.add(row.tenantId);
  }
  for (const t of userWithTenants?.tenants || []) {
    if (t?.id) set.add(t.id);
  }
  for (const t of ownedTenants || []) {
    if (t?.id) set.add(t.id);
  }

  return [...set];
}

export function tenantWhereIn(tenantIds) {
  if (!tenantIds?.length) return { tenantId: { in: [] } };
  if (tenantIds.length === 1) return { tenantId: tenantIds[0] };
  return { tenantId: { in: tenantIds } };
}

/**
 * Branch filters apply only when viewing a single business that matches the session tenant.
 * Otherwise omit branch scoping so totals span all branches in each selected tenant.
 */
export function userForDashboardBranchFilter(user, branchScoped) {
  if (!user) return user;
  if (branchScoped) return user;
  return {
    ...user,
    currentBranchId: null,
    allowedBranchIds: null,
  };
}

/**
 * @param {URLSearchParams} searchParams
 * @param {{ tenantId?: string, role?: { name?: string } }} user
 * @param {string[]} accessibleTenantIds
 * @returns {{ ok: true, tenantIds: string[], branchScoped: boolean } | { ok: false, error?: string }}
 */
export function parseDashboardTenantScope(searchParams, user, accessibleTenantIds) {
  const aggregate = searchParams.get('aggregate') === 'all';
  const rawIds = searchParams.get('tenantIds');

  let requested = [];
  if (aggregate) {
    requested = [...accessibleTenantIds];
  } else if (rawIds?.trim()) {
    requested = rawIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  } else if (user.tenantId) {
    requested = [user.tenantId];
  }

  if (!requested.length && accessibleTenantIds.length > 0) {
    requested = [accessibleTenantIds[0]];
  }

  const accessibleSet = new Set(accessibleTenantIds);
  const tenantIds = requested.filter((id) => accessibleSet.has(id));

  if (!tenantIds.length) {
    return { ok: false, error: 'No permitted businesses in scope' };
  }

  const branchScoped =
    tenantIds.length === 1 && tenantIds[0] === user.tenantId;

  return { ok: true, tenantIds, branchScoped };
}
