import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

export const BUSINESS_EIS_TYPE = Object.freeze({
  PRODUCT_BASED: 'PRODUCT_BASED',
  SERVICE_BASED: 'SERVICE_BASED',
  MIXED_PRODUCT_AND_SERVICE: 'MIXED_PRODUCT_AND_SERVICE',
  UNKNOWN: 'UNKNOWN',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

/**
 * Explicit Business EIS classification from local sellable records.
 * Does not convert Products↔Services or mutate Inventory.
 */
export async function classifyBusinessEisType({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  actorId = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();

  const [productCount, serviceCount] = await Promise.all([
    db.product.count({
      where: {
        tenantId: businessId,
        isDeleted: false,
        isService: false,
      },
    }).catch(() => 0),
    db.product.count({
      where: { tenantId: businessId, isDeleted: false, isService: true },
    }).catch(() => 0),
  ]);

  let businessType = BUSINESS_EIS_TYPE.UNKNOWN;
  if (productCount > 0 && serviceCount > 0) businessType = BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE;
  else if (productCount > 0) businessType = BUSINESS_EIS_TYPE.PRODUCT_BASED;
  else if (serviceCount > 0) businessType = BUSINESS_EIS_TYPE.SERVICE_BASED;

  const result = {
    tenantId,
    businessId,
    environment: env,
    businessType,
    productCount,
    serviceCount,
    requiresProductMapping: [BUSINESS_EIS_TYPE.PRODUCT_BASED, BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE].includes(businessType),
    requiresServiceMapping: [BUSINESS_EIS_TYPE.SERVICE_BASED, BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE].includes(businessType),
    requiresInitialInventoryEvaluation: [BUSINESS_EIS_TYPE.PRODUCT_BASED, BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE].includes(businessType),
    blocking: businessType === BUSINESS_EIS_TYPE.UNKNOWN,
    blockers: businessType === BUSINESS_EIS_TYPE.UNKNOWN ? ['BUSINESS_TYPE_UNKNOWN'] : [],
    classificationVersion: 'phase10-business-eis-type-v1',
    evaluatedAt: new Date().toISOString(),
  };

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId,
    actorType: actorId ? 'USER' : 'SERVICE',
    action: 'BUSINESS_EIS_TYPE_CLASSIFIED',
    resourceType: 'Business',
    resourceId: businessId,
    environment: env,
    metadata: {
      businessType,
      productCount,
      serviceCount,
      inventoryMutated: false,
      masterDataConverted: false,
    },
  }, db).catch(() => {});

  return result;
}
