import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, TERMINAL_STATUS } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { validateBusinessTaxpayerIdentity } from './businessTaxpayerIdentity.js';
import { getMappingType } from './mappingTypeRegistry.js';
import { evaluateSplitPaymentSupport } from './splitPaymentPolicy.js';

export const MAPPING_OPERATIONS = Object.freeze({
  VIEW_MAPPINGS: 'VIEW_MAPPINGS',
  CREATE_MAPPING: 'CREATE_MAPPING',
  VERIFY_MAPPING: 'VERIFY_MAPPING',
  APPROVE_MAPPING: 'APPROVE_MAPPING',
  ACTIVATE_MAPPING: 'ACTIVATE_MAPPING',
  RESOLVE_SITE: 'RESOLVE_SITE',
  RESOLVE_TAX: 'RESOLVE_TAX',
  RESOLVE_LEVY: 'RESOLVE_LEVY',
  RESOLVE_PAYMENT: 'RESOLVE_PAYMENT',
  START_PRODUCT_MAPPING: 'START_PRODUCT_MAPPING',
  CREATE_FISCAL_SNAPSHOT: 'CREATE_FISCAL_SNAPSHOT',
  ENABLE_PRODUCTION_OPERATION: 'ENABLE_PRODUCTION_OPERATION',
});

/**
 * Server-authoritative mapping readiness for Phase 9.
 * Product/Service mapping completeness remains Phase 10 placeholders.
 */
