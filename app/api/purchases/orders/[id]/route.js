// app/api/purchases/orders/[id]/route.js
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

const PO_STATUSES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'];

async function getPurchaseOrder(id, tenantId) {
  return prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      items: true,
      receipts: {
        select: { id: true, receiptNumber: true, receiptDate: true, totalAmount: true }
      }
    }
  });
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    return NextResponse.json({ purchaseOrder });
  } catch (error) {
    console.error('Error fetching purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase order.' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const lockedStatuses = ['Received', 'Cancelled'];
    if (lockedStatuses.includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Cannot modify a purchase order that is already approved or beyond.' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const data = {
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : purchaseOrder.expectedDeliveryDate,
      deliveryAddress: body.deliveryAddress ?? purchaseOrder.deliveryAddress,
      paymentTerms: body.paymentTerms ?? purchaseOrder.paymentTerms,
      currency: body.currency ?? purchaseOrder.currency,
      notes: body.notes ?? purchaseOrder.notes,
      termsAndConditions: body.termsAndConditions ?? purchaseOrder.termsAndConditions
    };

    if (body.status && PO_STATUSES.includes(body.status)) {
      data.status = body.status;
      if (body.status === 'Approved') {
        data.approvedById = user.id;
        data.approvedDate = new Date();
      }
    }

    let subtotal = purchaseOrder.subtotal;
    if (body.items) {
      // Recalculate items
      subtotal = body.items.reduce(
        (sum, item) => sum + Number(item.quantityOrdered) * Number(item.unitCost),
        0
      );
      data.items = {
        deleteMany: { purchaseOrderId: purchaseOrder.id },
        create: body.items.map((item, index) => ({
          lineNumber: index + 1,
          productId: item.productId,
          description: item.description || null,
          quantityOrdered: new Prisma.Decimal(item.quantityOrdered ?? 0),
          unitCost: new Prisma.Decimal(item.unitCost ?? 0),
          taxRate: item.taxRate ?? 0,
          taxAmount: item.taxAmount ?? 0
        }))
      };
    }

    if (body.taxRate !== undefined) data.taxRate = body.taxRate;

    const taxRate = data.taxRate ?? purchaseOrder.taxRate ?? 0;
    const taxAmount = subtotal * (taxRate / 100);

    data.subtotal = subtotal;
    data.taxAmount = taxAmount;
    data.totalAmount = subtotal + taxAmount;

    const updated = await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        items: true
      }
    });

    return NextResponse.json({ purchaseOrder: updated });
  } catch (error) {
    console.error('Error updating purchase order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update purchase order.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const purchaseOrder = await getPurchaseOrder(params.id, user.tenantId);
    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
    }

    const lockedStatuses = ['Received', 'Cancelled'];
    if (lockedStatuses.includes(purchaseOrder.status)) {
      return NextResponse.json(
        { error: 'Received or cancelled purchase orders cannot be deleted.' },
        { status: 400 }
      );
    }

    await prisma.purchaseOrder.delete({
      where: { id: purchaseOrder.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting purchase order:', error);
    return NextResponse.json(
      { error: 'Failed to delete purchase order.' },
      { status: 500 }
    );
  }
}

