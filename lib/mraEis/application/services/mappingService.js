import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, EXTERNAL_CATALOGUE_TYPE } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch, createChecksum } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';

async function assertNoOverlappingActive({
  db,
  model,
  whereBase,
  effectiveFrom,
  effectiveTo,
  excludeId = null,
}) {
  const actives = await db[model].findMany({
    where: {
      ...whereBase,
      status: { in: [MAPPING_STATUS.ACTIVE, MAPPING_STATUS.VERIFIED] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  const from = new Date(effectiveFrom);
  const to = effectiveTo ? new Date(effectiveTo) : null;
  for (const row of actives) {
    const rowFrom = new Date(row.effectiveFrom);
    const rowTo = row.effectiveTo ? new Date(row.effectiveTo) : null;
    const overlaps =
      (!to || rowFrom <= to) && (!rowTo || from <= rowTo);
    if (overlaps) {
      throw EisErrors.siteMappingConflict({
        message: 'Ambiguous overlapping active mapping prohibited.',
        details: { existingId: row.id, model },
      });
    }
  }
}

export async function upsertExternalCatalogueItem({
  tenantId,
  businessId = tenantId,
  environment,
  mraTin,
  mraSiteId,
  externalType,
  mraCode,
  name,
  sourceVersion,
  record,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (![EXTERNAL_CATALOGUE_TYPE.PRODUCT, EXTERNAL_CATALOGUE_TYPE.SERVICE].includes(externalType)) {
    throw EisErrors.validation({ message: 'externalType must be PRODUCT or SERVICE.' });
  }
  const sourceChecksum = createChecksum(record || { mraCode, name, sourceVersion }).value;
  const existing = await db.mraEisExternalCatalogueItem.findFirst({
    where: {
      tenantId,
      businessId,
      environment,
      mraSiteId,
      externalType,
      mraCode,
      sourceVersion,
    },
  });
  if (existing) {
    if (existing.sourceChecksum === sourceChecksum) return existing;
    return db.mraEisExternalCatalogueItem.update({
      where: { id: existing.id },
      data: {
        name,
        sourceChecksum,
        supersededAt: null,
        active: true,
        synchronizedAt: new Date(),
      },
    });
  }
  return db.mraEisExternalCatalogueItem.create({
    data: {
      tenantId,
      businessId,
      environment,
      mraTin,
      mraSiteId,
      externalType,
      mraCode,
      name,
      sourceVersion,
      sourceChecksum,
      active: true,
    },
  });
}

export async function createSiteMapping({
  tenantId,
  businessId = tenantId,
  branchId,
  mraSiteId,
  warehouseId = null,
  terminalId = null,
  environment = 'SANDBOX',
  status = MAPPING_STATUS.SUGGESTED,
  effectiveFrom = new Date(),
  effectiveTo = null,
  verifiedBy = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const env = String(environment).toUpperCase();
  // Suggestions must never be created as ACTIVE
  if (status === MAPPING_STATUS.ACTIVE) {
    throw EisErrors.validation({
      message: 'Cannot create ACTIVE site mapping directly. Verify and activate via lifecycle.',
    });
  }
  const site = await db.mraEisSite.findFirst({
    where: { tenantId, businessId, mraSiteId, environment: env },
  });
  if (!site) throw EisErrors.validation({ message: 'MRA site not found for business.' });

  if (status === MAPPING_STATUS.VERIFIED) {
    await assertNoOverlappingActive({
      db,
      model: 'mraEisSiteMapping',
      whereBase: { tenantId, businessId, branchId, environment: env },
      effectiveFrom,
      effectiveTo,
    });
  }

  const row = await db.mraEisSiteMapping.create({
    data: {
      tenantId,
      businessId,
      branchId,
      warehouseId,
      terminalId,
      mraSiteId,
      environment: env,
      status,
      effectiveFrom,
      effectiveTo,
      verifiedAt: status === MAPPING_STATUS.VERIFIED ? new Date() : null,
      verifiedBy,
      version: 1,
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: verifiedBy,
    actorType: 'SERVICE',
    action: 'SITE_MAPPING_CREATED',
    resourceType: 'MraEisSiteMapping',
    resourceId: row.id,
    newStatus: status,
  }, db);

  return row;
}

export async function createProductMapping({
  tenantId,
  businessId = tenantId,
  localItemId = null,
  localServiceId = null,
  externalCatalogueItemId,
  mappingType,
  status = MAPPING_STATUS.SUGGESTED,
  effectiveFrom = new Date(),
  effectiveTo = null,
  verifiedBy = null,
  unitConversionRule = null,
  taxMappingId = null,
  reason = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (status === MAPPING_STATUS.ACTIVE) {
    throw EisErrors.validation({
      message: 'Cannot create ACTIVE product/service mapping directly. Verify and activate via lifecycle.',
    });
  }
  const hasProduct = Boolean(localItemId);
  const hasService = Boolean(localServiceId);
  if (hasProduct === hasService) {
    throw EisErrors.validation({ message: 'Exactly one of localItemId or localServiceId is required.' });
  }
  if (mappingType === 'PRODUCT_TO_SERVICE' || mappingType === 'SERVICE_TO_PRODUCT') {
    throw EisErrors.productMappingConflict({
      message: 'Cross-type Product↔Service mapping is blocked by default.',
      code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
    });
  }

  const external = await db.mraEisExternalCatalogueItem.findFirst({
    where: { id: externalCatalogueItemId, tenantId, businessId },
  });
  if (!external) throw EisErrors.crossTenant({ message: 'External catalogue item not in business scope.' });
  if (!external.active) {
    throw EisErrors.validation({
      message: 'Inactive external catalogue records cannot be used for new mappings.',
      code: 'EXTERNAL_PRODUCT_INACTIVE',
    });
  }
  if (hasProduct && external.externalType !== 'PRODUCT') {
    throw EisErrors.productMappingConflict({
      message: 'Local Product cannot map to external Service without APPROVED cross-type.',
      code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
    });
  }
  if (hasService && external.externalType !== 'SERVICE') {
    throw EisErrors.productMappingConflict({
      message: 'Local Service cannot map to external Product without APPROVED cross-type.',
      code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
    });
  }

  if (status === MAPPING_STATUS.VERIFIED) {
    await assertNoOverlappingActive({
      db,
      model: 'mraEisProductMapping',
      whereBase: {
        tenantId,
        businessId,
        ...(localItemId ? { localItemId } : { localServiceId }),
      },
      effectiveFrom,
      effectiveTo,
    });
  }

  return db.mraEisProductMapping.create({
    data: {
      tenantId,
      businessId,
      localItemId,
      localServiceId,
      externalCatalogueItemId,
      mappingType,
      status,
      effectiveFrom,
      effectiveTo,
      mappingVersion: 1,
      unitConversionRule: unitConversionRule
        ? (typeof unitConversionRule === 'string' ? unitConversionRule : JSON.stringify(unitConversionRule))
        : null,
      taxMappingId,
      verifiedAt: status === MAPPING_STATUS.VERIFIED ? new Date() : null,
      verifiedBy,
      reason,
      source: 'PHASE10_MAPPING',
    },
  });
}

export async function createTaxMapping({
  tenantId,
  businessId = tenantId,
  localTaxRateId,
  mraTaxRateId,
  externalTaxDefinitionId = null,
  sourceConfigurationSnapshotId,
  localRateSnapshot = 0,
  mraRateSnapshot = 0,
  treatmentType = null,
  chargeMode = null,
  environment = 'SANDBOX',
  status = MAPPING_STATUS.SUGGESTED,
  effectiveFrom = new Date(),
  effectiveTo = null,
  verifiedBy = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (status === MAPPING_STATUS.ACTIVE) {
    throw EisErrors.validation({
      message: 'Cannot create ACTIVE tax mapping directly. Verify and activate via lifecycle.',
    });
  }
  const env = String(environment).toUpperCase();
  if (status === MAPPING_STATUS.VERIFIED) {
    await assertNoOverlappingActive({
      db,
      model: 'mraEisTaxMapping',
      whereBase: { tenantId, businessId, localTaxRateId, environment: env },
      effectiveFrom,
      effectiveTo,
    });
  }
  const conflict =
    localRateSnapshot != null &&
    mraRateSnapshot != null &&
    Number(localRateSnapshot) !== Number(mraRateSnapshot);

  return db.mraEisTaxMapping.create({
    data: {
      tenantId,
      businessId,
      localTaxRateId,
      mraTaxRateId,
      externalTaxDefinitionId,
      sourceConfigurationSnapshotId,
      environment: env,
      treatmentType,
      chargeMode,
      status: conflict ? MAPPING_STATUS.CONFLICT : status,
      effectiveFrom,
      effectiveTo,
      mappingVersion: 1,
      localRateSnapshot,
      mraRateSnapshot,
      differenceReason: conflict ? 'RATE_MISMATCH' : null,
      verifiedAt: !conflict && status === MAPPING_STATUS.VERIFIED ? new Date() : null,
      verifiedBy,
    },
  });
}

export async function createPaymentMethodMapping({
  tenantId,
  businessId = tenantId,
  localPaymentMethodId,
  mraPaymentMethodCode,
  environment,
  status = MAPPING_STATUS.SUGGESTED,
  effectiveFrom = new Date(),
  effectiveTo = null,
  verifiedBy = null,
  notes = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!mraPaymentMethodCode || mraPaymentMethodCode.includes(' ')) {
    // Labels with spaces are not API codes
    throw EisErrors.validation({
      message: 'mraPaymentMethodCode must be a verified API code, not a display label.',
    });
  }
  if (status === MAPPING_STATUS.ACTIVE || status === MAPPING_STATUS.VERIFIED) {
    await assertNoOverlappingActive({
      db,
      model: 'mraEisPaymentMethodMapping',
      whereBase: { tenantId, businessId, localPaymentMethodId, environment },
      effectiveFrom,
      effectiveTo,
    });
  }
  return db.mraEisPaymentMethodMapping.create({
    data: {
      tenantId,
      businessId,
      localPaymentMethodId,
      mraPaymentMethodCode,
      environment,
      status,
      effectiveFrom,
      effectiveTo,
      mappingVersion: 1,
      verifiedAt: status === MAPPING_STATUS.VERIFIED ? new Date() : null,
      verifiedBy,
      notes,
    },
  });
}

export async function createLevyMapping({
  tenantId,
  businessId = tenantId,
  localLevyId,
  mraLevyId,
  sourceConfigurationSnapshotId,
  status = MAPPING_STATUS.BLOCKED,
  ...rest
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!mraLevyId) {
    throw EisErrors.validation({
      message: 'Levy mapping blocked: MRA levy identifier not verified for this contract.',
    });
  }
  return prisma.mraEisLevyMapping.create({
    data: {
      tenantId,
      businessId,
      localLevyId,
      mraLevyId,
      sourceConfigurationSnapshotId,
      status,
      mappingVersion: 1,
      effectiveFrom: rest.effectiveFrom || new Date(),
      effectiveTo: rest.effectiveTo || null,
      localRateSnapshot: rest.localRateSnapshot ?? null,
      mraRateSnapshot: rest.mraRateSnapshot ?? null,
      verifiedBy: rest.verifiedBy || null,
    },
  });
}
