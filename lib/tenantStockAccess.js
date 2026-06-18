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

  const owned = await prisma.tenant.findFirst({
    where: { id: tenantId, ownerUserId: user.id },
    select: { id: true },
  });
  if (owned) return true;

  const [membership, row] = await Promise.all([
    prisma.tenantMembership.findFirst({
      where: {
        userId: user.id,
        tenantId,
        status: { equals: 'active', mode: 'insensitive' },
      },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        tenants: { where: { id: tenantId }, select: { id: true } },
      },
    }),
  ]);
  if (membership) return true;
  return (row?.tenants?.length ?? 0) > 0;
}

/**
 * Hidden primary branch: the first branch created for the tenant (by createdAt).
 * Legacy tenants with multiple branches always use that first row; others are ignored.
 * @param {string} tenantId
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} [db]
 * @returns {Promise<string|null>}
 */
export async function resolvePrimaryBranchForTenant(tenantId, db = prisma) {
  if (!tenantId) return null;
  const first = await db.branch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  return first?.id ?? null;
}

/**
 * Ensures a tenant has an active primary branch for stock / transfers.
 * Uses the first branch ever created; reactivates if needed, syncs tenant.defaultBranchId,
 * or creates "Main location" when none exist.
 * @param {string} tenantId
 * @param {import('@prisma/client').Prisma.TransactionClient | typeof prisma} [db]
 * @returns {Promise<string|null>} branch id or null if tenant missing
 */
export async function ensurePrimaryBranchForTenant(tenantId, db = prisma) {
  if (!tenantId) return null;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true },
  });
  if (!tenant) return null;

  const first = await db.branch.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, isActive: true },
  });

  if (first) {
    if (!first.isActive) {
      await db.branch.update({
        where: { id: first.id },
        data: { isActive: true },
      });
    }
    await db.tenant.update({
      where: { id: tenantId },
      data: { defaultBranchId: first.id },
    });
    return first.id;
  }

  const rawLabel = tenant.name ? `${tenant.name} — stock` : 'Main location';
  const name = rawLabel.length > 120 ? rawLabel.slice(0, 120) : rawLabel;

  const created = await db.branch.create({
    data: {
      tenantId,
      name,
      isActive: true,
    },
    select: { id: true },
  });

  await db.tenant.update({
    where: { id: tenantId },
    data: { defaultBranchId: created.id },
  });

  return created.id;
}
