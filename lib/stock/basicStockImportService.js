/**
 * Basic four-column stock import: preview + confirm.
 * Business = session tenant. Location = hidden primary branch (not user-selected).
 * Hybrid: FIFO batch at Order Price + WAC fields on Product.
 */

import { Prisma } from '@prisma/client';
import prisma from '../prisma.js';
import { createFifoBatch } from '../fifoCosting.js';
import { resolveHiddenPrimaryBranchId } from '../hiddenPrimaryBranch.js';
import { parseMoney, roundMoney } from '../money.js';
import {
  matchProductsByNormalizedName,
  normalizeItemName,
} from './itemNameNormalization.js';
import { computeWeightedAverageAfterReceipt } from './weightedAverageCost.js';
import { parseBasicStockWorkbook, validateBasicStockRawRow } from './basicStockWorkbook.js';

function toNum(v, d = 0) {
  if (v == null) return d;
  if (typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

function consolidateByNormalizedName(validatedRows) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const row of validatedRows) {
    if (row.status === 'SKIPPED' || row.status === 'INVALID' || !row.normalizedName) {
      continue;
    }
    const prev = map.get(row.normalizedName);
    if (!prev) {
      map.set(row.normalizedName, {
        ...row,
        sourceRows: [row.rowNumber],
        quantity: row.quantity,
        orderValue: roundMoney(row.quantity * row.orderPrice),
      });
      continue;
    }
    const totalQty = prev.quantity + row.quantity;
    const totalValue = roundMoney(prev.orderValue + row.quantity * row.orderPrice);
    const blendedCost = totalQty > 0 ? roundMoney(totalValue / totalQty) : row.orderPrice;
    const sellingConflict = prev.sellingPrice !== row.sellingPrice;
    map.set(row.normalizedName, {
      ...prev,
      quantity: totalQty,
      orderPrice: blendedCost,
      orderValue: totalValue,
      sellingPrice: row.sellingPrice,
      sourceRows: [...prev.sourceRows, row.rowNumber],
      warnings: [
        ...(prev.warnings || []),
        ...(row.warnings || []),
        ...(sellingConflict
          ? [{ code: 'SELLING_PRICE_CONFLICT', message: 'Selling Prices differed across duplicate rows; last value used.' }]
          : []),
        { code: 'ROWS_CONSOLIDATED', message: `Consolidated rows ${[...prev.sourceRows, row.rowNumber].join(', ')}.` },
      ],
      status: prev.status === 'WARNING' || row.status === 'WARNING' || sellingConflict ? 'WARNING' : 'VALID',
    });
  }
  return [...map.values()];
}

/**
 * Preview import without writing stock.
 */
