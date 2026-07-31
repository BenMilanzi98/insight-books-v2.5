/**
 * Apply TENANT allow-list to Prisma where clauses for limited admins.
 * PLATFORM_GLOBAL / Super Admin → no extra filter.
 */

import { isSuperAdminRole } from './catalogue.js';
import { adminJsonGrantsPermission } from './evaluateGrant.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} admin
 * @param {object} [baseWhere]
 * @returns {Promise<object>}
 */
export async function withAdminTenantFilter(prisma, admin, baseWhere = {}) {
  if (!admin) {
    return { ...baseWhere, id: '__denied__' };
  }

  if (isSuperAdminRole(admin.role)) {
    return baseWhere;
  }

  // Explicit platform-global ops permission: full tenant visibility for list ops
  if (adminJsonGrantsPermission(admin, 'systemAdmin.tenants.view')) {
    const links =
      typeof prisma.adminTenantAccess?.findMany === 'function'
        ? await prisma.adminTenantAccess.findMany({
            where: {
              adminId: admin.id,
              isActive: true,
              OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
            },
            select: { tenantId: true },
          })
        : [];

    // No allow-list rows → platform-global view (current product behaviour for billing/support ops)
    if (!links.length) {
      return baseWhere;
    }

    const ids = links.map((l) => l.tenantId);
    if (baseWhere.id) {
      return {
        AND: [baseWhere, { id: { in: ids } }],
      };
    }
    return {
      ...baseWhere,
      id: { in: ids },
    };
  }

  // No tenants.view → deny all tenants
  return { ...baseWhere, id: '__denied__' };
}
