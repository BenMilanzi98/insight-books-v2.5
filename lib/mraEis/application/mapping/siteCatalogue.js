import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';

/**
 * Read-only MRA Site Catalogue over extracted/synced sites.
 * Tenant users cannot edit MRA Site identity.
 */
export async function listMraSites({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  includeInactive = true,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const sites = await db.mraEisSite.findMany({
    where: {
      tenantId,
      businessId,
      environment: env,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: [{ siteName: 'asc' }],
  });

  const mappings = await db.mraEisSiteMapping.findMany({
    where: { tenantId, businessId, environment: env },
  });

  return sites.map((site) => {
    const related = mappings.filter((m) => m.mraSiteId === site.mraSiteId);
    const activeMappings = related.filter((m) => m.status === MAPPING_STATUS.ACTIVE);
    return {
      id: site.id,
      mraSiteId: site.mraSiteId,
      siteName: site.siteName,
      tin: site.mraTin,
      address: [site.addressLine1, site.addressLine2, site.city].filter(Boolean).join(', ') || null,
      siteType: site.siteType,
      environment: site.environment,
      active: site.active,
      configurationVersion: site.sourceConfigurationSnapshotId,
      effectiveDate: site.synchronizedAt,
      mappingStatus: activeMappings.length
        ? MAPPING_STATUS.ACTIVE
        : related.length
          ? related[0].status
          : MAPPING_STATUS.UNMAPPED,
      localBranchesMapped: [...new Set(activeMappings.map((m) => m.branchId))],
      localWarehousesMapped: [
        ...new Set(activeMappings.map((m) => m.warehouseId).filter(Boolean)),
      ],
      readOnly: true,
    };
  });
}