export async function previewBasicStockImport({
  tenantId,
  userId,
  buffer,
  fileName = null,
  purpose = 'STOCK_RECEIPT_IMPORT',
  updateSellingPrice = true,
  forceAsNewReceipt = false,
  db = prisma,
}) {
  if (!tenantId || !userId) throw Object.assign(new Error('tenantId and userId are required.'), { code: 'UNAUTHORIZED' });

  const parsed = await parseBasicStockWorkbook(buffer);
  const validated = parsed.rows.map(validateBasicStockRawRow);
  const invalid = validated.filter((r) => r.status === 'INVALID');
  const consolidated = consolidateByNormalizedName(validated);

  const products = await db.product.findMany({
    where: { tenantId, isDeleted: false, isService: false },
    select: {
      id: true,
      name: true,
      normalizedName: true,
      stockLevel: true,
      totalStockValue: true,
      averageCost: true,
      cost: true,
      price: true,
    },
  });

  // Ensure normalizedName populated in-memory for matching
  const catalog = products.map((p) => ({
    ...p,
    normalizedName: p.normalizedName || normalizeItemName(p.name),
  }));

  const previewRows = [];
  for (const row of consolidated) {
    const match = matchProductsByNormalizedName(catalog, row.normalizedName);
    if (match.status === 'AMBIGUOUS') {
      previewRows.push({
        ...row,
        matchStatus: 'AMBIGUOUS',
        status: 'BLOCKED',
        productId: null,
        errors: [
          ...(row.errors || []),
          {
            code: 'AMBIGUOUS_ITEM_MATCH',
            message: `Multiple Items match "${row.itemName}". Resolve duplicates before import.`,
            matches: match.products.map((p) => ({ id: p.id, name: p.name })),
          },
        ],
      });
      continue;
    }

    if (match.status === 'MATCH') {
      const p = match.product;
      const qtyBefore = toNum(p.stockLevel);
      const valueBefore = toNum(p.totalStockValue);
      const wacBefore =
        qtyBefore > 0 && valueBefore > 0
          ? roundMoney(valueBefore / qtyBefore)
          : parseMoney(p.averageCost ?? p.cost ?? 0);
      const wac = computeWeightedAverageAfterReceipt(
        { quantity: qtyBefore, unitCost: wacBefore },
        { quantity: row.quantity, unitCost: row.orderPrice }
      );
      previewRows.push({
        ...row,
        matchStatus: 'MATCHED',
        productId: p.id,
        quantityBefore: qtyBefore,
        quantityAfter: wac.newQuantity,
        valueBefore: wac.existingValue,
        valueAfter: wac.newValue,
        wacBefore,
        wacAfter: wac.newWeightedAverageCost,
        sellingPriceBefore: toNum(p.price),
        sellingPriceAfter: updateSellingPrice ? row.sellingPrice : toNum(p.price),
        status: row.status === 'WARNING' ? 'WARNING' : 'READY',
      });
    } else {
      previewRows.push({
        ...row,
        matchStatus: 'NEW',
        productId: null,
        quantityBefore: 0,
        quantityAfter: row.quantity,
        valueBefore: 0,
        valueAfter: roundMoney(row.quantity * row.orderPrice),
        wacBefore: 0,
        wacAfter: row.orderPrice,
        sellingPriceBefore: null,
        sellingPriceAfter: row.sellingPrice,
        status: row.status === 'WARNING' ? 'WARNING' : 'READY',
      });
    }
  }

  // Include invalids for UI
  for (const row of invalid) {
    previewRows.push({ ...row, matchStatus: 'INVALID', status: 'INVALID' });
  }

  const existingBatch = await db.stockImportBatch.findUnique({
    where: {
      tenantId_fileHash_purpose: { tenantId, fileHash: parsed.fileHash, purpose },
    },
  }).catch(() => null);

  const ready = previewRows.filter((r) => r.status === 'READY' || r.status === 'WARNING');
  const blocked = previewRows.filter((r) => r.status === 'BLOCKED' || r.status === 'INVALID');

  return {
    fileHash: parsed.fileHash,
    fileName,
    purpose,
    multiSheet: parsed.multiSheet,
    updateSellingPrice,
    forceAsNewReceipt,
    previousImport: existingBatch
      ? {
          id: existingBatch.id,
          status: existingBatch.status,
          completedAt: existingBatch.completedAt,
          createdAt: existingBatch.createdAt,
        }
      : null,
    duplicateFileWarning: Boolean(existingBatch && ['COMPLETED', 'COMPLETED_WITH_WARNINGS', 'PROCESSING'].includes(existingBatch.status)),
    summary: {
      totalRows: validated.filter((r) => r.status !== 'SKIPPED').length,
      consolidatedItems: consolidated.length,
      validRows: ready.length,
      warningRows: previewRows.filter((r) => r.status === 'WARNING').length,
      invalidRows: invalid.length,
      blockedRows: blocked.length,
      newItems: previewRows.filter((r) => r.matchStatus === 'NEW').length,
      matchedItems: previewRows.filter((r) => r.matchStatus === 'MATCHED').length,
      totalIncomingQuantity: roundMoney(ready.reduce((s, r) => s + (r.quantity || 0), 0)),
      totalIncomingValue: roundMoney(ready.reduce((s, r) => s + (r.quantity || 0) * (r.orderPrice || 0), 0)),
    },
    rows: previewRows.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0)),
  };
}

/**
 * Confirm import: create/update products, FIFO layers, movements, WAC fields.
 */
