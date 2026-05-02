import { Prisma } from '@prisma/client';

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * Push purchase order line unit costs to Product so Stock shows the same reference cost and value.
 * Does not change on-hand quantity (receipts still drive qty/FIFO batches).
 *
 * - Updates `cost` and `lastPurchaseCost` to the PO line unit cost (last matching line wins if duplicate SKUs).
 * - If there are no open FIFO batches: `totalStockValue = stockLevel × unitCost`.
 * - If batches exist: `totalStockValue` is recomputed from remaining batch layers (same idea as createFifoBatch).
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {string} tenantId
 * @param {Array<{ lineType?: string, productId?: string | null, unitCost?: unknown }>} itemRows
 */
export async function syncProductCostsFromPurchaseOrderItems(tx, tenantId, itemRows) {
  if (!itemRows?.length) return;

  for (const row of itemRows) {
    const lineType = (row.lineType || 'goods').toLowerCase();
    if (lineType !== 'goods' || !row.productId) continue;

    const unitCost = Number(row.unitCost != null ? row.unitCost : NaN);
    if (!Number.isFinite(unitCost) || unitCost < 0) continue;

    const product = await tx.product.findFirst({
      where: { id: row.productId, tenantId },
      select: { id: true, stockLevel: true },
    });
    if (!product) continue;

    const openBatches = await tx.inventoryBatch.findMany({
      where: {
        tenantId,
        productId: row.productId,
        qtyRemaining: { gt: new Prisma.Decimal(0) },
      },
      select: { qtyRemaining: true, unitCost: true },
    });

    const stockQty = Number(product.stockLevel) || 0;

    let totalStockValueNum;
    if (openBatches.length === 0) {
      totalStockValueNum = round2(stockQty * unitCost);
    } else {
      totalStockValueNum = round2(
        openBatches.reduce(
          (sum, b) => sum + Number(b.qtyRemaining) * Number(b.unitCost),
          0
        )
      );
    }

    await tx.product.update({
      where: { id: row.productId },
      data: {
        cost: unitCost,
        lastPurchaseCost: new Prisma.Decimal(String(unitCost)),
        totalStockValue: new Prisma.Decimal(String(totalStockValueNum)),
      },
    });
  }
}
