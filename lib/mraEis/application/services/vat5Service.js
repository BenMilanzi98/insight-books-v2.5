import prisma from '@/lib/prisma.js';
import { VAT5_STATUS } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';
import { assertTenantBusinessMatch, createQuantity } from '../../domain/valueObjects/index.js';

export async function createVat5Validation({
  tenantId,
  businessId = tenantId,
  projectNumber,
  certificateNumber,
  requestedQuantity,
  eligibleQuantity = null,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const requested = createQuantity(requestedQuantity, 'requestedQuantity');

  return db.mraEisVat5Validation.create({
    data: {
      tenantId,
      businessId,
      projectNumber,
      certificateNumber,
      requestedQuantity: requested.value,
      eligibleQuantity: eligibleQuantity == null ? null : createQuantity(eligibleQuantity).value,
      remainingQuantity: eligibleQuantity == null ? null : createQuantity(eligibleQuantity).value,
      status: VAT5_STATUS.REQUESTED,
      reservedQuantity: 0,
      consumedQuantity: 0,
      releasedQuantity: 0,
      version: 1,
    },
  });
}

export async function reserveVat5Quantity({
  tenantId,
  businessId = tenantId,
  validationId,
  quantity,
  expectedVersion,
  db = prisma,
}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const qty = createQuantity(quantity).toNumber();

  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT * FROM "MraEisVat5Validation"
      WHERE id = ${validationId}
        AND "tenantId" = ${tenantId}
        AND "businessId" = ${businessId}
      FOR UPDATE
    `;
    const current = rows?.[0];
    if (!current) throw EisErrors.validation({ message: 'VAT5 validation not found.', httpStatus: 404 });
    if (expectedVersion != null && Number(current.version) !== expectedVersion) {
      throw EisErrors.versionConflict({ tenantId, businessId });
    }

    const eligible = current.eligibleQuantity == null ? null : Number(current.eligibleQuantity);
    const reserved = Number(current.reservedQuantity) + qty;
    const consumed = Number(current.consumedQuantity);
    if (eligible != null && reserved + consumed > eligible + 1e-9) {
      throw EisErrors.vat5QuantityConflict({ tenantId, businessId });
    }

    return tx.mraEisVat5Validation.update({
      where: { id: validationId },
      data: {
        reservedQuantity: reserved,
        status: VAT5_STATUS.RESERVED,
        version: { increment: 1 },
      },
    });
  });
}
