/**
 * Reconcile User↔Tenant M2M and TenantMembership for multi-business users.
 * Used by POST /api/tenant/sync-my-businesses (Owner/Admin/owner record).
 */
import { seedDefaultRolesForTenant } from '@/lib/seedTenantRoles';

/**
 * @param {string} userId
 * @param {import('@prisma/client').PrismaClient} db
 * @returns {Promise<{ tenantIds: string[], m2mLinksApplied: number, membershipsEnsured: number, errors: Array<{ tenantId: string, step: string, message: string }> }>}
 */
export async function syncUserTenantBusinessLinks(userId, db) {
  const [ownedTenants, memberships, userRow] = await Promise.all([
    db.tenant.findMany({
      where: { ownerUserId: userId },
      select: { id: true },
    }),
    db.tenantMembership.findMany({
      where: {
        userId,
        status: { equals: 'active', mode: 'insensitive' },
      },
      select: { tenantId: true },
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { tenantId: true, tenants: { select: { id: true } } },
    }),
  ]);

  const tenantIds = new Set();
  for (const t of ownedTenants) {
    if (t?.id) tenantIds.add(t.id);
  }
  for (const m of memberships) {
    if (m?.tenantId) tenantIds.add(m.tenantId);
  }
  if (userRow?.tenantId) tenantIds.add(userRow.tenantId);
  for (const t of userRow?.tenants || []) {
    if (t?.id) tenantIds.add(t.id);
  }

  const errors = [];
  let m2mLinksApplied = 0;
  let membershipsEnsured = 0;

  for (const tenantId of tenantIds) {
    try {
      await db.user.update({
        where: { id: userId },
        data: { tenants: { connect: { id: tenantId } } },
      });
      m2mLinked++;
    } catch {
      /* already connected */
    }

    const tenant = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { ownerUserId: true },
    });

    if (tenant?.ownerUserId !== userId) {
      continue;
    }

    let ownerRole = await db.role.findFirst({
      where: { tenantId, name: 'Owner' },
      select: { id: true },
    });

    if (!ownerRole?.id) {
      try {
        const seeded = await seedDefaultRolesForTenant(tenantId, db);
        ownerRole = seeded?.Owner ? { id: seeded.Owner.id } : null;
      } catch (e) {
        errors.push({
          tenantId,
          step: 'seedRoles',
          message: e?.message || String(e),
        });
        continue;
      }
    }

    if (!ownerRole?.id) {
      errors.push({
        tenantId,
        step: 'ownerRole',
        message: 'Owner role not found for tenant',
      });
      continue;
    }

    try {
      await db.tenantMembership.upsert({
        where: {
          userId_tenantId: { userId, tenantId },
        },
        create: {
          userId,
          tenantId,
          roleId: ownerRole.id,
          status: 'active',
        },
        update: {
          status: 'active',
          roleId: ownerRole.id,
        },
      });
      membershipsEnsured++;
    } catch (e) {
      errors.push({
        tenantId,
        step: 'tenantMembership',
        message: e?.message || String(e),
      });
    }
  }

  return {
    tenantIds: [...tenantIds],
    m2mLinksApplied,
    membershipsEnsured,
    errors,
  };
}
