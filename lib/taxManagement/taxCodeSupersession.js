/**
 * Supersede a TaxType with a new version (effective dating).
 * Historical SaleItemTax snapshots remain unchanged.
 */

import prisma from '../prisma.js';

export async function supersedeTaxType({
  tenantId,
  userId,
  taxTypeId,
  taxRate,
  taxName = null,
  taxCode = null,
  accountId = null,
  effectiveFrom = new Date(),
  db = prisma,
}) {
  const existing = await db.taxType.findFirst({
    where: { id: taxTypeId, tenantId },
  });
  if (!existing) {
    const err = new Error('Tax type not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (existing.status === 'Inactive' && existing.supersededById) {
    const err = new Error('Tax type is already superseded');
    err.code = 'ALREADY_SUPERSEDED';
    throw err;
  }

  const rate = Number(taxRate);
  if (!Number.isFinite(rate) || rate < 0) {
    const err = new Error('Valid taxRate is required');
    err.code = 'INVALID_RATE';
    throw err;
  }

  const from = new Date(effectiveFrom);
  const priorEnd = new Date(from.getTime() - 1000);

  return db.$transaction(async (tx) => {
    // Unique taxId/taxCode: keep original taxId on old row; new row gets versioned taxId.
    const versionSuffix = `-v${Date.now().toString(36)}`;
    const newTaxId = `${existing.taxId}${versionSuffix}`.slice(0, 64);
    const newTaxCode = taxCode
      ? String(taxCode).slice(0, 64)
      : existing.taxCode
        ? `${existing.taxCode}${versionSuffix}`.slice(0, 64)
        : null;

    const created = await tx.taxType.create({
      data: {
        tenantId,
        taxId: newTaxId,
        taxName: taxName || existing.taxName,
        taxCode: newTaxCode,
        taxRate: rate,
        calculationType: existing.calculationType,
        accountId: accountId || existing.accountId,
        status: 'Active',
        effectiveFrom: from,
        effectiveTo: null,
      },
    });

    const superseded = await tx.taxType.update({
      where: { id: existing.id },
      data: {
        status: 'Inactive',
        effectiveTo: priorEnd,
        supersededById: created.id,
      },
    });

    if (userId) {
      await tx.auditLog.create({
        data: {
          action: 'TAX_TYPE_SUPERSEDED',
          entityType: 'TaxType',
          entityId: existing.id,
          userId,
          tenantId,
          details: JSON.stringify({
            oldTaxTypeId: existing.id,
            newTaxTypeId: created.id,
            oldRate: existing.taxRate,
            newRate: rate,
            effectiveFrom: from.toISOString(),
          }),
        },
      });
    }

    return { superseded, successor: created };
  });
}

