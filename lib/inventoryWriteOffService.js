import { Prisma } from '@prisma/client';
import { createFifoBatch } from '@/lib/fifoCosting';
import { createInventoryWriteOffJournalEntry } from '@/lib/inventoryWriteOffJournal';

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function recomputeProductStockValue(tx, tenantId, productId) {
  const batches = await tx.inventoryBatch.findMany({
    where: { tenantId, productId, qtyRemaining: { gt: new Prisma.Decimal(0) } },
    select: { qtyRemaining: true, unitCost: true },
  });
  const totalStockValue = batches.reduce(
    (sum, b) => sum + toNum(b.qtyRemaining) * toNum(b.unitCost),
    0
  );
  await tx.product.update({
    where: { id: productId },
    data: { totalStockValue: new Prisma.Decimal(totalStockValue) },
  });
}

export async function executeInventoryWriteOff(prismaClient, {
  tenantId,
  userId,
  batchId,
  quantity,
  notes,
  expectedBranchId = undefined,
}) {
  return prismaClient.$transaction(async (tx) => {
    const batch = await tx.inventoryBatch.findFirst({
      where: { id: batchId, tenantId },
      include: {
        product: { select: { id: true, name: true } },
      },
    });
    if (!batch) throw new Error('Batch not found');
    if (
      expectedBranchId !== undefined &&
      expectedBranchId !== null &&
      expectedBranchId !== '' &&
      String(batch.branchId || '') !== String(expectedBranchId)
    ) {
      throw new Error('Branch mismatch: batch does not belong to the provided branch');
    }

    const qtyRem = toNum(batch.qtyRemaining);
    const qty =
      quantity != null && quantity !== ''
        ? Math.min(toNum(quantity), qtyRem)
        : qtyRem;
    if (qty <= 0) throw new Error('Nothing to write off');
    if (qty > qtyRem + 1e-9) throw new Error('Write-off quantity exceeds batch remaining');

    const productRow = await tx.product.findUnique({
      where: { id: batch.productId },
      select: { stockLevel: true },
    });
    const stockLevel = toNum(productRow?.stockLevel);
    if (stockLevel + 1e-9 < qty) {
      throw new Error('Write-off quantity exceeds product stock level');
    }

    const unitCost = toNum(batch.unitCost);
    const lossAmount = Math.round(qty * unitCost * 100) / 100;
    const writeOffSourceId = `writeoff-${batchId}-${qty.toFixed(6)}`;

    const existingAudit = await tx.inventoryExpiryAudit.findFirst({
      where: {
        tenantId,
        batchId,
        action: 'write_off',
        quantity: new Prisma.Decimal(qty),
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingAudit?.journalEntryId) {
      return {
        batchId,
        quantity: qty,
        lossAmount,
        journalEntryId: existingAudit.journalEntryId,
        productId: batch.productId,
      };
    }

    await tx.inventoryBatch.update({
      where: { id: batchId },
      data: {
        qtyRemaining: { decrement: new Prisma.Decimal(qty) },
      },
    });

    await tx.product.update({
      where: { id: batch.productId },
      data: {
        stockLevel: { decrement: new Prisma.Decimal(qty) },
      },
    });

    await recomputeProductStockValue(tx, tenantId, batch.productId);

    const intQty = Math.round(qty);
    const isWholeUnits = Math.abs(qty - intQty) < 1e-9 && intQty !== 0;
    if (isWholeUnits) {
      await tx.inventoryTransaction.create({
        data: {
          tenantId,
          userId,
          productId: batch.productId,
          branchId: batch.branchId,
          type: 'adjustment',
          quantity: -Math.abs(intQty),
          notes:
            notes ||
            `Inventory write-off (expiry/expired batch) — batch ${batchId.slice(0, 8)}…`,
        },
      });
    }

    const journal = await createInventoryWriteOffJournalEntry({
      tenantId,
      userId,
      amount: lossAmount,
      description: `Inventory write-off — ${batch.product?.name ?? batch.productId}`,
      sourceBatchId: batchId,
      sourceType: 'InventoryExpiryWriteOff',
      sourceId: writeOffSourceId,
      tx,
    });
    const lossAccountId =
      journal?.lines?.find((line) => Number(line.debitAmount || 0) > 0)?.accountId || null;
    const expenseReference = `inventory-writeoff:${writeOffSourceId}`;
    const existingExpense = await tx.expense.findFirst({
      where: {
        tenantId,
        originalReference: expenseReference,
        isDeleted: false,
      },
      select: { id: true },
    });
    if (!existingExpense && lossAmount > 0) {
      await tx.expense.create({
        data: {
          tenantId,
          submittedById: userId,
          branchId: batch.branchId || null,
          description: `Inventory write-off — ${batch.product?.name ?? batch.productId}`,
          amount: lossAmount,
          date: new Date(),
          category: 'Inventory Adjustment Loss',
          expenseAccountId: lossAccountId,
          status: 'Approved',
          paymentStatus: 'Fully paid',
          paymentMethod: 'journal',
          paidAmount: lossAmount,
          originalReference: expenseReference,
          notes: notes ?? null,
        },
      });
    }

    await tx.inventoryExpiryAudit.create({
      data: {
        tenantId,
        branchId: batch.branchId,
        userId,
        productId: batch.productId,
        batchId,
        action: 'write_off',
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(unitCost),
        lossAmount: new Prisma.Decimal(lossAmount),
        journalEntryId: journal?.id ?? null,
        notes: notes ?? null,
      },
    });

    return {
      batchId,
      quantity: qty,
      lossAmount,
      journalEntryId: journal?.id ?? null,
      productId: batch.productId,
    };
  });
}

export async function executeInventoryRestock(prismaClient, {
  tenantId,
  userId,
  productId,
  quantity,
  unitCost,
  expiryDate,
  branchId,
  notes,
  priorBatchId,
}) {
  const qty = toNum(quantity);
  const cost = toNum(unitCost);
  if (qty <= 0) throw new Error('Quantity must be positive');
  if (cost < 0) throw new Error('Unit cost cannot be negative');

  return prismaClient.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: productId, tenantId, isDeleted: false },
      select: { id: true, branchId: true, name: true },
    });
    if (!product) throw new Error('Product not found');

    const resolvedBranch =
      branchId !== undefined && branchId !== null && branchId !== ''
        ? branchId
        : product.branchId ?? null;

    if (
      branchId !== undefined &&
      branchId !== null &&
      branchId !== '' &&
      product.branchId &&
      String(product.branchId) !== String(branchId)
    ) {
      throw new Error('Branch mismatch: product belongs to a different branch');
    }

    if (priorBatchId) {
      const priorBatch = await tx.inventoryBatch.findFirst({
        where: { id: priorBatchId, tenantId },
        select: { id: true, productId: true, branchId: true },
      });
      if (!priorBatch) {
        throw new Error('Prior batch not found');
      }
      if (String(priorBatch.productId) !== String(productId)) {
        throw new Error('Branch mismatch: prior batch belongs to a different product');
      }
      if (
        resolvedBranch !== null &&
        String(priorBatch.branchId || '') !== String(resolvedBranch)
      ) {
        throw new Error('Branch mismatch: prior batch does not belong to the provided branch');
      }
    }

    const sourceId =
      priorBatchId != null
        ? `restock-after-${priorBatchId}`
        : `restock-${productId}-${Date.now()}`;

    const fifo = await createFifoBatch({
      tenantId,
      branchId: resolvedBranch,
      productId,
      quantityPurchased: qty,
      unitCost: cost,
      purchaseDate: new Date(),
      sourceType: 'ExpiryRestock',
      sourceId,
      expiryDate: expiryDate || null,
      tx,
    });

    await tx.inventoryExpiryAudit.create({
      data: {
        tenantId,
        branchId: resolvedBranch,
        userId,
        productId,
        batchId: priorBatchId ?? null,
        action: 'restock',
        quantity: new Prisma.Decimal(qty),
        unitCost: new Prisma.Decimal(cost),
        lossAmount: null,
        restockBatchId: fifo.batchId ?? null,
        journalEntryId: null,
        notes: notes ?? null,
      },
    });

    return {
      restockBatchId: fifo.batchId,
      quantityOnHand: fifo.quantityOnHand,
      productId,
    };
  });
}