export async function confirmBasicStockImport({
  tenantId,
  userId,
  buffer,
  fileName = null,
  purpose = 'STOCK_RECEIPT_IMPORT',
  updateSellingPrice = true,
  forceAsNewReceipt = false,
  db = prisma,
}) {
  const preview = await previewBasicStockImport({
    tenantId,
    userId,
    buffer,
    fileName,
    purpose,
    updateSellingPrice,
    forceAsNewReceipt,
    db,
  });

  if (preview.duplicateFileWarning && !forceAsNewReceipt) {
    throw Object.assign(
      new Error('This file was already imported for this Business. Confirm with forceAsNewReceipt to post as a new receipt.'),
      { code: 'DUPLICATE_STOCK_IMPORT', previousImport: preview.previousImport }
    );
  }

  const blocked = preview.rows.filter((r) => r.status === 'BLOCKED' || r.status === 'INVALID');
  if (blocked.length) {
    throw Object.assign(new Error('Import contains blocked or invalid rows. Fix them before confirm.'), {
      code: 'IMPORT_BLOCKED',
      rows: blocked,
    });
  }

  const ready = preview.rows.filter((r) => r.matchStatus === 'NEW' || r.matchStatus === 'MATCHED');
  if (!ready.length) {
    throw Object.assign(new Error('No valid rows to import.'), { code: 'NO_VALID_ROWS' });
  }

  const branchId = await resolveHiddenPrimaryBranchId(tenantId, db);

  return db.$transaction(async (tx) => {
    let batch;
    if (preview.previousImport && forceAsNewReceipt) {
      // New identity suffix so unique (tenant, hash, purpose) can coexist via purpose bump
      batch = await tx.stockImportBatch.create({
        data: {
          tenantId,
          fileHash: `${preview.fileHash}:r${Date.now()}`,
          fileName,
          purpose,
          status: 'PROCESSING',
          updateSellingPrice,
          forceAsNewReceipt: true,
          rowCount: ready.length,
          createdById: userId,
          confirmedAt: new Date(),
        },
      });
    } else if (preview.previousImport?.status === 'COMPLETED' || preview.previousImport?.status === 'COMPLETED_WITH_WARNINGS') {
      return {
        idempotent: true,
        batchId: preview.previousImport.id,
        summary: preview.summary,
      };
    } else {
      batch = await tx.stockImportBatch.upsert({
        where: {
          tenantId_fileHash_purpose: {
            tenantId,
            fileHash: preview.fileHash,
            purpose,
          },
        },
        create: {
          tenantId,
          fileHash: preview.fileHash,
          fileName,
          purpose,
          status: 'PROCESSING',
          updateSellingPrice,
          forceAsNewReceipt,
          rowCount: ready.length,
          createdById: userId,
          confirmedAt: new Date(),
        },
        update: {
          status: 'PROCESSING',
          updateSellingPrice,
          forceAsNewReceipt,
          rowCount: ready.length,
          confirmedAt: new Date(),
          fileName,
        },
      });
    }

    const results = [];
    for (const row of ready) {
      const sourceId = `${batch.id}:${row.normalizedName}`;
      let productId = row.productId;

      if (row.matchStatus === 'NEW') {
        const created = await tx.product.create({
          data: {
            tenantId,
            branchId,
            name: row.itemName,
            normalizedName: row.normalizedName,
            sku: null,
            price: new Prisma.Decimal(row.sellingPrice),
            cost: new Prisma.Decimal(row.orderPrice),
            averageCost: new Prisma.Decimal(row.orderPrice),
            stockLevel: new Prisma.Decimal(0),
            totalStockValue: new Prisma.Decimal(0),
            category: 'Uncategorized',
            isService: false,
            isDeleted: false,
          },
        });
        productId = created.id;
      } else {
        await tx.product.update({
          where: { id: productId },
          data: {
            normalizedName: row.normalizedName,
            ...(updateSellingPrice ? { price: new Prisma.Decimal(row.sellingPrice) } : {}),
          },
        });
      }

      const fifo = await createFifoBatch({
        tenantId,
        branchId,
        productId,
        quantityPurchased: row.quantity,
        unitCost: row.orderPrice,
        purchaseDate: new Date(),
        sourceType: 'StockImport',
        sourceId,
        expiryDate: null,
        tx,
      });

      const productAfter = await tx.product.findFirst({
        where: { id: productId, tenantId },
        select: { stockLevel: true, totalStockValue: true },
      });
      const qtyAfter = toNum(productAfter?.stockLevel);
      const valueAfter = toNum(productAfter?.totalStockValue);
      const wacAfter = qtyAfter > 0 ? roundMoney(valueAfter / qtyAfter) : row.orderPrice;

      await tx.product.update({
        where: { id: productId },
        data: { averageCost: new Prisma.Decimal(wacAfter) },
      });

      const movement = await tx.inventoryTransaction.create({
        data: {
          tenantId,
          branchId,
          productId,
          userId,
          type: 'import_receipt',
          quantity: new Prisma.Decimal(row.quantity),
          notes: `Basic stock import ${batch.id} (${purpose})`,
        },
      });

      await tx.stockImportRow.create({
        data: {
          batchId: batch.id,
          tenantId,
          rowNumber: row.rowNumber || results.length + 1,
          itemName: row.itemName,
          normalizedName: row.normalizedName,
          quantity: new Prisma.Decimal(row.quantity),
          orderPrice: new Prisma.Decimal(row.orderPrice),
          sellingPrice: new Prisma.Decimal(row.sellingPrice),
          matchStatus: row.matchStatus,
          productId,
          status: 'POSTED',
          quantityBefore: row.quantityBefore != null ? new Prisma.Decimal(row.quantityBefore) : null,
          quantityAfter: new Prisma.Decimal(qtyAfter),
          valueBefore: row.valueBefore != null ? new Prisma.Decimal(row.valueBefore) : null,
          valueAfter: new Prisma.Decimal(valueAfter),
          wacBefore: row.wacBefore != null ? new Prisma.Decimal(row.wacBefore) : null,
          wacAfter: new Prisma.Decimal(wacAfter),
          movementId: movement.id,
          batchLayerId: fifo.batchId,
        },
      });

      results.push({
        rowNumber: row.rowNumber,
        productId,
        matchStatus: row.matchStatus,
        batchLayerId: fifo.batchId,
        movementId: movement.id,
        quantityAfter: qtyAfter,
        valueAfter,
        wacAfter,
      });
    }

    const hasWarnings = preview.rows.some((r) => r.status === 'WARNING');
    await tx.stockImportBatch.update({
      where: { id: batch.id },
      data: {
        status: hasWarnings ? 'COMPLETED_WITH_WARNINGS' : 'COMPLETED',
        completedAt: new Date(),
        validCount: results.length,
        warningCount: preview.summary.warningRows,
        invalidCount: 0,
      },
    });

    return {
      idempotent: false,
      batchId: batch.id,
      purpose,
      results,
      summary: {
        ...preview.summary,
        postedItems: results.length,
      },
      accountingNote:
        'Stock quantity/value/movements posted. Inventory Import Clearing Journal via Posting Engine is the next integration slice (OPENING_STOCK / import clearing mappings).',
    };
  });
}
