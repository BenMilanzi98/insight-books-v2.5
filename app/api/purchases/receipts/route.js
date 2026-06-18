// app/api/purchases/receipts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createBillFromApprovedServicePO } from '@/lib/purchaseOrderToBill';
import { applyGoodsReceiptInventoryPosting } from '@/lib/applyGoodsReceiptInventoryPosting';
import { syncAssetsFromAssetReceipt } from '@/lib/goodsReceiptFollowOn';
import {
  assertReceiptDateOnOrAfterPurchaseOrder,
  isReceiptDateStrictlyAfterTodayUTC,
} from '@/lib/goodsReceiptDateUtils';
import { allocateNextGRNumberReliable, formatGrNumber } from '@/lib/documentSequences';
import { receiptUnitCostFromPurchaseOrderLine } from '@/lib/receiptUnitCostFromPoLine';
import {
  sumPostedGoodsReceiptQtyByPoLineIds,
  goodsLineRemainingQty,
} from '@/lib/poLineReceivedFromReceipts';
import { normalizeExpiryAllocations } from '@/lib/expiryAllocations';

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Receipt items are required');
  }
  items.forEach((item, index) => {
    if (!item.productId) throw new Error(`Item ${index + 1}: productId is required`);
    if (item.quantityReceived === undefined || Number(item.quantityReceived) <= 0) {
      throw new Error(`Item ${index + 1}: quantityReceived must be greater than zero`);
    }
    const uc = Number(item.unitCost);
    if (item.unitCost === undefined || !Number.isFinite(uc) || uc < 0) {
      throw new Error(`Item ${index + 1}: unitCost must be a valid non-negative number`);
    }
  });
}

function toIsoDateOnly(dateValue) {
  if (!dateValue) return null;
  const dt = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().split('T')[0];
}

function normalizeReceiptExpiryAllocations(items, perishableByProductId) {
  return items.map((item) => {
    const quantityReceived = Number(item.quantityReceived);
    const unitCost = Number(item.unitCost);
    const productIsPerishable = Boolean(
      perishableByProductId.get(item.productId) ?? item.isPerishable
    );
    const normalizedAllocations = normalizeExpiryAllocations({
      expiryAllocations: item.expiryAllocations,
      isPerishable: productIsPerishable,
      fallbackExpiryDate: item.expiryDate || null,
      targetQty: quantityReceived,
      fallbackUnitCost: unitCost,
    });
    const allocationPayload = normalizedAllocations.map((row) => ({
      qty: Number(row.qty || 0),
      unitCost: Number(row.unitCost || 0),
      expiryDate: row.expiryDate ? toIsoDateOnly(row.expiryDate) : null,
    }));

    let legacyExpiryDate = null;
    if (allocationPayload.length === 1 && allocationPayload[0]?.expiryDate) {
      legacyExpiryDate = allocationPayload[0].expiryDate;
    } else if (item.expiryDate) {
      legacyExpiryDate = toIsoDateOnly(item.expiryDate);
    }

    return {
      ...item,
      isPerishable: productIsPerishable,
      quantityReceived,
      unitCost,
      expiryAllocations: allocationPayload,
      expiryDate: legacyExpiryDate,
    };
  });
}

/**
 * When receiving against a PO, resolve PO line id (explicit or single remaining match by product).
 */
function resolvePoLineIdForItem(purchaseOrder, item, receiptSumByPoLineId) {
  const sumMap = receiptSumByPoLineId || new Map();
  let poItemId = item.poItemId || item.purchaseOrderItemId;
  if (poItemId) return poItemId;
  if (!purchaseOrder?.items || !item.productId) return null;
  const candidates = purchaseOrder.items.filter((l) => {
    const lt = (l.lineType || 'goods').toLowerCase();
    if (lt !== 'goods' || l.productId !== item.productId) return false;
    return goodsLineRemainingQty(l, sumMap) > 0;
  });
  if (candidates.length === 1) return candidates[0].id;
  return null;
}

