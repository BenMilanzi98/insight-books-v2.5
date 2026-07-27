import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS, MRA_PAYMENT_CODE } from '../../domain/operationalEnums.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { evaluateSplitPaymentSupport } from './splitPaymentPolicy.js';

function isEffective(row, transactionDate) {
  const at = transactionDate ? new Date(transactionDate) : new Date();
  const from = new Date(row.effectiveFrom);
  const to = row.effectiveTo ? new Date(row.effectiveTo) : null;
  return from <= at && (!to || at <= to);
}

/**
 * Deterministic Site resolution — exactly one ACTIVE effective mapping or blocker.
 */
export async function resolveMraSiteForTransaction({
  tenantId,
  businessId = tenantId,
  branchId,
  warehouseId = null,
  terminalId = null,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];

  const candidates = await db.mraEisSiteMapping.findMany({
    where: {
      tenantId,
      businessId,
      branchId,
      environment: String(environment).toUpperCase(),
      status: { in: [MAPPING_STATUS.ACTIVE] },
    },
  });

  const effective = candidates.filter((r) => isEffective(r, transactionDate));
  if (effective.length === 0) {
    const stale = await db.mraEisSiteMapping.findFirst({
      where: { tenantId, businessId, branchId, status: MAPPING_STATUS.STALE },
    });
    if (stale) blockers.push('SITE_MAPPING_STALE');
    else blockers.push('SITE_MAPPING_MISSING');
    return {
      resolved: false,
      mraSiteId: null,
      siteMappingId: null,
      mappingVersion: null,
      blockers,
      warnings,
      resolutionVersion: 'phase9-site-resolution-v1',
    };
  }
  if (effective.length > 1) {
    return {
      resolved: false,
      mraSiteId: null,
      siteMappingId: null,
      mappingVersion: null,
      blockers: ['SITE_MAPPING_AMBIGUOUS'],
      warnings,
      resolutionVersion: 'phase9-site-resolution-v1',
    };
  }

  const mapping = effective[0];
  let terminalSiteConsistent = true;
  if (terminalId) {
    const terminal = await db.mraEisTerminal.findFirst({
      where: { id: terminalId, tenantId, businessId },
    });
    if (terminal?.branchId && terminal.branchId !== branchId) {
      terminalSiteConsistent = false;
      blockers.push('TERMINAL_SITE_MISMATCH');
    }
  }

  if (warehouseId && mapping.warehouseId && mapping.warehouseId !== warehouseId) {
    warnings.push('WAREHOUSE_MAPPING_DIFFERENT');
  }

  return {
    resolved: blockers.length === 0,
    mraSiteId: mapping.mraSiteId,
    siteMappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
    sourceConfigurationSnapshotId: mapping.sourceConfigurationSnapshotId || null,
    terminalSiteConsistent,
    warehouseMappingId: mapping.warehouseId || null,
    blockers,
    warnings,
    resolutionVersion: 'phase9-site-resolution-v1',
  };
}

export async function resolveMraTaxForSaleLine({
  tenantId,
  businessId = tenantId,
  localTaxRateId,
  localTaxCategoryId = null,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  localRate = null,
  treatmentType = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];

  const candidates = await db.mraEisTaxMapping.findMany({
    where: {
      tenantId,
      businessId,
      localTaxRateId,
      environment: String(environment).toUpperCase(),
      status: MAPPING_STATUS.ACTIVE,
    },
  });
  const effective = candidates.filter((r) => isEffective(r, transactionDate));
  if (!effective.length) {
    return {
      resolved: false,
      blockers: ['TAX_MAPPING_REQUIRED'],
      warnings,
      resolutionVersion: 'phase9-tax-resolution-v1',
    };
  }
  if (effective.length > 1) {
    return {
      resolved: false,
      blockers: ['TAX_MAPPING_AMBIGUOUS'],
      warnings,
      resolutionVersion: 'phase9-tax-resolution-v1',
    };
  }
  const mapping = effective[0];
  if (mapping.status === MAPPING_STATUS.CONFLICT || mapping.differenceReason === 'RATE_MISMATCH') {
    blockers.push('TAX_MAPPING_CONFLICT');
  }
  if (treatmentType && mapping.treatmentType && treatmentType !== mapping.treatmentType) {
    blockers.push('TREATMENT_MISMATCH');
  }
  if (localRate != null && Number(localRate) !== Number(mapping.localRateSnapshot)) {
    warnings.push('LOCAL_RATE_DRIFT');
  }

  return {
    resolved: blockers.length === 0,
    mraTaxRateId: mapping.mraTaxRateId,
    externalTaxDefinitionId: mapping.externalTaxDefinitionId,
    taxMappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
    treatmentType: mapping.treatmentType,
    localRateSnapshot: mapping.localRateSnapshot,
    mraRateSnapshot: mapping.mraRateSnapshot,
    sourceConfigurationSnapshotId: mapping.sourceConfigurationSnapshotId,
    blockers,
    warnings,
    resolutionVersion: 'phase9-tax-resolution-v1',
  };
}

