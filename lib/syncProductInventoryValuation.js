/**
 * Keep product.cost / averageCost / totalStockValue aligned with FIFO batches.
 */
import { Prisma } from '@prisma/client';
import { parseMoney, roundMoney } from './money.js';
import { weightedAverageUnitCost } from './productCostDisplay.js';

function batchTotalValue(batches) {
  return batches.reduce(
    (sum, b) => sum + parseMoney(b.qtyRemaining) * parseMoney(b.unitCost),
    0
  );
}

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function recomputeProductStockValueFromBatches(tx, tenantId, productId) {
  const batches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      qtyRemaining: { gt: new Prisma.Decimal(0) },
    },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = roundMoney(batchTotalValue(batches));
  await tx.product.update({
    where: { id: productId },
    data: { totalStockValue: new Prisma.Decimal(String(totalStockValue)) },
  });
  return totalStockValue;
}

/**
 * Set unit cost on all open batches (manual cost correction on product form).
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function syncOpenBatchUnitCosts(tx, tenantId, productId, unitCost) {
  const cost = parseMoney(unitCost);
  if (cost < 0) return 0;
  const result = await tx.inventoryBatch.updateMany({
    where: {
      tenantId,
      productId,
      qtyRemaining: { gt: new Prisma.Decimal(0) },
    },
    data: { unitCost: new Prisma.Decimal(String(cost)) },
  });
  return result.count;
}

/**
 * Recompute totalStockValue from batches and sync product cost fields to WAC.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function reconcileProductInventoryValuation(tx, tenantId, productId) {
  await recomputeProductStockValueFromBatches(tx, tenantId, productId);
  const row = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: { stockLevel: true, totalStockValue: true, cost: true, averageCost: true },
  });
  if (!row) return null;

  const wac = weightedAverageUnitCost(row);
  await tx.product.update({
    where: { id: productId },
    data: {
      cost: new Prisma.Decimal(String(wac)),
      averageCost: new Prisma.Decimal(String(wac)),
      totalStockValue: row.totalStockValue,
    },
  });

  return {
    wac,
    totalStockValue: parseMoney(row.totalStockValue),
    stockLevel: parseMoney(row.stockLevel),
  };
}
