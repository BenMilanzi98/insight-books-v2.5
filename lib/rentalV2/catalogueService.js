import prisma from '@/lib/prisma';
import { parseMoney } from '@/lib/money';

export async function listUnits({ tenantId, rentalAssetId }) {
  return prisma.rentalUnit.findMany({
    where: {
      tenantId,
      ...(rentalAssetId ? { rentalAssetId } : {}),
    },
    orderBy: [{ rentalAssetId: 'asc' }, { code: 'asc' }],
  });
}

export async function createUnit({
  tenantId,
  rentalAssetId,
  code,
  serialNumber,
  barcode,
  fixedAssetId,
  branchId,
  meterType,
}) {
  const asset = await prisma.rentalAsset.findFirst({
    where: { id: rentalAssetId, tenantId },
  });
  if (!asset) throw new Error('Rental asset not found');
  return prisma.rentalUnit.create({
    data: {
      tenantId,
      rentalAssetId,
      code: code || null,
      serialNumber: serialNumber || null,
      barcode: barcode || null,
      fixedAssetId: fixedAssetId || null,
      branchId: branchId || asset.branchId || null,
      meterType: meterType || null,
    },
  });
}

export async function listRatePlans({ tenantId, rentalAssetId }) {
  return prisma.rentalRatePlan.findMany({
    where: {
      tenantId,
      ...(rentalAssetId ? { rentalAssetId } : {}),
    },
    orderBy: [{ code: 'asc' }, { version: 'desc' }],
  });
}

export async function createRatePlan({
  tenantId,
  rentalAssetId,
  code,
  name,
  billingUnit = 'day',
  baseRate,
  minimumCharge = 0,
  depositAmount = 0,
  overtimeRate,
  lateFeePerDay,
  graceHours = 0,
  currency = 'MWK',
  effectiveFrom,
  effectiveTo,
}) {
  const asset = await prisma.rentalAsset.findFirst({
    where: { id: rentalAssetId, tenantId },
  });
  if (!asset) throw new Error('Rental asset not found');
  const existing = await prisma.rentalRatePlan.findFirst({
    where: { tenantId, code },
    orderBy: { version: 'desc' },
  });
  const version = existing ? existing.version + 1 : 1;
  return prisma.rentalRatePlan.create({
    data: {
      tenantId,
      rentalAssetId,
      code,
      name: name || code,
      billingUnit,
      baseRate: parseMoney(baseRate),
      minimumCharge: parseMoney(minimumCharge),
      depositAmount: parseMoney(depositAmount),
      overtimeRate: overtimeRate != null ? parseMoney(overtimeRate) : null,
      lateFeePerDay: lateFeePerDay != null ? parseMoney(lateFeePerDay) : null,
      graceHours: Number(graceHours) || 0,
      currency,
      version,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
    },
  });
}

export async function patchCatalogueAsset({
  tenantId,
  assetId,
  code,
  rentalType,
  defaultDeposit,
  fixedAssetId,
  productId,
}) {
  const asset = await prisma.rentalAsset.findFirst({ where: { id: assetId, tenantId } });
  if (!asset) throw new Error('Rental asset not found');
  return prisma.rentalAsset.update({
    where: { id: assetId },
    data: {
      ...(code !== undefined ? { code: code || null } : {}),
      ...(rentalType !== undefined ? { rentalType } : {}),
      ...(defaultDeposit !== undefined ? { defaultDeposit: parseMoney(defaultDeposit) } : {}),
      ...(fixedAssetId !== undefined ? { fixedAssetId: fixedAssetId || null } : {}),
      ...(productId !== undefined ? { productId: productId || null } : {}),
    },
  });
}