export async function resolveMraLevyForSaleLine({
  tenantId,
  businessId = tenantId,
  localLevyId,
  transactionDate = new Date(),
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const candidates = await db.mraEisLevyMapping.findMany({
    where: {
      tenantId,
      businessId,
      localLevyId,
      environment: String(environment).toUpperCase(),
      status: MAPPING_STATUS.ACTIVE,
    },
  });
  const effective = candidates.filter((r) => isEffective(r, transactionDate));
  if (!effective.length) {
    return {
      resolved: false,
      blockers: ['LEVY_MAPPING_REQUIRED'],
      resolutionVersion: 'phase9-levy-resolution-v1',
    };
  }
  if (effective.length > 1) {
    return {
      resolved: false,
      blockers: ['LEVY_MAPPING_AMBIGUOUS'],
      resolutionVersion: 'phase9-levy-resolution-v1',
    };
  }
  const mapping = effective[0];
  return {
    resolved: true,
    mraLevyId: mapping.mraLevyId,
    externalLevyDefinitionId: mapping.externalLevyDefinitionId,
    levyMappingId: mapping.id,
    mappingVersion: mapping.mappingVersion,
    chargeMode: mapping.chargeMode,
    sourceConfigurationSnapshotId: mapping.sourceConfigurationSnapshotId,
    blockers: [],
    warnings: [],
    resolutionVersion: 'phase9-levy-resolution-v1',
  };
}

/**
 * Resolve every payment component. Never discard unsupported components.
 * Split payments blocked when policy unverified.
 */
export async function resolveMraPaymentRepresentation({
  tenantId,
  businessId = tenantId,
  paymentComponents = [],
  transactionType = 'SALE',
  transactionDate = new Date(),
  environment = 'SANDBOX',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const blockers = [];
  const warnings = [];
  const split = evaluateSplitPaymentSupport(paymentComponents);
  if (split.blocked) {
    return {
      resolved: false,
      representationType: null,
      resolvedComponents: [],
      splitPaymentSupported: false,
      blockers: ['SPLIT_PAYMENT_UNSUPPORTED'],
      warnings: [split.message],
      resolutionVersion: 'phase9-payment-resolution-v1',
    };
  }

  const resolvedComponents = [];
  for (const component of paymentComponents) {
    const candidates = await db.mraEisPaymentMethodMapping.findMany({
      where: {
        tenantId,
        businessId,
        localPaymentMethodId: component.localPaymentMethodId,
        environment: String(environment).toUpperCase(),
        status: MAPPING_STATUS.ACTIVE,
      },
    });
    const effective = candidates.filter((r) => isEffective(r, transactionDate));
    if (!effective.length) {
      blockers.push('PAYMENT_MAPPING_REQUIRED');
      resolvedComponents.push({
        localPaymentMethodId: component.localPaymentMethodId,
        resolved: false,
        amount: component.amount,
      });
      continue;
    }
    if (effective.length > 1) {
      blockers.push('PAYMENT_MAPPING_AMBIGUOUS');
      continue;
    }
    const mapping = effective[0];
    if (!Object.values(MRA_PAYMENT_CODE).includes(mapping.mraPaymentMethodCode) && mapping.mraPaymentMethodCode.includes(' ')) {
      blockers.push('PAYMENT_METHOD_UNSUPPORTED');
      continue;
    }
    resolvedComponents.push({
      localPaymentMethodId: component.localPaymentMethodId,
      resolved: true,
      amount: component.amount,
      mraPaymentMethodCode: mapping.mraPaymentMethodCode,
      mappingId: mapping.id,
      mappingVersion: mapping.mappingVersion,
      isCredit: mapping.mraPaymentMethodCode === MRA_PAYMENT_CODE.CREDIT,
    });
  }

  // Credit sale: later customer payments must not be treated as second fiscal sale — resolution only
  const creditComponent = resolvedComponents.find((c) => c.isCredit) || null;
  if (transactionType === 'CUSTOMER_COLLECTION' && creditComponent) {
    warnings.push('CUSTOMER_COLLECTION_NOT_FISCAL_SALE');
  }

  return {
    resolved: blockers.length === 0 && resolvedComponents.every((c) => c.resolved),
    representationType: split.representationType || 'SINGLE_PAYMENT',
    resolvedComponents,
    primaryCode: resolvedComponents[0]?.mraPaymentMethodCode || null,
    splitPaymentSupported: !split.blocked,
    creditComponent,
    mappingIds: resolvedComponents.filter((c) => c.mappingId).map((c) => c.mappingId),
    mappingVersions: resolvedComponents.filter((c) => c.mappingVersion != null).map((c) => c.mappingVersion),
    blockers,
    warnings,
    resolutionVersion: 'phase9-payment-resolution-v1',
  };
}

/** Contract for future Phase 12 fiscal snapshots */
export function buildResolvedMappingSnapshot({
  site = null,
  warehouse = null,
  taxes = [],
  levies = [],
  payments = [],
}) {
  return {
    site: site
      ? {
          mappingId: site.siteMappingId,
          mappingVersion: site.mappingVersion,
          mraSiteId: site.mraSiteId,
          sourceConfigurationSnapshotId: site.sourceConfigurationSnapshotId,
        }
      : null,
    warehouse: warehouse || null,
    taxes: taxes.map((t) => ({
      localTaxRateId: t.localTaxRateId,
      mappingId: t.taxMappingId,
      mappingVersion: t.mappingVersion,
      mraTaxRateId: t.mraTaxRateId,
      treatmentType: t.treatmentType,
      localRate: t.localRateSnapshot,
      mraRate: t.mraRateSnapshot,
      sourceConfigurationSnapshotId: t.sourceConfigurationSnapshotId,
    })),
    levies: levies.map((l) => ({
      localLevyId: l.localLevyId,
      mappingId: l.levyMappingId,
      mappingVersion: l.mappingVersion,
      mraLevyId: l.mraLevyId,
      chargeMode: l.chargeMode,
      sourceConfigurationSnapshotId: l.sourceConfigurationSnapshotId,
    })),
    payments: payments.map((p) => ({
      localPaymentMethodId: p.localPaymentMethodId,
      mappingId: p.mappingId,
      mappingVersion: p.mappingVersion,
      mraPaymentMethodCode: p.mraPaymentMethodCode,
    })),
    resolutionVersion: 'phase9-mapping-snapshot-v1',
    resolvedAt: new Date().toISOString(),
  };
}