export async function evaluateMraEisMappingReadiness({
  tenantId,
  businessId = tenantId,
  branchId = null,
  warehouseId = null,
  terminalId = null,
  environment = 'SANDBOX',
  requestedOperation = MAPPING_OPERATIONS.VIEW_MAPPINGS,
  transactionDate = null,
  actorContext = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];
  const requiredActions = [];
  const evaluatedAt = new Date().toISOString();

  const activeConfig = await db.mraEisConfigurationSnapshot.findFirst({
    where: {
      tenantId,
      businessId,
      environment: env,
      status: 'ACTIVE',
    },
    orderBy: { activatedAt: 'desc' },
  });

  const activeConfigurationAvailable = Boolean(activeConfig);
  let configurationCurrent = false;
  if (activeConfig) {
    const health = await db.mraEisConfigurationHealth?.findFirst?.({
      where: { tenantId, businessId, environment: env },
    }).catch?.(() => null);
    configurationCurrent = !health || health.status !== 'STALE';
    if (!configurationCurrent) {
      blockers.push('MAPPING_CONFIGURATION_STALE');
      requiredActions.push('REFRESH_CONFIGURATION');
    }
  } else {
    blockers.push('ACTIVE_CONFIGURATION_REQUIRED');
    requiredActions.push('SYNC_CONFIGURATION');
  }

  const identity = await validateBusinessTaxpayerIdentity({
    tenantId,
    businessId,
    environment: env,
    db,
  }).catch((err) => ({
    status: 'CONFIGURATION_MISSING',
    blockers: [err?.code || 'IDENTITY_VALIDATION_FAILED'],
    warnings: [],
  }));

  const taxpayerIdentityMapped = identity.status === 'MATCHED' || identity.status === 'NAME_DIFFERENCE_WARNING';
  if (!taxpayerIdentityMapped) {
    blockers.push(...(identity.blockers || ['BUSINESS_TAXPAYER_IDENTITY_MISMATCH']));
  }
  warnings.push(...(identity.warnings || []));

  const [siteActive, taxActive, taxConflict, levyActive, payActive, staleCount, conflictCount] =
    await Promise.all([
      db.mraEisSiteMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE, ...(branchId ? { branchId } : {}) },
      }),
      db.mraEisTaxMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
      }),
      db.mraEisTaxMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.CONFLICT },
      }),
      db.mraEisLevyMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
      }),
      db.mraEisPaymentMethodMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.ACTIVE },
      }),
      db.mraEisSiteMapping.count({
        where: { tenantId, businessId, environment: env, status: MAPPING_STATUS.STALE },
      }),
      db.mraEisTaxMapping.count({
        where: { tenantId, businessId, environment: env, status: { in: [MAPPING_STATUS.CONFLICT, MAPPING_STATUS.STALE] } },
      }),
    ]);

  // Branch uses tenantId (= businessId). Count branches lacking an active site mapping.
  const branches = await db.branch.findMany({
    where: { tenantId: businessId, isActive: true, ...(branchId ? { id: branchId } : {}) },
    select: { id: true },
  }).catch(() => []);
  const branchCount = branches.length;
  let mappedBranchCount = 0;
  if (branchCount > 0) {
    const mapped = await db.mraEisSiteMapping.findMany({
      where: {
        tenantId,
        businessId,
        environment: env,
        status: MAPPING_STATUS.ACTIVE,
        branchId: { in: branches.map((b) => b.id) },
      },
      select: { branchId: true },
      distinct: ['branchId'],
    });
    mappedBranchCount = mapped.length;
  }
  let branchSiteMappingComplete = branchCount === 0 ? siteActive > 0 : mappedBranchCount >= branchCount;
  if (branchCount > 0 && !branchSiteMappingComplete) {
    blockers.push('BRANCH_SITE_MAPPING_REQUIRED');
    requiredActions.push('MAP_BRANCH_TO_MRA_SITE');
  }

  const vwType = getMappingType('WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE');
  let warehouseMappingComplete = true;
  if (vwType?.contractStatus === 'REQUIRES_MRA_CLARIFICATION') {
    warehouseMappingComplete = false;
    warnings.push('VIRTUAL_WAREHOUSE_MAPPING_UNVERIFIED');
  }

  let terminalSiteConsistent = true;
  if (terminalId) {
    const terminal = await db.mraEisTerminal.findFirst({
      where: { id: terminalId, tenantId, businessId },
    });
    if (terminal) {
      if (terminal.status !== TERMINAL_STATUS.ACTIVE && terminal.status !== 'ACTIVE') {
        warnings.push('TERMINAL_NOT_ACTIVE');
      }
      if (branchId && terminal.branchId && terminal.branchId !== branchId) {
        terminalSiteConsistent = false;
        blockers.push('TERMINAL_SITE_MISMATCH');
      }
    }
  }

  const taxMappingComplete = taxActive > 0;
  if (!taxMappingComplete) {
    blockers.push('TAX_MAPPING_REQUIRED');
    requiredActions.push('MAP_TAX_RATES');
  }
  if (taxConflict > 0) {
    blockers.push('TAX_MAPPING_CONFLICT');
  }

  const levyMappingComplete = true; // optional unless local levies exist
  const paymentMappingComplete = payActive > 0;
  if (!paymentMappingComplete) {
    blockers.push('PAYMENT_MAPPING_REQUIRED');
    requiredActions.push('MAP_PAYMENT_METHODS');
  }

  const split = evaluateSplitPaymentSupport([{ method: 'CASH' }, { method: 'MOBILE_MONEY' }]);
  if (split.blocked) {
    warnings.push('SPLIT_PAYMENT_UNSUPPORTED');
  }

  // Phase 10 placeholders — always incomplete for production fiscalization
  const ProductMappingCompletePlaceholder = false;
  const ServiceMappingCompletePlaceholder = false;

  const unresolvedConflicts = conflictCount + taxConflict;
  const staleMappings = staleCount;
  if (staleMappings > 0) {
    blockers.push('MAPPING_STALE');
    requiredActions.push('REVALIDATE_MAPPINGS');
  }

  const missingMappings = [];
  if (!branchSiteMappingComplete) missingMappings.push('SITE');
  if (!taxMappingComplete) missingMappings.push('TAX');
  if (!paymentMappingComplete) missingMappings.push('PAYMENT');
  missingMappings.push('PRODUCT'); // Phase 10
  missingMappings.push('SERVICE'); // Phase 10

  const unsupportedMappings = [];
  if (vwType?.contractStatus === 'REQUIRES_MRA_CLARIFICATION') {
    unsupportedMappings.push('VIRTUAL_WAREHOUSE');
  }
  if (split.blocked) unsupportedMappings.push('SPLIT_PAYMENT');

  // Operation-specific gates
  const resolveOps = [
    MAPPING_OPERATIONS.RESOLVE_SITE,
    MAPPING_OPERATIONS.RESOLVE_TAX,
    MAPPING_OPERATIONS.RESOLVE_LEVY,
    MAPPING_OPERATIONS.RESOLVE_PAYMENT,
    MAPPING_OPERATIONS.CREATE_FISCAL_SNAPSHOT,
    MAPPING_OPERATIONS.ENABLE_PRODUCTION_OPERATION,
  ];

  if (requestedOperation === MAPPING_OPERATIONS.START_PRODUCT_MAPPING) {
    requiredActions.push('COMPLETE_PHASE_9_MAPPINGS_FIRST');
  }
  if (requestedOperation === MAPPING_OPERATIONS.CREATE_FISCAL_SNAPSHOT
      || requestedOperation === MAPPING_OPERATIONS.ENABLE_PRODUCTION_OPERATION) {
    blockers.push('PRODUCT_MAPPING_REQUIRED');
    blockers.push('SERVICE_MAPPING_REQUIRED');
  }

  const phase9CoreReady =
    activeConfigurationAvailable
    && taxpayerIdentityMapped
    && branchSiteMappingComplete
    && taxMappingComplete
    && paymentMappingComplete
    && unresolvedConflicts === 0
    && staleMappings === 0
    && terminalSiteConsistent;

  const effectiveReady =
    phase9CoreReady
    && !resolveOps.includes(requestedOperation)
      ? true
      : phase9CoreReady && requestedOperation !== MAPPING_OPERATIONS.ENABLE_PRODUCTION_OPERATION
        && requestedOperation !== MAPPING_OPERATIONS.CREATE_FISCAL_SNAPSHOT;

  // For resolve ops: phase9 core is enough for site/tax/payment resolve (product still later)
  let effectiveReadyFinal = phase9CoreReady;
  if (
    requestedOperation === MAPPING_OPERATIONS.CREATE_FISCAL_SNAPSHOT
    || requestedOperation === MAPPING_OPERATIONS.ENABLE_PRODUCTION_OPERATION
  ) {
    effectiveReadyFinal = false;
  }
  if (requestedOperation === MAPPING_OPERATIONS.VIEW_MAPPINGS
      || requestedOperation === MAPPING_OPERATIONS.CREATE_MAPPING
      || requestedOperation === MAPPING_OPERATIONS.VERIFY_MAPPING) {
    effectiveReadyFinal = activeConfigurationAvailable || requestedOperation === MAPPING_OPERATIONS.VIEW_MAPPINGS;
  }

  return {
    activeConfigurationAvailable,
    configurationCurrent: activeConfigurationAvailable && configurationCurrent,
    taxpayerIdentityMapped,
    branchSiteMappingComplete,
    warehouseMappingComplete,
    terminalSiteConsistent,
    taxMappingComplete,
    levyMappingComplete,
    paymentMappingComplete,
    ProductMappingCompletePlaceholder,
    ServiceMappingCompletePlaceholder,
    unresolvedConflicts,
    staleMappings,
    missingMappings,
    unsupportedMappings,
    effectiveReady: Boolean(effectiveReadyFinal),
    phase9CoreReady,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    requiredActions: [...new Set(requiredActions)],
    readinessVersion: 'phase9-mapping-readiness-v1',
    evaluatedAt,
    environment: env,
    requestedOperation,
    identityStatus: identity.status,
    configurationSnapshotId: activeConfig?.id || null,
    actorId: actorContext?.actorId || null,
    warehouseId,
    transactionDate: transactionDate || null,
  };
}
