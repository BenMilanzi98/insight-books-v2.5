// app/api/purchases/bills/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

const BILL_STATUSES = ['Draft', 'Approved', 'Unpaid', 'Partially Paid', 'Paid', 'Overdue', 'Cancelled'];

async function findBill(id, tenantId) {
  const bill = await prisma.supplierBill.findFirst({
    where: { id, tenantId },
    include: {
      supplier: { select: { supplierName: true, supplierCode: true } },
      allocations: {
        include: {
          payment: { select: { paymentNumber: true, paymentDate: true } }
        }
      }
    }
  });

  if (!bill) return null;

  // Fetch items separately
  const items = await prisma.supplierBillItem.findMany({
    where: { billId: bill.id },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
    orderBy: { lineNumber: 'asc' }
  });

  return {
    ...bill,
    items
  };
}

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    return NextResponse.json({ bill });
  } catch (error) {
    console.error('Error fetching supplier bill:', error);
    return NextResponse.json({ error: 'Failed to fetch supplier bill.' }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    const body = await request.json();
    const data = {
      billDate: body.billDate ? new Date(body.billDate) : bill.billDate,
      dueDate: body.dueDate ? new Date(body.dueDate) : bill.dueDate,
      notes: body.notes ?? bill.notes,
      paymentTerms: body.paymentTerms ?? bill.paymentTerms,
      currency: body.currency ?? bill.currency
    };

    if (body.taxAmount !== undefined) data.taxAmount = body.taxAmount;
    if (body.subtotal !== undefined) data.subtotal = body.subtotal;
    if (body.totalAmount !== undefined) {
      data.totalAmount = body.totalAmount;
      if (body.totalAmount < bill.amountPaid) {
        return NextResponse.json(
          { error: 'Total amount cannot be less than amount already paid.' },
          { status: 400 }
        );
      }
    }
    if (body.status && BILL_STATUSES.includes(body.status)) {
      data.status = body.status;
    }

    const updated = await prisma.supplierBill.update({
      where: { id: bill.id },
      data,
      include: {
        supplier: { select: { supplierName: true, supplierCode: true } },
        allocations: {
          include: {
            payment: { select: { paymentNumber: true, paymentDate: true } }
          }
        }
      }
    });

    // Fetch items separately
    const items = await prisma.supplierBillItem.findMany({
      where: { billId: updated.id },
        include: {
          product: { select: { id: true, name: true, sku: true } }
        },
      orderBy: { lineNumber: 'asc' }
    });

    return NextResponse.json({ 
      bill: {
        ...updated,
        items
      }
    });
  } catch (error) {
    console.error('Error updating supplier bill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update supplier bill.' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const bill = await findBill(params.id, user.tenantId);
    if (!bill) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });

    if (bill.amountPaid > 0) {
      return NextResponse.json(
        { error: 'Cannot delete a bill that has payments applied.' },
        { status: 400 }
      );
    }

    await prisma.supplierBill.delete({ where: { id: bill.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting supplier bill:', error);
    return NextResponse.json(
      { error: 'Failed to delete supplier bill.' },
      { status: 500 }
    );
  }
}

