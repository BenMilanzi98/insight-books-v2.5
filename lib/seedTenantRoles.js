import { getDefaultRoleTemplates } from '@/lib/defaultRoleTemplates';

/**
 * Upsert the default role templates for a tenant.
 * @param {string} tenantId
 * @param {import('@prisma/client').PrismaClient} prismaOrTx
 * @returns {Promise<Record<string, {id: string, name: string}>>} roles by name
 */
export async function seedDefaultRolesForTenant(tenantId, prismaOrTx) {
  const templates = getDefaultRoleTemplates();
  const out = {};

  for (const tpl of templates) {
    const role = await prismaOrTx.role.upsert({
      where: {
        name_tenantId: {
          name: tpl.name,
          tenantId,
        },
      },
      update: {
        description: tpl.description,
        permissions: tpl.permissions,
      },
      create: {
        name: tpl.name,
        description: tpl.description,
        tenantId,
        permissions: tpl.permissions,
      },
      select: { id: true, name: true },
    });
    out[role.name] = role;
  }

  return out;
}

