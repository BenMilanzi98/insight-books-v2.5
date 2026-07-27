import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { discoverRequiredMappings } from './requiredMappingDiscovery.js';
import { isMappingTypeBlocked } from './mappingTypeRegistry.js';

/**
 * Deterministic Business-scoped mapping completeness.
 * Product/Service remain Phase 10 placeholders — never mark production-complete without them.
 */
export async function calculateMraEisMappingCompleteness({
  tenantId,
  businessId = tenantId,
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const calculatedAt = new Date().toISOString();
  const required = await discoverRequiredMappings({ tenantId, businessId, environment: env, db });

  const [
    siteActive,
    siteConflict,
    taxActive,
    taxConflict,
    levyActive,
    payActive,
    payUnsupported,
    staleSite,
    staleTax,
    config,
  ] = await Promise.all([
    db.mraEisSiteMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
    }),
    db.mraEisSiteMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.CONFLICT },
    }),
    db.mraEisTaxMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
    }),
    db.mraEisTaxMapping.count({
      where: {
        tenantId,
        businessId,
        environment: env,
        status: { in: [MAPPING_STATUS.CONFLICT, MAPPING_STATUS.STALE] },
      },
    }),
    db.mraEisLevyMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
    }),
    db.mraEisPaymentMethodMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
    }),
    db.mraEisPaymentMethodMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.BLOCKED },
    }),
    db.mraEisSiteMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.STALE },
    }),
    db.mraEisTaxMapping.count({
      where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.STALE },
    }),
    db.mraEisConfigurationSnapshot.findFirst({
      where: { tenantId, businessId, environment: env, status: 'ACTIVE' },
      orderBy: { activatedAt: 'desc' },
      select: { id: true, checksum: true, configurationVersion: true },
    }),
  ]);

  const siteMappingsRequired = required.siteMappingsRequired;
  const siteMappingsMissing = Math.max(0, siteMappingsRequired - siteActive);
  const warehouseMappingsRequired = required.warehouseMappingsRequired;
  const warehouseMappingsMissing = warehouseMappingsRequired; // Virtual WH unverified → all missing/blocked
  const taxMappingsRequired = required.taxMappingsRequired;
  const taxMappingsMissing = Math.max(0, taxMappingsRequired - taxActive);
  const levyMappingsRequired = required.levyMappingsRequired;
  const levyMappingsMissing = Math.max(0, levyMappingsRequired - levyActive);
  const paymentMappingsRequired = required.paymentMappingsRequired;
  const paymentMappingsMissing = Math.max(0, paymentMappingsRequired - payActive);

  const blockers = [...required.blockers];
  const warnings = [...required.warnings];
  const nextActions = [];

  if (siteMappingsMissing > 0) {
    blockers.push('BRANCH_SITE_MAPPING_REQUIRED');
    nextActions.push('MAP_BRANCHES_TO_MRA_SITES');
  }
  if (taxMappingsMissing > 0) {
    blockers.push('TAX_MAPPING_REQUIRED');
    nextActions.push('MAP_TAX_RATES');
  }
  if (paymentMappingsMissing > 0) {
    blockers.push('PAYMENT_MAPPING_REQUIRED');
    nextActions.push('MAP_PAYMENT_METHODS');
  }
  if (siteConflict + taxConflict > 0) blockers.push('TAX_MAPPING_CONFLICT');
  if (staleSite + staleTax > 0) {
    blockers.push('MAPPING_STALE');
    nextActions.push('REVALIDATE_MAPPINGS');
  }
  if (isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE') && warehouseMappingsRequired > 0) {
    blockers.push('VIRTUAL_WAREHOUSE_MAPPING_REQUIRED');
    warnings.push('VIRTUAL_WAREHOUSE_REQUIRES_MRA_CLARIFICATION');
  }
  if (isMappingTypeBlocked('SPLIT_PAYMENT_TO_MRA_REPRESENTATION')) {
    warnings.push('SPLIT_PAYMENT_UNSUPPORTED');
  }

  // Phase 10 placeholders
  blockers.push('PRODUCT_MAPPING_REQUIRED');
  blockers.push('SERVICE_MAPPING_REQUIRED');
  nextActions.push('START_PHASE_10_PRODUCT_SERVICE_MAPPING');

  let overallStatus = 'NOT_STARTED';
  const anyActive = siteActive + taxActive + payActive + levyActive > 0;
  const phase9LocalComplete =
    siteMappingsMissing === 0
    && taxMappingsMissing === 0
    && paymentMappingsMissing === 0
    && levyMappingsMissing === 0
    && siteConflict === 0
    && taxConflict === 0
    && staleSite + staleTax === 0;

  if (!anyActive && siteMappingsRequired === 0 && taxMappingsRequired === 0) {
    overallStatus = 'NOT_STARTED';
  } else if (siteConflict + taxConflict > 0) {
    overallStatus = 'CONFLICTED';
  } else if (staleSite + staleTax > 0) {
    overallStatus = 'STALE';
  } else if (warehouseMappingsRequired > 0 && isMappingTypeBlocked('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE')) {
    overallStatus = 'BLOCKED';
  } else if (phase9LocalComplete) {
    overallStatus = 'COMPLETE_FOR_CURRENT_LOCAL_USAGE';
  } else if (anyActive) {
    overallStatus = 'PARTIALLY_COMPLETE';
  } else {
    overallStatus = 'INCOMPLETE';
  }

  // Never COMPLETE until Phase 10 product/service mappings exist
  if (overallStatus === 'COMPLETE') overallStatus = 'COMPLETE_FOR_CURRENT_LOCAL_USAGE';

  return {
    tenantId,
    businessId,
    environment: env,
    configurationSetChecksum: config?.checksum || null,
    taxpayerIdentityComplete: required.taxpayerIdentityRequired ? required.taxpayerIdentitySatisfied : true,
    siteMappingsRequired,
    siteMappingsActive: siteActive,
    siteMappingsMissing,
    warehouseMappingsRequired,
    warehouseMappingsActive: 0,
    warehouseMappingsMissing,
    taxMappingsRequired,
    taxMappingsActive: taxActive,
    taxMappingsMissing,
    taxMappingsConflicted: taxConflict,
    levyMappingsRequired,
    levyMappingsActive: levyActive,
    levyMappingsMissing,
    paymentMappingsRequired,
    paymentMappingsActive: payActive,
    paymentMappingsMissing,
    paymentMappingsUnsupported: payUnsupported,
    ProductMappingsPlaceholder: false,
    ServiceMappingsPlaceholder: false,
    overallStatus,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    nextActions: [...new Set(nextActions)],
    calculatedAt,
    completenessVersion: 'phase9-mapping-completeness-v1',
  };
}
