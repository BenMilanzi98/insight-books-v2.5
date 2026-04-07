/**
 * Derive how much has been received on PO goods lines from posted goods receipts,
 * so we stay consistent when PurchaseOrderItem.quantityReceived was never backfilled.
 */

/**
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 * @param {string} tenantId
 * @param {string[]} purchaseOrderItemIds
 * @returns {Promise<Map<string, number>>}
 */
export async function sumPostedGoodsReceiptQtyByPoLineIds(client, tenantId, purchaseOrderItemIds) {
  const ids = [...new Set((purchaseOrderItemIds || []).filter(Boolean))];
  if (!ids.length) return new Map();

  const rows = await client.goodsReceiptItem.findMany({
    where: {
      purchaseOrderItemId: { in: ids },
      goodsReceipt: {
        tenantId,
        status: 'Posted',
      },
    },
    select: {
      purchaseOrderItemId: true,
      quantityReceived: true,
    },
  });

  const map = new Map();
  for (const r of rows) {
    if (!r.purchaseOrderItemId) continue;
    const q = Number(r.quantityReceived ?? 0);
    if (!Number.isFinite(q) || q === 0) continue;
    const k = r.purchaseOrderItemId;
    map.set(k, (map.get(k) || 0) + q);
  }
  return map;
}

export function effectiveQuantityReceived(poLine, receiptSumByPoLineId) {
  const fromPo = Number(poLine?.quantityReceived ?? 0);
  const fromReceipts = receiptSumByPoLineId?.get(poLine?.id) || 0;
  return Math.max(fromPo, fromReceipts);
}

/** Remaining goods qty to receive on a line (uses receipt totals vs PO field). */
export function goodsLineRemainingQty(poLine, receiptSumByPoLineId) {
  const ordered = Number(poLine?.quantityOrdered ?? 0);
  const received = effectiveQuantityReceived(poLine, receiptSumByPoLineId);
  return Math.max(0, ordered - received);
}

export function isPoGoodsLine(item) {
  const lt = (item?.lineType || 'goods').toLowerCase();
  return lt === 'goods' && Boolean(item?.productId);
}

/**
 * Adds quantityReceivedEffective to each goods line (service/asset lines unchanged).
 * @param {object[]} purchaseOrders
 */
export async function attachQuantityReceivedEffective(client, tenantId, purchaseOrders) {
  const list = Array.isArray(purchaseOrders) ? purchaseOrders : [purchaseOrders];
  const itemIds = [];
  for (const po of list) {
    for (const it of po.items || []) {
      if (isPoGoodsLine(it) && it.id) itemIds.push(it.id);
    }
  }
  const sums = await sumPostedGoodsReceiptQtyByPoLineIds(client, tenantId, itemIds);
  for (const po of list) {
    if (!po.items?.length) continue;
    po.items = po.items.map((it) => {
      if (!isPoGoodsLine(it)) return it;
      const eff = effectiveQuantityReceived(it, sums);
      return { ...it, quantityReceivedEffective: eff };
    });
  }
  return list;
}