/**
 * Validates quantities vs PO remaining; returns items with _poItemId for create().
 */
function enrichInventoryItemsAgainstPo(purchaseOrder, items, receiptSumByPoLineId) {
  const sumMap = receiptSumByPoLineId || new Map();
  if (!purchaseOrder) {
    return items.map((item) => ({ ...item, _poItemId: item.poItemId || item.purchaseOrderItemId || null }));
  }
  return items.map((item, i) => {
    const poItemId = resolvePoLineIdForItem(purchaseOrder, item, sumMap);
    if (!poItemId) {
      throw new Error(
        `Item ${i + 1}: when receiving against a purchase order, each line must map to a PO goods line. ` +
          'Use the lines suggested from the PO, or ensure only one open line exists per product.'
      );
    }
    const poLine = purchaseOrder.items.find((l) => l.id === poItemId);
    if (!poLine) {
      throw new Error(`Item ${i + 1}: purchase order line not found.`);
    }
    const lt = (poLine.lineType || 'goods').toLowerCase();
    if (lt !== 'goods' || !poLine.productId) {
      throw new Error(`Item ${i + 1}: selected PO line is not a goods line.`);
    }
    if (poLine.productId !== item.productId) {
      throw new Error(`Item ${i + 1}: product does not match the purchase order line.`);
    }
    const remaining = goodsLineRemainingQty(poLine, sumMap);
    const qty = Number(item.quantityReceived);
    if (qty > remaining) {
      throw new Error(
        `Item ${i + 1}: cannot receive ${qty} — only ${remaining} remaining on this PO line.`
      );
    }
    const pricesIncludeTax = purchaseOrder.pricesIncludeTax === true;
    const unitCost = receiptUnitCostFromPurchaseOrderLine(poLine, pricesIncludeTax);
    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new Error(
        `Item ${i + 1}: could not determine a valid unit cost from the purchase order line (check unit cost and tax fields).`
      );
    }
    return { ...item, _poItemId: poItemId, unitCost };
  });
}

