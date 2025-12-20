// app/api/purchases/receipts/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAverageCost } from '@/lib/inventoryCosting';
import { createPurchaseReceiptJournalEntry } from '@/lib/purchaseAccounting';

async function generateReceiptNumber(tenantId) {
  const count = await prisma.goodsReceipt.count({ where: { tenantId } });
  return `GR-${String(count + 1).padStart(5, '0')}`;
}

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

async function autoCreateBillFromReceipt({
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

  const subtotal = goodsReceipt.items.reduce(
    (sum, item) =>
      sum +
      Number(item.quantityReceived || 0) * Number(item.unitCost || 0),
    0
  );

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
        purchaseOrder: { select: { poNumber: true } },
        items: true
      }
    });

    return NextResponse.json({
      receipts,
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
  const transactionClient = prisma;
  const tx = transactionClient.$transaction ? transactionClient : prisma;

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

    validateItems(body.items);

    const supplier = await prisma.supplier.findFirst({
      where: { id: body.supplierId, tenantId: user.tenantId }
    });
    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 });
    }

    let purchaseOrder = null;
    if (body.purchaseOrderId) {
      purchaseOrder = await prisma.purchaseOrder.findFirst({
        where: { id: body.purchaseOrderId, tenantId: user.tenantId }
      });
      if (!purchaseOrder) {
        return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
      }
    }

    const receiptNumber = body.receiptNumber?.trim() || await generateReceiptNumber(user.tenantId);
    const totalAmount = body.items.reduce(
      (sum, item) => sum + Number(item.quantityReceived) * Number(item.unitCost),
      0
    );

    const result = await prisma.$transaction(async (trx) => {
      const goodsReceipt = await trx.goodsReceipt.create({
        data: {
          tenantId: user.tenantId,
          supplierId: supplier.id,
          purchaseOrderId: purchaseOrder?.id || null,
          receiptNumber,
          receiptDate: new Date(body.receiptDate),
          supplierReference: body.supplierReference || null,
          totalAmount,
          status: body.status === 'Posted' ? 'Posted' : 'Draft',
          receivedById: user.id,
          notes: body.notes || null,
          items: {
            create: body.items.map((item, index) => ({
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

      for (const item of goodsReceipt.items) {
        await updateAverageCost({
          productId: item.productId,
          tenantId: user.tenantId,
          quantityReceived: item.quantityReceived,
          unitCost: item.unitCost,
          tx: trx
        });

        await trx.inventoryTransaction.create({
          data: {
            productId: item.productId,
            tenantId: user.tenantId,
            userId: user.id,
            type: 'goods_receipt',
            quantity: Number(item.quantityReceived),
            notes: `Receipt ${goodsReceipt.receiptNumber}`
          }
        });
      }

      let journalEntryResult = null;
      if (goodsReceipt.status === 'Posted') {
        journalEntryResult = await createPurchaseReceiptJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          goodsReceiptId: goodsReceipt.id,
          supplierId: supplier.id,
          totalAmount,
          reference: goodsReceipt.receiptNumber,
          tx: trx
        });

        await trx.goodsReceipt.update({
          where: { id: goodsReceipt.id },
          data: {
            status: 'Posted',
            postedDate: new Date(),
            journalEntryId:
              journalEntryResult.journalEntryId || journalEntryResult.id
          }
        });
      }

      if (goodsReceipt.status === 'Posted') {
        await autoCreateBillFromReceipt({
          tx: trx,
          goodsReceipt,
          supplier,
          purchaseOrder,
          tenantId: user.tenantId,
          userId: user.id,
          journalEntryId:
            journalEntryResult?.journalEntryId || journalEntryResult?.id || null
        });
      }

      if (purchaseOrder) {
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

        await trx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: {
            status: fullyReceived ? 'Received' : partiallyReceived ? 'Partially Received' : purchaseOrder.status
          }
        });
      }

      return goodsReceipt;
    });

    return NextResponse.json({ goodsReceipt: result }, { status: 201 });
  } catch (error) {
    console.error('Error posting goods receipt:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post goods receipt.' },
      { status: 500 }
    );
  }
}

