/**
 * Shared stock transfer execution: FIFO out at source, FIFO in at destination, audit rows.
 */
import { Prisma } from '@prisma/client';
import { createFifoBatch, consumeFifoForSale } from '@/lib/fifoCosting';

/**
 * Find matching product at destination (SKU, then name; branch or tenant-wide).
 */
export async function findDestinationProductForTransfer(tx, toTenantId, primaryBranchId, sourceProduct) {
  const branchScope = [{ branchId: primaryBranchId }, { branchId: null }];
  const base = { tenantId: toTenantId, isDeleted: false, OR: branchScope };

  const sku = sourceProduct.sku != null ? String(sourceProduct.sku).trim() : '';
  if (sku) {
    const bySku = await tx.product.findFirst({
      where: { ...base, sku: { equals: sku, mode: 'insensitive' } },
    });
    if (bySku) return bySku;
  }

  const name = sourceProduct.name != null ? String(sourceProduct.name).trim() : '';
  if (name) {
    return tx.product.findFirst({
      where: { ...base, name: { equals: name, mode: 'insensitive' } },
    });
  }

  return null;
}

/**
 * Resolve source product row for an existing transfer record.
 */
export async function resolveSourceProductForTransfer(tx, transfer, fromTenantId) {
  return tx.product.findFirst({
    where: {
      id: transfer.productId,
      tenantId: fromTenantId,
      isDeleted: false,
      OR: [{ branchId: transfer.fromBranchId }, { branchId: null }],
    },
  });
}

/**
 * Move stock for an approved transfer: consume source FIFO, credit destination FIFO, log transactions.
 * @returns {{ destinationProduct: object, unitCost: number, transferCost: number }}
 */
export async function executeStockTransferMovement({
  tx,
  transfer,
  sourceProduct,
  fromTenantId,
  toTenantId,
  fromBranchId,
  toBranchId,
  fromBranchName,
  toBranchName,
  userId,
  sameTenantTransfer = fromTenantId === toTenantId,
}) {
  const qtyDecimal =
    transfer.quantity instanceof Prisma.Decimal
      ? transfer.quantity
      : new Prisma.Decimal(parseFloat(transfer.quantity));
  const transferQuantity = parseFloat(qtyDecimal.toString());

  if (transferQuantity <= 0) {
    throw new Error('Transfer quantity must be positive');
  }

  const availableStock = parseFloat(sourceProduct.stockLevel || 0);
  if (availableStock + 1e-9 < transferQuantity) {
    throw new Error(
      `Insufficient stock. Available: ${availableStock}, Requested: ${transferQuantity}`
    );
  }

  let destinationProduct = await findDestinationProductForTransfer(
    tx,
    toTenantId,
    toBranchId,
    sourceProduct
  );

  if (!destinationProduct) {
    const skuTrim = sourceProduct.sku != null ? String(sourceProduct.sku).trim() : '';
    const newSku =
      skuTrim || `TRANSFER-${String(sourceProduct.id).substring(0, 8)}-${Date.now()}`;

    destinationProduct = await tx.product.create({
      data: {
        name: sourceProduct.name || 'Transferred Product',
        sku: newSku,
        description: sourceProduct.description || null,
        price: sourceProduct.price ? parseFloat(sourceProduct.price) : 0,
        cost: sourceProduct.cost ? parseFloat(sourceProduct.cost) : null,
        category: sourceProduct.category || null,
        location: sourceProduct.location || null,
        reorderPoint: sourceProduct.reorderPoint || null,
        image: sourceProduct.image || null,
        isService: sourceProduct.isService || false,
        stockLevel: new Prisma.Decimal(0),
        tenantId: toTenantId,
        branchId: toBranchId,
        categoryId: sameTenantTransfer ? sourceProduct.categoryId || null : null,
        inventoryAccountId: sameTenantTransfer ? sourceProduct.inventoryAccountId || null : null,
        cogsAccountId: sameTenantTransfer ? sourceProduct.cogsAccountId || null : null,
        taxRate: sourceProduct.taxRate || 0,
      },
    });
  }

  // FIFO consumption at source (does not change stockLevel — we decrement below)
  let unitCost = parseFloat(sourceProduct.cost || 0);
  try {
    const fifoOut = await consumeFifoForSale({
      tenantId: fromTenantId,
      branchId: sourceProduct.branchId || fromBranchId || null,
      productId: sourceProduct.id,
      quantitySold: transferQuantity,
      saleId: null,
      tx,
      updateSoldQty: false,
    });
    if (fifoOut?.cogsAmount > 0 && transferQuantity > 0) {
      unitCost = fifoOut.cogsAmount / transferQuantity;
    }
  } catch (fifoErr) {
    console.warn(
      `[Stock Transfer] Source FIFO consumption skipped for product ${sourceProduct.id}:`,
      fifoErr?.message || fifoErr
    );
  }

  await tx.product.update({
    where: { id: sourceProduct.id },
    data: { stockLevel: { decrement: qtyDecimal } },
  });

  const sourceId = `transfer-${transfer.id}`;
  try {
    await createFifoBatch({
      tenantId: toTenantId,
      branchId: toBranchId,
      productId: destinationProduct.id,
      quantityPurchased: transferQuantity,
      unitCost: unitCost > 0 ? unitCost : 0,
      purchaseDate: new Date(),
      sourceType: 'StockTransfer',
      sourceId,
      tx,
    });
  } catch (fifoInErr) {
    console.warn('[Stock Transfer] Destination FIFO batch failed, using direct increment:', fifoInErr?.message);
    await tx.product.update({
      where: { id: destinationProduct.id },
      data: { stockLevel: { increment: qtyDecimal } },
    });
  }

  const negQty = qtyDecimal.mul(-1);
  await tx.inventoryTransaction.createMany({
    data: [
      {
        type: 'Stock Out',
        quantity: negQty,
        notes: `Stock transfer to ${toBranchName || 'destination'}`,
        productId: sourceProduct.id,
        userId,
        tenantId: fromTenantId,
        branchId: fromBranchId,
      },
      {
        type: 'Stock In',
        quantity: qtyDecimal,
        notes: `Stock transfer from ${fromBranchName || 'source'}`,
        productId: destinationProduct.id,
        userId,
        tenantId: toTenantId,
        branchId: toBranchId,
      },
    ],
  });

  return {
    destinationProduct,
    unitCost,
    transferCost: unitCost * transferQuantity,
  };
}
