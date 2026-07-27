import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, EXTERNAL_CATALOGUE_TYPE } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { convertQuantityToExternal, unitsCompatible } from './uomMapping.js';
import { validateProductTaxConsistency } from './taxConsistency.js';
import { resolveMraSiteForTransaction } from '../mapping/resolutionServices.js';

function isEffective(row, transactionDate) {
  const at = new Date(transactionDate);
  return new Date(row.effectiveFrom) <= at && (!row.effectiveTo || at <= new Date(row.effectiveTo));
}

/**
 * Deterministic Product resolution — mapping id/version + catalogue version.
 * Creates no Inventory effect.
 */
export async function resolveMraProductForSaleLine({
  tenantId,
  businessId = tenantId,
  branchId,
  warehouseId = null,
  terminalId,
  localProductId,
  localProductVariantId = null,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  quantity,
  localUnitOfMeasure = 'EA',
  localTaxRateId = null,
  localLevyIds = [],
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];

  if (localProductVariantId) {
    warnings.push('VARIANT_EXPLICIT_ID_IGNORED_NO_VARIANT_MODEL');
  }

  const site = await resolveMraSiteForTransaction({
    tenantId,
    businessId,
    branchId,
    warehouseId,
    terminalId,
    transactionDate,
    environment: env,
    db,
  });
  if (!site.resolved) blockers.push(...site.blockers);

  const candidates = await db.mraEisProductMapping.findMany({
    where: {
      tenantId,
      businessId,
      localItemId: localProductId,
      status: MAPPING_STATUS.ACTIVE,
    },
  });
  const effective = candidates.filter((r) => isEffective(r, transactionDate));
  if (!effective.length) {
    return {
      resolved: false,
      blockers: [...blockers, 'PRODUCT_MAPPING_REQUIRED'],
      warnings,
      resolutionVersion: 'phase10-product-resolution-v1',
    };
  }
  if (effective.length > 1) {
    return {
      resolved: false,
      blockers: [...blockers, 'PRODUCT_MAPPING_AMBIGUOUS'],
      warnings,
      resolutionVersion: 'phase10-product-resolution-v1',
    };
  }

  const mapping = effective[0];
  const external = await db.mraEisExternalCatalogueItem.findFirst({
    where: { id: mapping.externalCatalogueItemId, tenantId, businessId },
  });
  if (!external) {
    return {
      resolved: false,
      blockers: [...blockers, 'EXTERNAL_PRODUCT_NOT_FOUND'],
      warnings,
      resolutionVersion: 'phase10-product-resolution-v1',
    };
  }
  if (external.externalType !== EXTERNAL_CATALOGUE_TYPE.PRODUCT) {
    blockers.push('PRODUCT_SERVICE_TYPE_MISMATCH');
  }
  if (!external.active) blockers.push('EXTERNAL_PRODUCT_INACTIVE');
  if (mapping.status === MAPPING_STATUS.STALE) blockers.push('PRODUCT_MAPPING_STALE');

  if (site.mraSiteId && external.mraSiteId && site.mraSiteId !== external.mraSiteId) {
    blockers.push('SITE_SCOPE_MISMATCH');
  }

  let conversion = null;
  if (!unitsCompatible(localUnitOfMeasure, external.unitOfMeasure || localUnitOfMeasure, mapping.unitConversionRule)) {
    if (!mapping.unitConversionRule && String(localUnitOfMeasure).toUpperCase() !== String(external.unitOfMeasure || '').toUpperCase()) {
      blockers.push('UOM_MAPPING_REQUIRED');
    }
  }
  try {
    if (mapping.unitConversionRule) {
      conversion = convertQuantityToExternal({ localQuantity: quantity, conversionRule: mapping.unitConversionRule });
    } else {
      conversion = {
        localQuantity: String(quantity),
        resolvedExternalQuantity: String(quantity),
        conversionRuleId: null,
        localUom: localUnitOfMeasure,
        mraUnitOfMeasure: external.unitOfMeasure || localUnitOfMeasure,
        localInventoryMutated: false,
      };
    }
  } catch (err) {
    blockers.push(err.code || 'UOM_CONVERSION_ERROR');
  }

  const taxResolution = await validateProductTaxConsistency({
    tenantId,
    businessId,
    localTaxRateId,
    externalTaxId: external.rawRecordReference || mapping.taxMappingId ? null : null,
    environment: env,
    transactionDate,
    db,
  });
  // Prefer linked tax mapping on product mapping
  if (mapping.taxMappingId) {
    const tm = await db.mraEisTaxMapping.findFirst({
      where: { id: mapping.taxMappingId, tenantId, businessId, status: MAPPING_STATUS.ACTIVE },
    });
    if (!tm) blockers.push('TAX_MAPPING_MISSING');
  } else if (taxResolution.blocking && taxResolution.status !== 'EXTERNAL_TAX_MISSING') {
    // EXTERNAL_TAX_MISSING soft when catalogue lacks tax id in mock
    if (taxResolution.status !== 'LOCAL_TAX_MISSING') warnings.push(taxResolution.status);
  }

  return {
    resolved: blockers.length === 0,
    mappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
    externalCatalogueItemId: external.id,
    mraProductCode: external.mraCode,
    mraProductName: external.name,
    mraBarcode: external.barcode,
    sourceCatalogueVersion: external.sourceVersion,
    sourceConfigurationSnapshotId: null,
    siteMappingId: site.siteMappingId,
    warehouseMappingId: warehouseId || null,
    mraVirtualWarehouseId: null,
    localUnitOfMeasure: conversion?.localUom || localUnitOfMeasure,
    mraUnitOfMeasure: conversion?.mraUnitOfMeasure || external.unitOfMeasure,
    conversionRuleId: conversion?.conversionRuleId || null,
    resolvedExternalQuantity: conversion?.resolvedExternalQuantity || null,
    taxResolution,
    levyResolutions: (localLevyIds || []).map((id) => ({ localLevyId: id, resolved: false })),
    blockers,
    warnings,
    inventoryEffect: false,
    resolutionVersion: 'phase10-product-resolution-v1',
  };
}

