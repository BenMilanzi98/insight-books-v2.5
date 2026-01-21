import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

function toNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  return Number(value);
}

function toDecimal(value) {
  return new Prisma.Decimal(value);
}

/**
 * Create a FIFO batch on purchase and update product "default cost" reference fields.
 * - Users never edit batches
 * - Batch cost is source-of-truth for FIFO/COGS
 */
export async function createFifoBatch({
  tenantId,
  branchId = null,
  productId,
  quantityPurchased,
  unitCost,
  purchaseDate = new Date(),
  sourceType = null,
  sourceId = null,
  tx = prisma,
}) {
  const qty = toNumber(quantityPurchased);
  const cost = toNumber(unitCost);
  if (!tenantId || !productId) throw new Error('tenantId and productId are required');
  if (qty <= 0) throw new Error('quantityPurchased must be > 0');
  if (cost < 0) throw new Error('unitCost must be >= 0');

  await tx.inventoryBatch.create({
    data: {
      tenantId,
      branchId,
      productId,
      sourceType,
      sourceId,
      purchaseDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
      qtyPurchased: toDecimal(qty),
      qtyRemaining: toDecimal(qty),
      unitCost: toDecimal(cost),
    },
  });

  // Update product "default cost" reference (NOT used for COGS)
  // Also maintain stockLevel as operational quantity (used for availability checks and UI)
  const product = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: { id: true, stockLevel: true },
  });
  if (!product) throw new Error('Product not found');

  const currentQty = toNumber(product.stockLevel);
  const newQty = currentQty + qty;

  // Recompute stock value from remaining FIFO batches (valuation)
  const batches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      ...(branchId ? { branchId } : {}),
      qtyRemaining: { gt: toDecimal(0) },
    },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = batches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);

  await tx.product.update({
    where: { id: productId },
    data: {
      stockLevel: new Prisma.Decimal(newQty),
      // Default cost (human reference only)
      cost: cost,
      lastPurchaseCost: toDecimal(cost),
      lastPurchaseDate: purchaseDate instanceof Date ? purchaseDate : new Date(purchaseDate),
      // Inventory valuation based on remaining batches
      totalStockValue: toDecimal(totalStockValue),
    },
  });

  return { quantityOnHand: newQty, totalStockValue };
}

/**
 * Consume FIFO batches for a sale and return COGS.
 * IMPORTANT: This does NOT update product.stockLevel (sales route already decrements it).
 * It only updates batch qtyRemaining and valuation totals.
 */
export async function consumeFifoForSale({
  tenantId,
  branchId = null,
  productId,
  quantitySold,
  saleId = null,
  saleItemId = null,
  tx = prisma,
}) {
  const qtyToSell = toNumber(quantitySold);
  if (!tenantId || !productId) throw new Error('tenantId and productId are required');
  if (qtyToSell <= 0) throw new Error('quantitySold must be > 0');

  // Lock batches in FIFO order (oldest first)
  const batches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      ...(branchId ? { branchId } : {}),
      qtyRemaining: { gt: toDecimal(0) },
    },
    orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
  });

  const totalAvailable = batches.reduce((sum, b) => sum + toNumber(b.qtyRemaining), 0);
  if (totalAvailable + 1e-9 < qtyToSell) {
    throw new Error(`Insufficient stock for FIFO. Available: ${totalAvailable}, Requested: ${qtyToSell}`);
  }

  let remaining = qtyToSell;
  let cogsAmount = 0;
  const allocations = [];

  for (const batch of batches) {
    if (remaining <= 0) break;
    const batchRemaining = toNumber(batch.qtyRemaining);
    if (batchRemaining <= 0) continue;

    const useQty = Math.min(batchRemaining, remaining);
    const unitCost = toNumber(batch.unitCost);
    const lineCogs = useQty * unitCost;

    // Update batch remaining
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { qtyRemaining: toDecimal(batchRemaining - useQty) },
    });

    // Audit consumption
    await tx.inventoryBatchConsumption.create({
      data: {
        tenantId,
        batchId: batch.id,
        saleId,
        saleItemId,
        quantity: toDecimal(useQty),
        unitCost: toDecimal(unitCost),
        cogsAmount: toDecimal(lineCogs),
      },
    });

    allocations.push({ batchId: batch.id, quantity: useQty, unitCost, cogsAmount: lineCogs });
    cogsAmount += lineCogs;
    remaining -= useQty;
  }

  // Recompute valuation for this product from remaining batches
  const remainingBatches = await tx.inventoryBatch.findMany({
    where: {
      tenantId,
      productId,
      ...(branchId ? { branchId } : {}),
      qtyRemaining: { gt: toDecimal(0) },
    },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = remainingBatches.reduce((sum, b) => sum + (toNumber(b.qtyRemaining) * toNumber(b.unitCost)), 0);

  await tx.product.update({
    where: { id: productId },
    data: {
      totalStockValue: toDecimal(totalStockValue),
      totalSoldQty: { increment: toDecimal(qtyToSell) },
    },
  });

  return { cogsAmount, allocations };
}



