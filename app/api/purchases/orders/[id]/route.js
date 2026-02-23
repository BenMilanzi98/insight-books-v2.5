// app/api/purchases/orders/[id]/route.js
import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { syncExpensesFromPurchaseOrder } from '@/lib/purchaseOrderExpenseSync';

const PO_STATUSES = ['Draft', 'Approved', 'Sent', 'Partially Received', 'Received', 'Cancelled'];
const ORDER_TYPES = ['goods', 'services', 'mixed'];

function getLineType(item) {
  const t = (item.lineType || '').toLowerCase();
  if (t === 'service' || t === 'goods') return t;
  return item.productId ? 'goods' : 'service';
}

function validateItems(items, orderType = 'goods') {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Purchase order items are required');
  }
  items.forEach((item, idx) => {
    const lineType = getLineType(item);
    if (lineType === 'goods') {
      if (!item.productId) throw new Error(`Item ${idx + 1}: productId is required for goods lines`);
    } else {
      if (!item.description?.trim()) throw new Error(`Item ${idx + 1}: description is required for service lines`);
    }
    const qty = Number(item.quantityOrdered ?? 0);
    if (qty <= 0) throw new Error(`Item ${idx + 1}: quantityOrdered must be greater than zero`);
    if (Number(item.unitCost ?? 0) < 0) throw new Error(`Item ${idx + 1}: unitCost cannot be negative`);
  });
}

async function getPurchaseOrder(id, tenantId) {
  return prisma.purchaseOrder.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      items: {
        include: {
          expenseCategory: { select: { id: true, name: true } },
          taxType: { select: { id: true, taxName: true, taxCode: true, taxRate: true } }
        }
      },
      receipts: {
        select: { id: true, receiptNumber: true, receiptDate: true, totalAmount: true }
      },
      expenses: { select: { id: true, description: true, amount: true, date: true, status: true } }
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

    const orderType = ORDER_TYPES.includes(body.orderType) ? body.orderType : (purchaseOrder.orderType || 'goods');
    if (body.items) validateItems(body.items, orderType);

    const pricesIncludeTax = body.pricesIncludeTax !== undefined ? Boolean(body.pricesIncludeTax) : purchaseOrder.pricesIncludeTax;

    const data = {
      orderType: body.orderType !== undefined ? (ORDER_TYPES.includes(body.orderType) ? body.orderType : purchaseOrder.orderType) : purchaseOrder.orderType,
      expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : purchaseOrder.expectedDeliveryDate,
      deliveryAddress: body.deliveryAddress ?? purchaseOrder.deliveryAddress,
      paymentTerms: body.paymentTerms ?? purchaseOrder.paymentTerms,
      currency: body.currency ?? purchaseOrder.currency,
      notes: body.notes ?? purchaseOrder.notes,
      termsAndConditions: body.termsAndConditions ?? purchaseOrder.termsAndConditions,
      pricesIncludeTax,
      supplierInvoiceUrl: body.supplierInvoiceUrl !== undefined ? (body.supplierInvoiceUrl || null) : purchaseOrder.supplierInvoiceUrl
    };

    data.status = 'Approved';
    data.approvedById = user.id;
    data.approvedDate = new Date();

    let subtotal = purchaseOrder.subtotal;
    let taxAmount = purchaseOrder.taxAmount ?? 0;
    let headerTaxRate = purchaseOrder.taxRate ?? 0;

    if (body.items) {
      const taxTypeIds = [...new Set(body.items.map((it) => it.taxTypeId).filter(Boolean))];
      if (taxTypeIds.length > 0) {
        const taxTypes = await prisma.taxType.findMany({
          where: { id: { in: taxTypeIds }, tenantId: user.tenantId, status: 'Active' }
        });
        if (taxTypes.length !== taxTypeIds.length) {
          return NextResponse.json({ error: 'One or more tax types not found or inactive.' }, { status: 400 });
        }
      }
      const itemRows = body.items.map((item, index) => {
        const lineType = getLineType(item);
        const qty = Number(item.quantityOrdered ?? 0);
        const unitCost = Number(item.unitCost ?? 0);
        const taxRatePct = Number(item.taxRate ?? 0);
        let lineSubtotal;
        let lineTaxAmount = Number(item.taxAmount ?? 0);
        if (pricesIncludeTax && taxRatePct > 0) {
          const lineTotalInclusive = qty * unitCost;
          lineSubtotal = lineTotalInclusive / (1 + taxRatePct / 100);
          lineTaxAmount = lineTotalInclusive - lineSubtotal;
        } else {
          lineSubtotal = qty * unitCost;
          if (lineTaxAmount === 0 && taxRatePct > 0) {
            lineTaxAmount = lineSubtotal * (taxRatePct / 100);
          }
        }
        return {
          lineNumber: index + 1,
          lineType,
          productId: item.productId || null,
          expenseCategoryId: item.expenseCategoryId || null,
          description: item.description?.trim() || null,
          quantityOrdered: new Prisma.Decimal(qty),
          unitCost: new Prisma.Decimal(unitCost),
          taxTypeId: item.taxTypeId && String(item.taxTypeId).trim() ? item.taxTypeId : null,
          taxRate: taxRatePct,
          taxAmount: lineTaxAmount,
          _lineSubtotal: lineSubtotal
        };
      });
      subtotal = itemRows.reduce((sum, row) => sum + (row._lineSubtotal ?? Number(row.quantityOrdered) * Number(row.unitCost)), 0);
      taxAmount = itemRows.reduce((sum, row) => sum + row.taxAmount, 0);
      headerTaxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : (body.taxRate ?? 0);
      data.items = {
        deleteMany: { purchaseOrderId: purchaseOrder.id },
        create: itemRows.map((row) => ({
          lineNumber: row.lineNumber,
          lineType: row.lineType,
          productId: row.productId,
          expenseCategoryId: row.expenseCategoryId,
          description: row.description,
          quantityOrdered: row.quantityOrdered,
          unitCost: row.unitCost,
          taxTypeId: row.taxTypeId,
          taxRate: row.taxRate,
          taxAmount: row.taxAmount
        }))
      };
    }

    data.subtotal = subtotal;
    data.taxAmount = taxAmount;
    data.totalAmount = subtotal + taxAmount;
    data.taxRate = headerTaxRate;

    const updated = await prisma.purchaseOrder.update({
      where: { id: purchaseOrder.id },
      data,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        items: { include: { expenseCategory: { select: { id: true, name: true } } } },
        expenses: { select: { id: true, description: true, amount: true, date: true, status: true } }
      }
    });

    // Link approved service POs to expenses
    if ((updated.orderType === 'services' || updated.orderType === 'mixed') && updated.status === 'Approved') {
      try {
        await syncExpensesFromPurchaseOrder(updated.id, user.tenantId, user.id);
        const refetched = await getPurchaseOrder(updated.id, user.tenantId);
        if (refetched) return NextResponse.json({ purchaseOrder: refetched });
      } catch (syncErr) {
        console.error('PO expense sync after update:', syncErr);
      }
    }

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

