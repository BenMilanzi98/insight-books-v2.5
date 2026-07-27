import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, EXTERNAL_CATALOGUE_TYPE } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { classifyBusinessEisType, BUSINESS_EIS_TYPE } from './businessTypeClassification.js';
import { discoverRequiredLocalItems } from './localItemDiscovery.js';
import { getBundlePolicy } from './crossTypeAndBundlePolicy.js';
import { evaluateInitialMraInventoryRequirement } from './initialInventory.js';

export async function calculateProductServiceCompleteness({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const businessClass = await classifyBusinessEisType({ tenantId, businessId, environment: env, db });
  const required = await discoverRequiredLocalItems({ tenantId, businessId, db });

  const productIds = required.productsRequired.map((p) => p.localProductId);
  const serviceIds = required.servicesRequired.map((s) => s.localServiceId);

  const [productMapped, serviceMapped, productConflict, serviceConflict, productStale, serviceStale, activeProducts, activeServices] =
    await Promise.all([
      productIds.length
        ? db.mraEisProductMapping.findMany({
            where: { tenantId, businessId, localItemId: { in: productIds }, status: MAPPING_STATUS.ACTIVE },
            select: { localItemId: true },
            distinct: ['localItemId'],
          })
        : [],
      serviceIds.length
        ? db.mraEisProductMapping.findMany({
            where: { tenantId, businessId, localServiceId: { in: serviceIds }, status: MAPPING_STATUS.ACTIVE },
            select: { localServiceId: true },
            distinct: ['localServiceId'],
          })
        : [],
      db.mraEisProductMapping.count({
        where: { tenantId, businessId, localItemId: { not: null }, status: MAPPING_STATUS.CONFLICT },
      }),
      db.mraEisProductMapping.count({
        where: { tenantId, businessId, localServiceId: { not: null }, status: MAPPING_STATUS.CONFLICT },
      }),
      db.mraEisProductMapping.count({
        where: { tenantId, businessId, localItemId: { not: null }, status: MAPPING_STATUS.STALE },
      }),
      db.mraEisProductMapping.count({
        where: { tenantId, businessId, localServiceId: { not: null }, status: MAPPING_STATUS.STALE },
      }),
      db.mraEisExternalCatalogueItem.count({
        where: { tenantId, businessId, environment: env, externalType: EXTERNAL_CATALOGUE_TYPE.PRODUCT, active: true, supersededAt: null },
      }),
      db.mraEisExternalCatalogueItem.count({
        where: { tenantId, businessId, environment: env, externalType: EXTERNAL_CATALOGUE_TYPE.SERVICE, active: true, supersededAt: null },
      }),
    ]);

  const localProductsRequired = productIds.length;
  const localProductsMapped = productMapped.length;
  const localProductsMissing = Math.max(0, localProductsRequired - localProductsMapped);
  const localServicesRequired = serviceIds.length;
  const localServicesMapped = serviceMapped.length;
  const localServicesMissing = Math.max(0, localServicesRequired - localServicesMapped);

  const blockers = [...businessClass.blockers];
  const warnings = [];
  const nextActions = [];
  const bundle = getBundlePolicy();
  if (bundle.blocked) warnings.push('BUNDLE_MAPPING_UNSUPPORTED');

  if (businessClass.requiresProductMapping && activeProducts === 0) {
    blockers.push('PRODUCT_CATALOGUE_REQUIRED');
    nextActions.push('SYNC_PRODUCT_CATALOGUE');
  }
  if (businessClass.requiresServiceMapping && activeServices === 0) {
    blockers.push('SERVICE_CATALOGUE_REQUIRED');
    nextActions.push('SYNC_SERVICE_CATALOGUE');
  }
  if (businessClass.requiresProductMapping && localProductsMissing > 0) {
    blockers.push('PRODUCT_MAPPING_REQUIRED');
    nextActions.push('MAP_PRODUCTS');
  }
  if (businessClass.requiresServiceMapping && localServicesMissing > 0) {
    blockers.push('SERVICE_MAPPING_REQUIRED');
    nextActions.push('MAP_SERVICES');
  }
  if (productConflict > 0) blockers.push('PRODUCT_MAPPING_CONFLICT');
  if (serviceConflict > 0) blockers.push('SERVICE_MAPPING_CONFLICT');
  if (productStale > 0) blockers.push('PRODUCT_MAPPING_STALE');
  if (serviceStale > 0) blockers.push('SERVICE_MAPPING_STALE');

  // Mixed: both required
  if (businessClass.businessType === BUSINESS_EIS_TYPE.MIXED_PRODUCT_AND_SERVICE) {
    if (localProductsMissing === 0 && localServicesMissing > 0) {
      blockers.push('SERVICE_MAPPING_REQUIRED');
    }
    if (localServicesMissing === 0 && localProductsMissing > 0) {
      blockers.push('PRODUCT_MAPPING_REQUIRED');
    }
  }

  const inventory = await evaluateInitialMraInventoryRequirement({
    tenantId,
    businessId,
    environment: env,
    productMappingsComplete: localProductsMissing === 0 && businessClass.requiresProductMapping,
    db,
  });
  if (inventory.blockers?.length) blockers.push(...inventory.blockers);
  warnings.push(...(inventory.warnings || []));

  let overallStatus = 'NOT_STARTED';
  const anyMapped = localProductsMapped + localServicesMapped > 0;
  const productsOk = !businessClass.requiresProductMapping || localProductsMissing === 0;
  const servicesOk = !businessClass.requiresServiceMapping || localServicesMissing === 0;
  const conflicts = productConflict + serviceConflict;
  const stale = productStale + serviceStale;

  if (businessClass.businessType === BUSINESS_EIS_TYPE.UNKNOWN) overallStatus = 'BLOCKED';
  else if (conflicts > 0) overallStatus = 'CONFLICTED';
  else if (stale > 0) overallStatus = 'STALE';
  else if (productsOk && servicesOk && inventory.initialUploadRequired && !inventory.initialUploadContractVerified) {
    overallStatus = 'BLOCKED';
  } else if (productsOk && servicesOk) overallStatus = 'COMPLETE_FOR_CURRENT_USAGE';
  else if (anyMapped) overallStatus = 'PARTIALLY_COMPLETE';
  else overallStatus = 'INCOMPLETE';

  return {
    tenantId,
    businessId,
    environment: env,
    businessType: businessClass.businessType,
    activeConfigurationChecksum: null,
    activeCatalogueVersionSummary: { products: activeProducts, services: activeServices },
    localProductsRequired,
    localProductsMapped,
    localProductsMissing,
    localProductsConflicted: productConflict,
    localProductsStale: productStale,
    localServicesRequired,
    localServicesMapped,
    localServicesMissing,
    localServicesConflicted: serviceConflict,
    localServicesStale: serviceStale,
    ProductVariantsRequired: 0,
    ProductVariantsMapped: 0,
    UomMappingsRequired: 0,
    UomMappingsMissing: 0,
    taxConsistencyFailures: 0,
    levyConsistencyFailures: 0,
    inactiveExternalMappings: 0,
    bundleBlockers: bundle.blocked ? 1 : 0,
    initialInventoryStatus: inventory,
    overallStatus,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    nextActions: [...new Set(nextActions)],
    calculatedAt: new Date().toISOString(),
    completenessVersion: 'phase10-product-service-completeness-v1',
  };
}
