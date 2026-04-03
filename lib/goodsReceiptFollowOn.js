// Shared follow-on effects for goods receipts (bills, assets).
import { Prisma } from '@prisma/client';

export async function ensureDefaultAssetCategory(tenantId, userId, tx) {
  let category = await tx.assetCategory.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'asc' }
  });
  if (category) return category;

  category = await tx.assetCategory.create({
    data: {
      tenantId,
      name: 'Uncategorized Assets',
      description: 'Auto-created category for assets received from purchase orders.'
    }
  });
  return category;
}

export async function syncAssetsFromAssetReceipt({ tx, goodsReceipt, purchaseOrder, tenantId, userId, supplierName }) {
  if (!goodsReceipt || !purchaseOrder) return { created: 0 };
  if ((purchaseOrder.orderType || '').toLowerCase() !== 'assets') return { created: 0 };
  if (goodsReceipt.status !== 'Posted') return { created: 0 };

  const defaultCategory = await ensureDefaultAssetCategory(tenantId, userId, tx);
  let created = 0;

  for (const item of goodsReceipt.items || []) {
    const qty = Math.max(0, Math.floor(Number(item.quantityReceived || 0)));
    const unitCost = Number(item.unitCost || 0);
    if (qty <= 0 || unitCost <= 0) continue;

    const product = await tx.product.findFirst({
      where: { id: item.productId, tenantId },
      select: { id: true, name: true, sku: true }
    });
    const baseName = product?.name || `Asset Item ${item.lineNumber || ''}`.trim();
    const noteMarker = `AUTO_ASSET_FROM_GR:${goodsReceipt.id}:${item.id}`;

    const existing = await tx.asset.count({
      where: {
        tenantId,
        notes: { contains: noteMarker, mode: 'insensitive' }
      }
    });
    if (existing >= qty) continue;

    for (let i = existing; i < qty; i++) {
      const suffix = qty > 1 ? ` (${i + 1}/${qty})` : '';
      await tx.asset.create({
        data: {
          tenantId,
          createdById: userId,
          categoryId: defaultCategory.id,
          name: `${baseName}${suffix}`.slice(0, 255),
          description: `Auto-created from Asset PO ${purchaseOrder.poNumber}`,
          purchaseDate: goodsReceipt.receiptDate || new Date(),
          originalCost: unitCost,
          usefulLifeYears: 5,
          depreciationMethod: 'straight_line',
          status: 'draft',
          supplier: supplierName || null,
          serialNumber: product?.sku || null,
          notes: `${noteMarker}. Complete depreciation settings in Asset Management.`
        }
      });
      created++;
    }
  }

  return { created };
}

export async function autoCreateBillFromReceipt({
  tx,
  goodsReceipt,
  supplier,
  purchaseOrder,
  tenantId,
  userId,
  journalEntryId
}) {
  if (!goodsReceipt?.items?.length) return null;

  const existing = await tx.supplierBill.findFirst({
    where: { goodsReceiptId: goodsReceipt.id, tenantId }
  });
  if (existing) return existing;

  const fromLines = goodsReceipt.items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantityReceived || 0) * Number(item.unitCost || 0),
    0
  );
  const headerTotal = goodsReceipt.totalAmount != null ? Number(goodsReceipt.totalAmount) : null;
  const subtotal =
    headerTotal != null && !Number.isNaN(headerTotal)
      ? Math.round(headerTotal * 100) / 100
      : Math.round(fromLines * 100) / 100;

  const paymentTerms =
    supplier.paymentTerms ?? purchaseOrder?.paymentTerms ?? 30;
  const billDate =
    goodsReceipt.receiptDate instanceof Date
      ? goodsReceipt.receiptDate
      : new Date(goodsReceipt.receiptDate);
  const dueDate = new Date(billDate);
  dueDate.setDate(dueDate.getDate() + paymentTerms);

  const billNumber = `GRB-${goodsReceipt.receiptNumber}`;

  const bill = await tx.supplierBill.create({
    data: {
      tenantId,
      supplierId: supplier.id,
      purchaseOrderId:
        goodsReceipt.purchaseOrderId || purchaseOrder?.id || null,
      goodsReceiptId: goodsReceipt.id,
      billNumber,
      billDate,
      dueDate,
      billType: 'inventory',
      supplierInvoiceNumber: goodsReceipt.supplierReference || null,
      subtotal,
      taxAmount: 0,
      totalAmount: subtotal,
      amountPaid: 0,
      status: 'Unpaid',
      paymentTerms,
      currency: supplier.currency || 'MWK',
      notes: goodsReceipt.notes || null,
      createdById: userId,
      finalizedAt: new Date(),
      finalizedById: userId,
      journalEntryId: journalEntryId || null,
      items: {
        create: goodsReceipt.items.map((item, index) => ({
          lineNumber: index + 1,
          productId: item.productId,
          description: item.notes || '',
          quantity: Number(item.quantityReceived || 0),
          unitCost: Number(item.unitCost || 0),
          lineTotal:
            Number(item.quantityReceived || 0) * Number(item.unitCost || 0),
          taxRate: 0,
          taxAmount: 0
        }))
      }
    }
  });

  await tx.supplier.update({
    where: { id: supplier.id },
    data: {
      currentBalance: {
        increment: subtotal
      }
    }
  });

  return bill;
}
