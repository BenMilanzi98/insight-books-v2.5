// lib/inventoryCosting.js
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

/**
 * Convert nullable decimal/number to JS number
 */
function toNumber(value, defaultValue = 0) {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  return Number(value);
}

/**
 * Update weighted average cost for a product when receiving inventory
 *
 * @param {Object} params
 * @param {string} params.productId
 * @param {string} params.tenantId
 * @param {number|string|import('@prisma/client').Prisma.Decimal} params.quantityReceived
 * @param {number|string|import('@prisma/client').Prisma.Decimal} params.unitCost
 * @param {import('@prisma/client').PrismaClient} [params.tx] - Optional transaction client
 * @returns {Promise<{ averageCost: number, newQuantity: number, totalStockValue: number }>}
 */
export async function updateAverageCost({
  productId,
  tenantId,
  quantityReceived,
  unitCost,
  tx = prisma
}) {
  if (!productId || !tenantId) {
    throw new Error('Product ID and tenant ID are required');
  }

  const qtyReceived = toNumber(quantityReceived);
  const costPerUnit = toNumber(unitCost);

  if (qtyReceived <= 0 || costPerUnit < 0) {
    throw new Error('Quantity received must be greater than zero and unit cost cannot be negative');
  }

  const product = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      stockLevel: true,
      averageCost: true,
      totalStockValue: true,
      totalPurchasedQty: true,
      lastPurchaseCost: true
    }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const currentQty = toNumber(product.stockLevel);
  const currentAvgCost = toNumber(product.averageCost);
  const currentStockValue = toNumber(product.totalStockValue);

  const existingValue = currentQty * currentAvgCost;
  const newPurchaseValue = qtyReceived * costPerUnit;

  const newQtyOnHand = currentQty + qtyReceived;
  const newTotalValue = existingValue + newPurchaseValue;
  const newAverageCost = newQtyOnHand > 0 ? newTotalValue / newQtyOnHand : 0;

  await tx.product.update({
    where: { id: productId },
    data: {
      stockLevel: new Prisma.Decimal(newQtyOnHand),
      averageCost: new Prisma.Decimal(newAverageCost),
      totalStockValue: new Prisma.Decimal(newTotalValue),
      lastPurchaseCost: new Prisma.Decimal(costPerUnit),
      lastPurchaseDate: new Date(),
      totalPurchasedQty: new Prisma.Decimal(toNumber(product.totalPurchasedQty) + qtyReceived)
    }
  });

  return {
    averageCost: newAverageCost,
    newQuantity: newQtyOnHand,
    totalStockValue: newTotalValue
  };
}

/**
 * Calculate COGS for a product when selling inventory and update stock levels
 *
 * @param {Object} params
 * @param {string} params.productId
 * @param {string} params.tenantId
 * @param {number|string|import('@prisma/client').Prisma.Decimal} params.quantitySold
 * @param {import('@prisma/client').PrismaClient} [params.tx] - Optional transaction client
 * @returns {Promise<{ unitCost: number, cogsAmount: number, remainingQuantity: number }>}
 */
export async function calculateCOGS({
  productId,
  tenantId,
  quantitySold,
  tx = prisma
}) {
  if (!productId || !tenantId) {
    throw new Error('Product ID and tenant ID are required');
  }

  const qtySold = toNumber(quantitySold);
  if (qtySold <= 0) {
    throw new Error('Quantity sold must be greater than zero');
  }

  const product = await tx.product.findFirst({
    where: { id: productId, tenantId },
    select: {
      stockLevel: true,
      averageCost: true,
      cost: true,
      lastPurchaseCost: true,
      totalStockValue: true,
      totalSoldQty: true
    }
  });

  if (!product) {
    throw new Error('Product not found');
  }

  const currentQty = toNumber(product.stockLevel);
  const avgCost = toNumber(product.averageCost);
  const fallbackCost = toNumber(product.cost) || toNumber(product.lastPurchaseCost);

  let unitCost = avgCost;
  if (!unitCost || unitCost <= 0) {
    unitCost = fallbackCost;
  }

  if (!unitCost || unitCost < 0) {
    unitCost = 0;
  }

  if (qtySold > currentQty) {
    console.warn(
      `⚠️ calculateCOGS: Selling more than available stock (product ${productId}). ` +
      `Stock on hand: ${currentQty}, quantity sold: ${qtySold}. Allowing negative stock.`
    );
  }

  const cogsAmount = qtySold * unitCost;
  const remainingQty = currentQty - qtySold;
  const newStockValue = remainingQty * unitCost;

  // DO NOT update stock level here - it's already updated in the sales route
  // Only update COGS-related fields (totalSoldQty, totalStockValue)
  // Stock level is managed separately to avoid double deduction
  await tx.product.update({
    where: { id: productId },
    data: {
      // stockLevel is NOT updated here - already handled in sales route
      averageCost: unitCost ? new Prisma.Decimal(unitCost) : product.averageCost,
      totalStockValue: new Prisma.Decimal(newStockValue),
      totalSoldQty: new Prisma.Decimal(toNumber(product.totalSoldQty) + qtySold)
    }
  });

  return {
    unitCost,
    cogsAmount,
    remainingQuantity: remainingQty
  };
}