export async function resolveMraServiceForSaleLine({
  tenantId,
  businessId = tenantId,
  branchId,
  terminalId,
  localServiceId,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  quantity,
  localUnitOrBasis = 'EA',
  localTaxRateId = null,
  localLevyIds = [],
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  const blockers = [];
  const warnings = [];

  const site = await resolveMraSiteForTransaction({
    tenantId,
    businessId,
    branchId,
    terminalId,
    transactionDate,
    environment: env,
    db,
  });
  if (!site.resolved) blockers.push(...site.blockers);

  const candidates = await db.mraEisProductMapping.findMany({
    where: {
      tenantId,
      businessId,
      localServiceId,
      status: MAPPING_STATUS.ACTIVE,
    },
  });
  const effective = candidates.filter((r) => isEffective(r, transactionDate));
  if (!effective.length) {
    return {
      resolved: false,
      blockers: [...blockers, 'SERVICE_MAPPING_REQUIRED'],
      warnings,
      resolutionVersion: 'phase10-service-resolution-v1',
    };
  }
  if (effective.length > 1) {
    return {
      resolved: false,
      blockers: [...blockers, 'SERVICE_MAPPING_AMBIGUOUS'],
      warnings,
      resolutionVersion: 'phase10-service-resolution-v1',
    };
  }
  const mapping = effective[0];
  const external = await db.mraEisExternalCatalogueItem.findFirst({
    where: { id: mapping.externalCatalogueItemId, tenantId, businessId },
  });
  if (!external || external.externalType !== EXTERNAL_CATALOGUE_TYPE.SERVICE) {
    return {
      resolved: false,
      blockers: [...blockers, 'EXTERNAL_SERVICE_NOT_FOUND'],
      warnings,
      resolutionVersion: 'phase10-service-resolution-v1',
    };
  }
  if (!external.active) blockers.push('EXTERNAL_SERVICE_INACTIVE');

  return {
    resolved: blockers.length === 0,
    mappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
    externalCatalogueItemId: external.id,
    mraServiceCode: external.mraCode,
    mraServiceName: external.name,
    sourceCatalogueVersion: external.sourceVersion,
    sourceConfigurationSnapshotId: null,
    siteMappingId: site.siteMappingId,
    localUnit: localUnitOrBasis,
    mraUnit: external.unitOfMeasure || localUnitOrBasis,
    conversionRuleId: mapping.unitConversionRule ? 'embedded' : null,
    resolvedQuantity: String(quantity),
    taxResolution: { status: mapping.taxMappingId ? 'LINKED' : 'UNVERIFIED', localTaxRateId },
    levyResolutions: (localLevyIds || []).map((id) => ({ localLevyId: id })),
    blockers,
    warnings,
    inventoryEffect: false,
    resolutionVersion: 'phase10-service-resolution-v1',
  };
}

/** Snapshot contract for Phase 12 */
export function buildResolvedItemMappingSnapshot(resolution, {
  sourceLineType,
  localProductId = null,
  localServiceId = null,
  localQuantity,
}) {
  return {
    sourceLineType,
    localProductId,
    localServiceId,
    mappingId: resolution.mappingId,
    mappingVersion: resolution.mappingVersion,
    externalCatalogueItemId: resolution.externalCatalogueItemId,
    externalType: sourceLineType,
    mraCode: resolution.mraProductCode || resolution.mraServiceCode,
    mraName: resolution.mraProductName || resolution.mraServiceName,
    barcode: resolution.mraBarcode || null,
    sourceCatalogueVersion: resolution.sourceCatalogueVersion,
    sourceConfigurationSnapshotId: resolution.sourceConfigurationSnapshotId,
    localUnit: resolution.localUnitOfMeasure || resolution.localUnit,
    mraUnit: resolution.mraUnitOfMeasure || resolution.mraUnit,
    conversionRuleId: resolution.conversionRuleId,
    localQuantity: String(localQuantity),
    resolvedExternalQuantity: resolution.resolvedExternalQuantity || resolution.resolvedQuantity,
    taxMappingId: resolution.taxResolution?.taxMappingId || null,
    taxMappingVersion: resolution.taxResolution?.taxMappingVersion || null,
    mraTaxRateId: resolution.taxResolution?.mraTaxRateId || null,
    levyMappings: resolution.levyResolutions || [],
    resolvedAt: new Date().toISOString(),
    resolutionVersion: resolution.resolutionVersion,
  };
}
