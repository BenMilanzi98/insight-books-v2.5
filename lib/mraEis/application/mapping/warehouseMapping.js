import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { getMappingType, isMappingTypeBlocked } from './mappingTypeRegistry.js';
import { createSiteMapping } from '../services/mappingService.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

/**
 * Warehouse → MRA Site (provisional) or Virtual Warehouse (blocked until clarified).
 * Never creates Stock Movements or invents Virtual Warehouse IDs.
 */
export async function createWarehouseMapping({
  tenantId,
  businessId = tenantId,
  warehouseId,
  branchId = null,
  mraSiteId = null,
  mraVirtualWarehouseId = null,
  mappingType = 'WAREHOUSE_TO_MRA_SITE',
  environment = 'SANDBOX',
  status = MAPPING_STATUS.SUGGESTED,
  verifiedBy = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const type = getMappingType(mappingType);
  if (!type) throw EisErrors.validation({ message: `Unknown warehouse mapping type ${mappingType}` });

  if (mappingType === 'WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE' || mraVirtualWarehouseId) {
    if (isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE')) {
      throw EisErrors.validation({
        message: 'Virtual Warehouse mapping is blocked until MRA clarifies Virtual Warehouse requirements.',
        code: 'VIRTUAL_WAREHOUSE_MAPPING_UNVERIFIED',
        requiredAction: 'MANUAL_REVIEW',
        details: { mappingType, mraVirtualWarehouseId: null },
      });
    }
    if (!mraVirtualWarehouseId) {
      throw EisErrors.validation({ message: 'Virtual Warehouse ID must come from verified MRA configuration.' });
    }
  }

  if (!mraSiteId && mappingType === 'WAREHOUSE_TO_MRA_SITE') {
    throw EisErrors.validation({ message: 'mraSiteId is required for WAREHOUSE_TO_MRA_SITE.' });
  }

  // Reuse site mapping row with warehouseId set — does not create/modify Warehouse or stock
  if (!branchId) {
    throw EisErrors.validation({
      message: 'branchId is required to anchor warehouse site mapping (Business/Branch ownership).',
    });
  }

  const row = await createSiteMapping({
    tenantId,
    businessId,
    branchId,
    warehouseId,
    mraSiteId,
    status: status === MAPPING_STATUS.ACTIVE ? MAPPING_STATUS.SUGGESTED : status,
    verifiedBy,
    db,
  });

  await db.mraEisSiteMapping.update({
    where: { id: row.id },
    data: {
      environment: String(environment).toUpperCase(),
      mappingType,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: verifiedBy,
    actorType: verifiedBy ? 'USER' : 'SERVICE',
    action: 'WAREHOUSE_MAPPING_CREATED',
    resourceType: 'MraEisSiteMapping',
    resourceId: row.id,
    metadata: { warehouseId, mappingType, stockMovementCreated: false },
  }, db);

  return db.mraEisSiteMapping.findUnique({ where: { id: row.id } });
}

export async function evaluateWarehouseMappingRequirement({
  tenantId,
  businessId = tenantId,
  isProductBased = false,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!isProductBased) {
    return {
      required: false,
      virtualWarehouseBlocked: isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE'),
      message: 'Service-only Businesses may not require Warehouse mapping.',
    };
  }
  return {
    required: true,
    virtualWarehouseBlocked: isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE'),
    message: isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE')
      ? 'Product-based fiscalization blocked for Virtual Warehouse until MRA clarification.'
      : 'Warehouse mapping required for product-based Business.',
  };
}
