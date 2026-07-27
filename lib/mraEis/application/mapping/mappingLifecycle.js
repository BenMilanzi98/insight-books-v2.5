import prisma from '@/lib/prisma.js';
import { MAPPING_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import { recordEisControlAudit } from '../../infrastructure/audit.js';
import { assertCompatibleTaxTreatments } from './taxTreatment.js';

const MODEL_BY_KIND = {
  SITE: 'mraEisSiteMapping',
  TAX: 'mraEisTaxMapping',
  LEVY: 'mraEisLevyMapping',
  PAYMENT: 'mraEisPaymentMethodMapping',
  PRODUCT: 'mraEisProductMapping',
  SERVICE: 'mraEisProductMapping',
};

function model(kind) {
  const m = MODEL_BY_KIND[kind];
  if (!m) throw EisErrors.validation({ message: `Unknown mapping kind ${kind}` });
  return m;
}

/**
 * Suggestions never auto-activate. ACTIVE requires VERIFIED (+ approval in production).
 */
export async function verifyMapping({
  tenantId,
  businessId = tenantId,
  kind,
  mappingId,
  verifiedBy,
  expectedVersion,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const m = model(kind);
  const row = await db[m].findFirst({ where: { id: mappingId, tenantId, businessId } });
  if (!row) throw EisErrors.validation({ message: 'Mapping not found.', httpStatus: 404 });
  if (expectedVersion != null && row.version !== expectedVersion) {
    throw EisErrors.versionConflict({ details: { expectedVersion, actual: row.version } });
  }
  if (![MAPPING_STATUS.SUGGESTED, MAPPING_STATUS.MATCHED, MAPPING_STATUS.PENDING_VERIFICATION, MAPPING_STATUS.CONFLICT].includes(row.status)
      && row.status !== MAPPING_STATUS.PENDING_APPROVAL) {
    if (row.status === MAPPING_STATUS.ACTIVE || row.status === MAPPING_STATUS.VERIFIED) {
      return row;
    }
  }
  if (row.status === MAPPING_STATUS.CONFLICT) {
    throw EisErrors.validation({ message: 'Conflicted mappings cannot be verified without correction.' });
  }

  const updated = await db[m].update({
    where: { id: mappingId },
    data: {
      status: MAPPING_STATUS.VERIFIED,
      verifiedAt: new Date(),
      verifiedBy,
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: verifiedBy,
    actorType: 'USER',
    action: `${kind}_MAPPING_VERIFIED`,
    resourceType: m,
    resourceId: mappingId,
    previousStatus: row.status,
    newStatus: MAPPING_STATUS.VERIFIED,
  }, db);

  return updated;
}

export async function approveMapping({
  tenantId,
  businessId = tenantId,
  kind,
  mappingId,
  approvedBy,
  approvalId = null,
  expectedVersion,
  preventSelfApproval = true,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const m = model(kind);
  const row = await db[m].findFirst({ where: { id: mappingId, tenantId, businessId } });
  if (!row) throw EisErrors.validation({ message: 'Mapping not found.', httpStatus: 404 });
  if (expectedVersion != null && row.version !== expectedVersion) {
    throw EisErrors.versionConflict({ details: { expectedVersion, actual: row.version } });
  }
  if (row.status !== MAPPING_STATUS.VERIFIED && row.status !== MAPPING_STATUS.PENDING_APPROVAL) {
    throw EisErrors.validation({ message: 'Only verified mappings can be approved.' });
  }
  if (preventSelfApproval && row.verifiedBy && approvedBy && row.verifiedBy === approvedBy) {
    throw EisErrors.validation({
      message: 'Self-approval is not permitted for this mapping.',
      requiredAction: 'DIFFERENT_APPROVER',
    });
  }

  // Approval grants permission to activate; status remains VERIFIED with approved* fields set.
  const updated = await db[m].update({
    where: { id: mappingId },
    data: {
      status: MAPPING_STATUS.VERIFIED,
      approvedAt: new Date(),
      approvedBy,
      ...(approvalId ? { approvalId } : {}),
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: approvedBy,
    actorType: 'USER',
    action: `${kind}_MAPPING_APPROVED`,
    resourceType: m,
    resourceId: mappingId,
    newStatus: MAPPING_STATUS.VERIFIED,
    metadata: { approvalId },
  }, db);

  return updated;
}

export async function activateMapping({
  tenantId,
  businessId = tenantId,
  kind,
  mappingId,
  activatedBy,
  environment,
  requireApproval = false,
  reason = null,
  expectedVersion,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const m = model(kind);
  const row = await db[m].findFirst({ where: { id: mappingId, tenantId, businessId } });
  if (!row) throw EisErrors.validation({ message: 'Mapping not found.', httpStatus: 404 });
  if (expectedVersion != null && row.version !== expectedVersion) {
    throw EisErrors.versionConflict({ details: { expectedVersion, actual: row.version } });
  }
  if (row.status === MAPPING_STATUS.SUGGESTED || row.status === MAPPING_STATUS.MATCHED) {
    throw EisErrors.validation({ message: 'Suggestions cannot be activated. Verify first.' });
  }
  if (row.status !== MAPPING_STATUS.VERIFIED && row.status !== MAPPING_STATUS.PENDING_APPROVAL) {
    if (row.status === MAPPING_STATUS.ACTIVE) return row;
    throw EisErrors.validation({ message: `Cannot activate mapping in status ${row.status}.` });
  }
  if (requireApproval && !row.approvedBy && !row.approvalId) {
    throw EisErrors.validation({
      message: 'Production mapping activation requires approval.',
      requiredAction: 'APPROVAL_REQUIRED',
    });
  }
  if (kind === 'TAX' && row.treatmentType) {
    // ensure treatment still present
    assertCompatibleTaxTreatments(row.treatmentType, row.treatmentType);
  }

  // Close overlapping actives for same local scope
  const whereBase =
    kind === 'SITE'
      ? { tenantId, businessId, branchId: row.branchId }
      : kind === 'TAX'
        ? { tenantId, businessId, localTaxRateId: row.localTaxRateId }
        : kind === 'LEVY'
          ? { tenantId, businessId, localLevyId: row.localLevyId }
          : kind === 'PRODUCT'
            ? { tenantId, businessId, localItemId: row.localItemId }
            : kind === 'SERVICE'
              ? { tenantId, businessId, localServiceId: row.localServiceId }
              : { tenantId, businessId, localPaymentMethodId: row.localPaymentMethodId, environment: row.environment };

  await db[m].updateMany({
    where: {
      ...whereBase,
      status: MAPPING_STATUS.ACTIVE,
      NOT: { id: mappingId },
    },
    data: {
      status: MAPPING_STATUS.SUPERSEDED,
      effectiveTo: row.effectiveFrom,
    },
  });

  const updated = await db[m].update({
    where: { id: mappingId },
    data: {
      status: MAPPING_STATUS.ACTIVE,
      ...(reason && kind === 'SITE' ? { activationReason: reason } : {}),
      ...(environment && kind !== 'PAYMENT' ? { environment } : {}),
      version: { increment: 1 },
    },
  });

  await recordEisControlAudit({
    tenantId,
    businessId,
    actorId: activatedBy,
    actorType: 'USER',
    action: `${kind}_MAPPING_ACTIVATED`,
    resourceType: m,
    resourceId: mappingId,
    previousStatus: row.status,
    newStatus: MAPPING_STATUS.ACTIVE,
    environment: environment || row.environment,
  }, db);

  return updated;
}

export async function supersedeMapping({
  tenantId,
  businessId = tenantId,
  kind,
  previousMappingId,
  newMappingId,
  actorId,
  reason,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  if (!reason || String(reason).trim().length < 5) {
    throw EisErrors.validation({ message: 'Supersession reason is required.' });
  }
  const m = model(kind);

  return db.$transaction(async (tx) => {
    const prev = await tx[m].findFirst({ where: { id: previousMappingId, tenantId, businessId } });
    const next = await tx[m].findFirst({ where: { id: newMappingId, tenantId, businessId } });
    if (!prev || !next) throw EisErrors.validation({ message: 'Mapping not found for supersession.' });

    await tx[m].update({
      where: { id: previousMappingId },
      data: {
        status: MAPPING_STATUS.SUPERSEDED,
        effectiveTo: next.effectiveFrom,
        version: { increment: 1 },
      },
    });
    await tx[m].update({
      where: { id: newMappingId },
      data: {
        status: MAPPING_STATUS.ACTIVE,
        supersedesMappingId: previousMappingId,
        mappingVersion: (prev.mappingVersion || 1) + 1,
        version: { increment: 1 },
      },
    });

    await recordEisControlAudit({
      tenantId,
      businessId,
      actorId,
      actorType: 'USER',
      action: `${kind}_MAPPING_SUPERSEDED`,
      resourceType: m,
      resourceId: newMappingId,
      metadata: { previousMappingId, reason: String(reason).slice(0, 500) },
    }, tx);

    return { previousMappingId, newMappingId, status: MAPPING_STATUS.ACTIVE };
  });
}

export async function markMappingsStale({
  tenantId,
  businessId = tenantId,
  kind,
  reason = 'CONFIGURATION_CHANGE',
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const m = model(kind);
  const result = await db[m].updateMany({
    where: { tenantId, businessId, status: MAPPING_STATUS.ACTIVE },
    data: { status: MAPPING_STATUS.STALE },
  });
  await recordEisControlAudit({
    tenantId,
    businessId,
    actorType: 'SERVICE',
    action: `${kind}_MAPPINGS_MARKED_STALE`,
    resourceType: m,
    resourceId: businessId,
    metadata: { count: result.count, reason },
  }, db);
  return result;
}
