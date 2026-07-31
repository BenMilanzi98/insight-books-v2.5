import { Prisma } from '@prisma/client';
import { createFifoBatch } from '@/lib/fifoCosting';
import { resolveBranchId } from '@/lib/branchHelpers';
import { createPurchaseReceiptJournalEntry } from '@/lib/purchaseAccounting';
import { autoCreateBillFromReceipt, syncAssetsFromAssetReceipt } from '@/lib/goodsReceiptFollowOn';

/** Ledger row quantity: align with goods receipt line (may be fractional). */
function inventoryLedgerQuantity(qtyRaw) {
  const n = Number(qtyRaw);
  if (!Number.isFinite(n)) return new Prisma.Decimal(0);
  return new Prisma.Decimal(String(n));
}

/**
 * FIFO batches, inventory transactions, GL journal, supplier bill, and asset sync (when applicable).
 * Call only for posted inventory receipts. Idempotent if inventoryAppliedAt is already set.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 */
export async function applyGoodsReceiptInventoryPosting(tx, {
  goodsReceipt,
  tenantId,
  userId,
  actingUser,
  supplier,
  purchaseOrder,
  totalAmount,
  requestBranchId,
}) {
  if (goodsReceipt.inventoryAppliedAt) {
    return { skipped: true, journalEntryResult: null };
  }
  if (!goodsReceipt.items?.length) {
    return { skipped: true, journalEntryResult: null };
  }

  const branchId = await resolveBranchId(actingUser, requestBranchId ?? null, tenantId);

  const toPositiveNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : fallback;
  };

  const parseReceiptItemAllocations = (item) => {
    if (!Array.isArray(item?.expiryAllocations) || item.expiryAllocations.length === 0) {
      return [];
    }
    return item.expiryAllocations
      .map((row) => {
        const qty = toPositiveNumber(row?.qty, 0);
        const unitCost = Number.isFinite(Number(row?.unitCost))
          ? Number(row.unitCost)
          : Number(item.unitCost || 0);
        if (!(qty > 0) || unitCost < 0) return null;
        const expiryDate =
          row?.expiryDate && String(row.expiryDate).trim() !== ''
            ? new Date(row.expiryDate)
            : null;
        if (expiryDate && Number.isNaN(expiryDate.getTime())) return null;
        return { qty, unitCost, expiryDate };
      })
      .filter(Boolean);
  };

  let journalEntryResult = null;
  for (const item of goodsReceipt.items) {
    const purchaseDate = goodsReceipt.receiptDate || goodsReceipt.createdAt || new Date();
    const acceptedQtyRaw =
      item.acceptedQuantity != null && item.acceptedQuantity !== ''
        ? item.acceptedQuantity
        : item.quantityReceived;
    const stockQty = Number(acceptedQtyRaw);
    // Rejected / zero-accepted lines must not increase available stock
    if (!(stockQty > 0)) {
      continue;
    }

    const allocationRows = parseReceiptItemAllocations(item);
    if (allocationRows.length > 0) {
      for (let allocIndex = 0; allocIndex < allocationRows.length; allocIndex += 1) {
        const row = allocationRows[allocIndex];
        await createFifoBatch({
          tenantId,
          branchId,
          productId: item.productId,
          quantityPurchased: row.qty,
          unitCost: row.unitCost,
          purchaseDate,
          sourceType: 'GoodsReceipt',
          sourceId: `${goodsReceipt.id}:line${item.lineNumber}:alloc${allocIndex + 1}`,
          expiryDate: row.expiryDate || null,
          tx,
        });
      }
    } else {
      await createFifoBatch({
        tenantId,
        branchId,
        productId: item.productId,
        quantityPurchased: stockQty,
        unitCost: item.unitCost,
        purchaseDate,
        sourceType: 'GoodsReceipt',
        sourceId: `${goodsReceipt.id}:line${item.lineNumber}`,
        expiryDate: item.expiryDate || null,
        tx,
      });
    }

    await tx.inventoryTransaction.create({
      data: {
        productId: item.productId,
        tenantId,
        userId,
        type: 'goods_receipt',
        quantity: inventoryLedgerQuantity(acceptedQtyRaw),
        branchId,
        notes: `Receipt ${goodsReceipt.receiptNumber} line ${item.lineNumber}`,
      },
    });
  }

  journalEntryResult = await createPurchaseReceiptJournalEntry({
    tenantId,
    userId,
    goodsReceiptId: goodsReceipt.id,
    supplierId: supplier.id,
    totalAmount,
    reference: goodsReceipt.receiptNumber,
    tx,
  });

  await tx.goodsReceipt.update({
    where: { id: goodsReceipt.id },
    data: {
      journalEntryId: journalEntryResult.journalEntryId || journalEntryResult.id,
      inventoryAppliedAt: new Date(),
    },
  });

  const updatedGr = await tx.goodsReceipt.findUnique({
    where: { id: goodsReceipt.id },
    include: { items: true },
  });

  await autoCreateBillFromReceipt({
    tx,
    goodsReceipt: updatedGr,
    supplier,
    purchaseOrder,
    tenantId,
    userId,
    journalEntryId: journalEntryResult.journalEntryId || journalEntryResult.id || null,
  });

  if (purchaseOrder && (purchaseOrder.orderType || '').toLowerCase() === 'assets') {
    const poFresh = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrder.id },
    });
    if (poFresh?.status === 'Received') {
      await syncAssetsFromAssetReceipt({
        tx,
        goodsReceipt: updatedGr,
        purchaseOrder: poFresh,
        tenantId,
        userId,
        supplierName: supplier.supplierName || supplier.name || null,
      });
    }
  }

  return { skipped: false, journalEntryResult };
}
