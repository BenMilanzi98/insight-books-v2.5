/**
 * Supplier bill cancel: undo FIFO layers and stock tied to a bill (direct SupplierBill batches
 * or GoodsReceipt batches when the bill was created from a receipt).
 */

/**
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function findBillLinkedInventoryBatches(tx, bill, tenantId) {
  const or = [{ tenantId, sourceType: 'SupplierBill', sourceId: bill.id }];
  if (bill.goodsReceiptId) {
    or.push({
      tenantId,
      sourceType: 'GoodsReceipt',
      sourceId: bill.goodsReceiptId
    });
  }
  return tx.inventoryBatch.findMany({
    where: { OR: or },
    select: {
      id: true,
      productId: true,
      qtyPurchased: true,
      qtyRemaining: true
    }
  });
}

/**
 * Removes FIFO batches (and their consumptions), related inventory transactions, and recomputes product stock.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @returns {Promise<{ batchCount: number, consumptionsRemoved: number }>}
 */
export async function reverseSupplierBillInventoryInTx(tx, { bill, tenantId }) {
  const bt = (bill.billType || '').toLowerCase();
  if (bt !== 'inventory' && bt !== 'stock') {
    return { batchCount: 0, consumptionsRemoved: 0, affectedProductIds: [] };
  }

  const fifoBatches = await findBillLinkedInventoryBatches(tx, bill, tenantId);
  if (!fifoBatches.length) {
    return { batchCount: 0, consumptionsRemoved: 0, affectedProductIds: [] };
  }

  const batchIds = fifoBatches.map((b) => b.id);
  const batchProductIds = [...new Set(fifoBatches.map((b) => b.productId))];

  const billItems = await tx.supplierBillItem.findMany({
    where: { billId: bill.id, productId: { not: null } },
    select: { productId: true }
  });
  const billProductIds = [...new Set(billItems.map((i) => i.productId).filter(Boolean))];
  const productFilterIds =
    billProductIds.length > 0
      ? [...new Set([...batchProductIds, ...billProductIds])]
      : batchProductIds;

  const delConsumptionsResult = await tx.inventoryBatchConsumption.deleteMany({
    where: { tenantId, batchId: { in: batchIds } }
  });
  const consumptionsRemoved = delConsumptionsResult.count ?? 0;

  await tx.inventoryBatch.deleteMany({ where: { id: { in: batchIds } } });

  let receiptNumber = null;
  if (bill.goodsReceiptId) {
    const gr = await tx.goodsReceipt.findFirst({
      where: { id: bill.goodsReceiptId, tenantId },
      select: { receiptNumber: true }
    });
    receiptNumber = gr?.receiptNumber || null;
  }

  const orParts = [];
  const bn = bill.billNumber || '';
  if (bn && productFilterIds.length) {
    orParts.push({
      tenantId,
      type: 'purchase',
      productId: { in: productFilterIds },
      notes: { contains: `Purchase Bill ${bn}`, mode: 'insensitive' }
    });
  }
  if (receiptNumber && productFilterIds.length) {
    orParts.push({
      tenantId,
      type: 'goods_receipt',
      productId: { in: productFilterIds },
      notes: { contains: `Receipt ${receiptNumber}`, mode: 'insensitive' }
    });
  }

  if (orParts.length) {
    await tx.inventoryTransaction.deleteMany({ where: { OR: orParts } });
  }

  const affectedProductIds = [...new Set([...batchProductIds, ...billProductIds])];

  for (const productId of affectedProductIds) {
    const remaining = await tx.inventoryBatch.findMany({
      where: { tenantId, productId },
      select: { qtyRemaining: true, unitCost: true }
    });
    const newQty = remaining.reduce((sum, b) => sum + Number(b.qtyRemaining || 0), 0);
    const newValue = remaining.reduce(
      (sum, b) => sum + Number(b.qtyRemaining || 0) * Number(b.unitCost || 0),
      0
    );

    await tx.product.update({
      where: { id: productId },
      data: {
        stockLevel: newQty,
        totalStockValue: newValue
      }
    });
  }

  return {
    batchCount: fifoBatches.length,
    consumptionsRemoved,
    affectedProductIds
  };
}