function validateServiceReceipt(body, purchaseOrder) {
  if (!purchaseOrder) {
    throw new Error('purchaseOrderId is required for service receipts');
  }
  const orderType = (purchaseOrder.orderType || 'goods').toLowerCase();
  if (orderType !== 'services' && orderType !== 'mixed') {
    throw new Error('Selected purchase order is not a services/mixed order');
  }
}

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
    const status = searchParams.get('status');
    const supplierId = searchParams.get('supplierId');
    const poId = searchParams.get('poId');

    const where = { tenantId: user.tenantId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (poId) where.purchaseOrderId = poId;

    const totalCount = await prisma.goodsReceipt.count({ where });
    const receipts = await prisma.goodsReceipt.findMany({
      where,
      orderBy: { receiptDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        purchaseOrder: { select: { poNumber: true, orderType: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      }
    });

    return NextResponse.json({
      receipts: receipts.map((receipt) => {
        const hasInventoryItems = Array.isArray(receipt.items) && receipt.items.length > 0;
        const inventoryNotApplied =
          receipt.status === 'Posted' && hasInventoryItems && !receipt.inventoryAppliedAt;
        const deferredStockPosting =
          inventoryNotApplied && isReceiptDateStrictlyAfterTodayUTC(receipt.receiptDate);
        return {
          ...receipt,
          receiptType: hasInventoryItems ? 'inventory' : 'service',
          deferredStockPosting,
          stockPostingPending: inventoryNotApplied,
        };
      }),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching goods receipts:', error);
    return NextResponse.json({ error: 'Failed to fetch goods receipts.' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const body = await request.json();
    if (!body.supplierId) {
      return NextResponse.json({ error: 'supplierId is required' }, { status: 400 });
    }
    if (!body.receiptDate) {
      return NextResponse.json({ error: 'receiptDate is required' }, { status: 400 });
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    let purchaseOrder = null;
    if (body.purchaseOrderId) {
      purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: { id: body.purchaseOrderId, tenantId: user.tenantId },
        include: { items: true }
      });
      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }
      if (String(purchaseOrder.supplierId) !== String(body.supplierId)) {
        return NextResponse.json(
          { error: 'Purchase order belongs to a different supplier than the one selected.' },
          { status: 400 }
        );
      }
    }

    const receiptType = (body.receiptType || 'inventory').toLowerCase();
    const isServiceReceipt = receiptType === 'service';

    let receiptSumByPoLineId = new Map();
    if (purchaseOrder && !isServiceReceipt) {
      const goodsIds = (purchaseOrder.items || [])
        .filter(
          (l) =>
            (l.lineType || 'goods').toLowerCase() === 'goods' && l.productId && l.id
        )
        .map((l) => l.id);
      receiptSumByPoLineId = await sumPostedGoodsReceiptQtyByPoLineIds(
        prisma,
        user.tenantId,
        goodsIds
      );
    }

    if (isServiceReceipt) {
      validateServiceReceipt(body, purchaseOrder);
    } else {
      if (body.status === 'Draft') {
        return NextResponse.json(
          {
            error:
              'Goods receipts must be posted. Inventory is updated only when the receipt is posted (not draft).',
          },
          { status: 400 }
        );
      }
      validateItems(body.items);
    }

    let inventoryItemsForCreate = null;
    if (!isServiceReceipt) {
      const inventoryProductIds = [...new Set((body.items || []).map((item) => item.productId).filter(Boolean))];
      const inventoryProducts = await prisma.product.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: inventoryProductIds },
          isDeleted: false,
        },
        select: {
          id: true,
          isPerishable: true,
        },
      });
      const productPerishableMap = new Map(
        inventoryProducts.map((p) => [p.id, Boolean(p.isPerishable)])
      );
      const missingProductIds = inventoryProductIds.filter((id) => !productPerishableMap.has(id));
      if (missingProductIds.length > 0) {
        return NextResponse.json(
          { error: `One or more products were not found: ${missingProductIds.join(', ')}` },
          { status: 400 }
        );
      }

      let normalizedInputItems;
      try {
        normalizedInputItems = normalizeReceiptExpiryAllocations(
          body.items,
          productPerishableMap
        );
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }

      try {
        inventoryItemsForCreate = enrichInventoryItemsAgainstPo(
          purchaseOrder,
          normalizedInputItems,
          receiptSumByPoLineId
        );
      } catch (e) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
    }

    const totalAmount = isServiceReceipt
      ? (purchaseOrder?.items || [])
          .filter((line) => (line.lineType || 'goods') === 'service')
          .reduce((sum, line) => {
            const subtotal = Number(line.quantityOrdered || 0) * Number(line.unitCost || 0);
            const tax = Number(line.taxAmount || 0);
            return sum + subtotal + tax;
          }, 0)
      : inventoryItemsForCreate.reduce(
          (sum, item) => sum + Number(item.quantityReceived) * Number(item.unitCost),
          0
        );

    if (
      !isServiceReceipt &&
      (!Number.isFinite(totalAmount) || totalAmount < 0)
    ) {
      return NextResponse.json(
        { error: 'Invalid receipt total; check line quantities and unit costs.' },
        { status: 400 }
      );
    }

    const parsedReceiptDate = new Date(body.receiptDate);
    if (Number.isNaN(parsedReceiptDate.getTime())) {
      return NextResponse.json({ error: 'Invalid receiptDate' }, { status: 400 });
    }
    try {
      assertReceiptDateOnOrAfterPurchaseOrder(parsedReceiptDate, purchaseOrder);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const receiptIsPosted = isServiceReceipt ? body.status === 'Posted' : true;

    const deferInventoryPosting =
      receiptIsPosted &&
      !isServiceReceipt &&
      isReceiptDateStrictlyAfterTodayUTC(parsedReceiptDate);

    // Function to create goods receipt with unique receipt number handling
    const createGoodsReceipt = async (trx, receiptNumber) => {
      return await trx.goodsReceipt.create({
        data: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          purchaseOrderId: purchaseOrder?.id || null,
          receiptNumber,
          receiptDate: parsedReceiptDate,
          supplierReference: body.supplierReference || null,
          totalAmount,
          status: receiptIsPosted ? 'Posted' : 'Draft',
          postedDate: receiptIsPosted ? new Date() : null,
          receivedById: user.id,
          notes: isServiceReceipt
            ? (body.notes || `Service receipt for PO ${purchaseOrder?.poNumber || ''}`.trim())
            : (body.notes || null),
          items: {
            create: isServiceReceipt
              ? []
              : inventoryItemsForCreate.map((item, index) => ({
                  lineNumber: index + 1,
                  productId: item.productId,
                  purchaseOrderItemId: item._poItemId || item.poItemId || item.purchaseOrderItemId || null,
                  quantityReceived: new Prisma.Decimal(
                    String(Math.max(0, Number(item.quantityReceived)))
                  ),
                  unitCost: new Prisma.Decimal(String(Math.max(0, Number(item.unitCost)))),
                  batchNumber: item.batchNumber || null,
                  expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
                  expiryAllocations:
                    Array.isArray(item.expiryAllocations) && item.expiryAllocations.length > 0
                      ? item.expiryAllocations
                      : null,
                  notes: item.notes || null,
                })),
          },
        },
        include: { items: true },
      });
    };

    let receiptNumber = body.receiptNumber?.trim() || null;
    if (receiptNumber) {
      const dup = await prisma.goodsReceipt.findFirst({
        where: { tenantId: user.tenantId, receiptNumber },
      });
      if (dup) {
        return NextResponse.json(
          { error: 'Receipt number already exists for this business.' },
          { status: 409 }
        );
      }
    }

    const result = await prisma.$transaction(async (trx) => {
      if (!receiptNumber) {
        const n = await allocateNextGRNumberReliable(trx, user.tenantId);
        receiptNumber = formatGrNumber(n);
      }

      const goodsReceipt = await createGoodsReceipt(trx, receiptNumber);

      // Posted inventory receipts: apply stock/GL/bill immediately unless receipt date is in the future (UTC calendar day).
      if (!isServiceReceipt && receiptIsPosted && !deferInventoryPosting) {
        await applyGoodsReceiptInventoryPosting(trx, {
          goodsReceipt,
          tenantId: user.tenantId,
          userId: user.id,
          actingUser: user,
          supplier,
          purchaseOrder,
          totalAmount,
          requestBranchId: body.branchId ?? null,
        });
      }

      if (purchaseOrder) {
        if (isServiceReceipt) {
          // Service receipts do not touch inventory quantities.
          // A posted service receipt confirms delivery/completion of service work.
          const updatedPo = await trx.purchaseOrder.update({
            where: { id: purchaseOrder.id },
            data: {
              status: goodsReceipt.status === 'Posted' ? 'Received' : purchaseOrder.status
            }
          });

          if (updatedPo.status === 'Received' && (updatedPo.orderType === 'services' || updatedPo.orderType === 'mixed')) {
            await createBillFromApprovedServicePO(updatedPo.id, user.tenantId, user.id, trx);
          }

          return goodsReceipt;
        }

        const poItems = await trx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: purchaseOrder.id },
        });
        const goodsLineIds = poItems
          .filter(
            (row) =>
              (row.lineType || 'goods').toLowerCase() === 'goods' && row.productId
          )
          .map((row) => row.id);
        const sumsAfterReceipt = await sumPostedGoodsReceiptQtyByPoLineIds(
          trx,
          user.tenantId,
          goodsLineIds
        );
        await Promise.all(
          poItems.map((row) => {
            const lt = (row.lineType || 'goods').toLowerCase();
            if (lt !== 'goods' || !row.productId) return Promise.resolve();
            const sum = sumsAfterReceipt.get(row.id) || 0;
            return trx.purchaseOrderItem.update({
              where: { id: row.id },
              data: {
                quantityReceived: new Prisma.Decimal(String(sum)),
              },
            });
          })
        );

        const poItemsUpdated = await trx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: purchaseOrder.id }
        });
        const fullyReceived = poItemsUpdated.every(
          item => Number(item.quantityReceived) >= Number(item.quantityOrdered)
        );
        const partiallyReceived = poItemsUpdated.some(
          item => Number(item.quantityReceived) > 0 && Number(item.quantityReceived) < Number(item.quantityOrdered)
        );

        const updatedPo = await trx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: {
            status: fullyReceived ? 'Received' : partiallyReceived ? 'Partially Received' : purchaseOrder.status
          }
        });

        // Service/mixed PO payables should be created only after receipt confirmation.
        if (updatedPo.status === 'Received' && (updatedPo.orderType === 'services' || updatedPo.orderType === 'mixed')) {
          await createBillFromApprovedServicePO(updatedPo.id, user.tenantId, user.id, trx);
        }

        if (
          updatedPo.status === 'Received' &&
          updatedPo.orderType === 'assets' &&
          !deferInventoryPosting
        ) {
          await syncAssetsFromAssetReceipt({
            tx: trx,
            goodsReceipt,
            purchaseOrder: updatedPo,
            tenantId: user.tenantId,
            userId: user.id,
            supplierName: supplier.supplierName || supplier.name || null
          });
        }
      }

      await trx.auditLog.create({
        data: {
          action: goodsReceipt.status === 'Posted' ? 'GOODS_RECEIPT_POSTED' : 'GOODS_RECEIPT_CREATED',
          entityType: 'GOODS_RECEIPT',
          entityId: goodsReceipt.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            receiptNumber: goodsReceipt.receiptNumber,
            supplierId: supplier.id,
            purchaseOrderId: purchaseOrder?.id || null,
            totalAmount,
            status: goodsReceipt.status,
            itemCount: goodsReceipt.items?.length || 0,
            inventoryApplied: Boolean(goodsReceipt.inventoryAppliedAt),
          }),
        },
      });

      return goodsReceipt;
    });

    const goodsReceiptOut = await prisma.goodsReceipt.findFirst({
      where: { id: result.id, tenantId: user.tenantId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        supplier: { select: { supplierName: true, supplierCode: true } },
        purchaseOrder: { select: { poNumber: true, orderType: true } },
        receivedBy: { select: { name: true } },
      },
    });

    const hasInventoryItems =
      Array.isArray(goodsReceiptOut?.items) && goodsReceiptOut.items.length > 0;
    const inventoryNotApplied =
      goodsReceiptOut?.status === 'Posted' && hasInventoryItems && !goodsReceiptOut.inventoryAppliedAt;
    const responsePayload = goodsReceiptOut
      ? {
          ...goodsReceiptOut,
          receiptType: hasInventoryItems ? 'inventory' : 'service',
          deferredStockPosting:
            inventoryNotApplied && isReceiptDateStrictlyAfterTodayUTC(goodsReceiptOut.receiptDate),
          stockPostingPending: inventoryNotApplied,
        }
      : result;

    return NextResponse.json({ goodsReceipt: responsePayload }, { status: 201 });
  } catch (error) {
    console.error('Error posting goods receipt:', error);
    if (error.code === 'P2002' && String(error.meta?.target || '').includes('receiptNumber')) {
      return NextResponse.json(
        { error: 'Receipt number already exists for this business.' },
        { status: 409 }
      );
    }

    const msg = String(error?.message || 'Failed to post goods receipt.');
    const code = error?.code;

    if (code === 'PERIOD_LOCKED' || /accounting period|period is (locked|closed)/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (
      /inventory or accounts payable|chart of accounts|accounts payable.*not found|inventory.*not found/i.test(
        msg
      )
    ) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    if (/no branch access|do not have access to this branch|invalid or inactive branch/i.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

