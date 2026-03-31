import prisma from '@/lib/prisma';

/**
 * Whether the user may load stock / transfer for the given tenant (same rules as /api/tenant/list).
 */
export async function userHasAccessToTenant(user, tenantId) {
  if (!user?.id || !tenantId) return false;
  if (user.role?.name === 'MASTER_ADMIN') {
    const t = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    return !!t;
  }
  if (user.tenantId === tenantId) return true;
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      tenants: { where: { id: tenantId }, select: { id: true } },
    },
  });
  return (row?.tenants?.length ?? 0) > 0;
}

/**
 * Default branch for stock operations: tenant default, else first active branch.
 * @returns {Promise<string|null>}
 */
export async function resolvePrimaryBranchForTenant(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { defaultBranchId: true },
  });
  if (tenant?.defaultBranchId) {
    const b = await prisma.branch.findFirst({
      where: { id: tenant.defaultBranchId, tenantId, isActive: true },
      select: { id: true },
    });
    if (b) return b.id;
  }
  const first = await prisma.branch.findFirst({
    where: { tenantId, isActive: true },
    orderBy: [{ name: 'asc' }],
    select: { id: true },
  });
  return first?.id ?? null;
}
