// app/api/purchases/bills/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createTransactionReversal, validateReversalReason } from '@/lib/transactionReversalService';

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

    const body = await request.json().catch(() => ({}));
    const reasonValidation = validateReversalReason(body.reversalReason || body.reason || '');
    if (!reasonValidation.isValid) {
      return NextResponse.json(
        {
          error: reasonValidation.error,
          hint: 'Provide reversalReason (or reason) with at least 10 characters. Bills are cancelled, not hard-deleted, for audit.'
        },
        { status: 400 }
      );
    }
    const reversalReason = reasonValidation.reason;

    if (bill.status === 'Cancelled') {
      return NextResponse.json({ error: 'This bill is already cancelled.' }, { status: 400 });
    }

    if (bill.amountPaid > 0) {
      return NextResponse.json(
        { error: 'Cannot cancel a bill that has payments applied. Reverse supplier payments first.' },
        { status: 400 }
      );
    }

    // Inventory safety checks: only reverse stock if FIFO batches from this bill
    // exist AND none of them have been consumed (qtyRemaining < qtyPurchased).
    // If already consumed, fully reversing requires cascading reversals of downstream sales/COGS.
    let fifoBatches = [];
    let inventoryBlockedReason = null;
    if (bill.billType === 'inventory' && !bill.goodsReceiptId) {
      fifoBatches = await prisma.inventoryBatch.findMany({
        where: {
          tenantId: user.tenantId,
          sourceType: 'SupplierBill',
          sourceId: bill.id
        },
        select: {
          id: true,
          productId: true,
          qtyPurchased: true,
          qtyRemaining: true
        }
      });

      const anyConsumed = (fifoBatches || []).some(
        (b) => Number(b.qtyRemaining || 0) < Number(b.qtyPurchased || 0)
      );

      if (anyConsumed) {
        inventoryBlockedReason =
          'Cannot cancel this inventory bill because its FIFO stock batches were already consumed (COGS generated). Reverse inventory/COGS and related sales first.';
      }
    }

    if (inventoryBlockedReason) {
      return NextResponse.json({ error: inventoryBlockedReason }, { status: 400 });
    }

    if (bill.journalEntryId) {
      const alreadyReversed = await prisma.transaction.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: bill.journalEntryId
        },
        select: { id: true }
      });
      if (!alreadyReversed) {
        await createTransactionReversal({
          transactionId: bill.journalEntryId,
          reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
          userId: user.id,
          tenantId: user.tenantId
        });
      }
    }

    await prisma.$transaction(async (tx) => {
      if (bill.supplierId) {
        await tx.supplier.update({
          where: { id: bill.supplierId },
          data: {
            currentBalance: {
              decrement: Number(bill.totalAmount || 0)
            }
          }
        });
      }

      // Reverse inventory stock effects only when safe/unconsumed.
      if (fifoBatches.length > 0) {
        const affectedProductIds = Array.from(new Set(fifoBatches.map((b) => b.productId)));
        const batchIds = fifoBatches.map((b) => b.id);

        // Remove stock batches introduced by this bill.
        await tx.inventoryBatchConsumption.deleteMany({
          where: { tenantId: user.tenantId, batchId: { in: batchIds } }
        });
        await tx.inventoryBatch.deleteMany({ where: { id: { in: batchIds } } });
        await tx.inventoryTransaction.deleteMany({
          where: {
            tenantId: user.tenantId,
            type: 'purchase',
            notes: { contains: `Purchase Bill ${bill.billNumber}`, mode: 'insensitive' }
          }
        });

        // Recompute stockLevel and stock valuation from remaining batches.
        for (const productId of affectedProductIds) {
          const remaining = await tx.inventoryBatch.findMany({
            where: { tenantId: user.tenantId, productId },
            select: { qtyRemaining: true, unitCost: true }
          });
          const newQty = remaining.reduce(
            (sum, b) => sum + Number(b.qtyRemaining || 0),
            0
          );
          const newValue = remaining.reduce(
            (sum, b) => sum + Number(b.qtyRemaining || 0) * Number(b.unitCost || 0),
            0
          );

          await tx.product.update({
            where: { id: productId },
            data: {
              stockLevel: newQty,
              totalStockValue: newValue
            }
          });
        }
      }

      await tx.supplierBill.update({
        where: { id: bill.id },
        data: {
          status: 'Cancelled',
          notes: [bill.notes, `CANCELLED (reversal): ${reversalReason}`].filter(Boolean).join('\n')
        }
      });

      await tx.auditLog.create({
        data: {
          action: 'SUPPLIER_BILL_CANCELLED_WITH_REVERSAL',
          entityType: 'SUPPLIER_BILL',
          entityId: bill.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            billNumber: bill.billNumber,
            supplierId: bill.supplierId,
            totalAmount: bill.totalAmount,
            hadJournal: Boolean(bill.journalEntryId),
            reversedInventoryBatches: fifoBatches.length > 0,
            reversalReason
          })
        }
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Supplier bill cancelled; accounting reversed where a journal was posted.',
      billId: bill.id,
      status: 'Cancelled'
    });
  } catch (error) {
    console.error('Error cancelling supplier bill:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel supplier bill.' },
      { status: 500 }
    );
  }
}

