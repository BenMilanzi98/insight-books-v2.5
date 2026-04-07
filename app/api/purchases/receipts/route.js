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

function validateItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Receipt items are required');
  }
  items.forEach((item, index) => {
    if (!item.productId) throw new Error(`Item ${index + 1}: productId is required`);
    if (item.quantityReceived === undefined || Number(item.quantityReceived) <= 0) {
      throw new Error(`Item ${index + 1}: quantityReceived must be greater than zero`);
    }
    if (item.unitCost === undefined || Number(item.unitCost) < 0) {
      throw new Error(`Item ${index + 1}: unitCost cannot be negative`);
    }
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
        items: true
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
    }

    const receiptType = (body.receiptType || 'inventory').toLowerCase();
    const isServiceReceipt = receiptType === 'service';

    if (isServiceReceipt) {
      validateServiceReceipt(body, purchaseOrder);
    } else {
      validateItems(body.items);
    }

    const totalAmount = isServiceReceipt
      ? (purchaseOrder?.items || [])
          .filter((line) => (line.lineType || 'goods') === 'service')
          .reduce((sum, line) => {
            const subtotal = Number(line.quantityOrdered || 0) * Number(line.unitCost || 0);
            const tax = Number(line.taxAmount || 0);
            return sum + subtotal + tax;
          }, 0)
      : body.items.reduce(
          (sum, item) => sum + Number(item.quantityReceived) * Number(item.unitCost),
          0
        );

    const parsedReceiptDate = new Date(body.receiptDate);
    if (Number.isNaN(parsedReceiptDate.getTime())) {
      return NextResponse.json({ error: 'Invalid receiptDate' }, { status: 400 });
    }
    try {
      assertReceiptDateOnOrAfterPurchaseOrder(parsedReceiptDate, purchaseOrder);
    } catch (e) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const deferInventoryPosting =
      body.status === 'Posted' &&
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
          status: body.status === 'Posted' ? 'Posted' : 'Draft',
          postedDate: body.status === 'Posted' ? new Date() : null,
          receivedById: user.id,
          notes: isServiceReceipt
            ? (body.notes || `Service receipt for PO ${purchaseOrder?.poNumber || ''}`.trim())
            : (body.notes || null),
          items: {
            create: isServiceReceipt ? [] : body.items.map((item, index) => ({
              lineNumber: index + 1,
              productId: item.productId,
              purchaseOrderItemId: item.poItemId || null,
              quantityReceived: new Prisma.Decimal(item.quantityReceived),
              unitCost: new Prisma.Decimal(item.unitCost),
              batchNumber: item.batchNumber || null,
              expiryDate: item.expiryDate ? new Date(item.expiryDate) : null,
              notes: item.notes || null
            }))
          }
        },
        include: { items: true }
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
      if (!isServiceReceipt && goodsReceipt.status === 'Posted' && !deferInventoryPosting) {
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

        const totalReceivedMap = new Map();
        const poItems = await trx.purchaseOrderItem.findMany({
          where: { purchaseOrderId: purchaseOrder.id }
        });
        poItems.forEach(item => {
          totalReceivedMap.set(item.id, Number(item.quantityReceived || 0));
        });
        goodsReceipt.items.forEach(item => {
          if (item.purchaseOrderItemId) {
            totalReceivedMap.set(
              item.purchaseOrderItemId,
              totalReceivedMap.get(item.purchaseOrderItemId) + Number(item.quantityReceived)
            );
          }
        });

        await Promise.all(
          goodsReceipt.items.map(item => {
            if (!item.purchaseOrderItemId) return null;
            const qtyReceived = totalReceivedMap.get(item.purchaseOrderItemId);
            return trx.purchaseOrderItem.update({
              where: { id: item.purchaseOrderItemId },
              data: {
                quantityReceived: new Prisma.Decimal(qtyReceived)
              }
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

      return goodsReceipt;
    });

    const goodsReceiptOut = await prisma.goodsReceipt.findFirst({
      where: { id: result.id, tenantId: user.tenantId },
      include: {
        items: true,
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
    return NextResponse.json(
      { error: error.message || 'Failed to post goods receipt.' },
      { status: 500 }
    );
  }
}

