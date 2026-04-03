// app/api/purchases/bills/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createTransactionReversal, validateReversalReason } from '@/lib/transactionReversalService';
import { reverseBillLinkedPaymentsInTx } from '@/lib/supplierBillCancelPayments';
import { reverseSupplierBillInventoryInTx } from '@/lib/supplierBillInventoryReversal';

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
    const amountPaidAtStart = Number(bill.amountPaid || 0);

    if (bill.status === 'Cancelled') {
      return NextResponse.json({ error: 'This bill is already cancelled.' }, { status: 400 });
    }

    let paymentReversalSummary = [];
    if (Number(bill.amountPaid || 0) > 0) {
      await prisma.$transaction(async (tx) => {
        paymentReversalSummary = await reverseBillLinkedPaymentsInTx(tx, {
          bill,
          tenantId: user.tenantId,
          userId: user.id,
          reversalReason
        });
      });

      const refreshed = await findBill(params.id, user.tenantId);
      if (!refreshed) return NextResponse.json({ error: 'Supplier bill not found' }, { status: 404 });
      // eslint-disable-next-line no-param-reassign
      bill.amountPaid = refreshed.amountPaid;
      // eslint-disable-next-line no-param-reassign
      bill.status = refreshed.status;

      if (paymentReversalSummary.length > 0) {
        await prisma.auditLog.create({
          data: {
            action: 'SUPPLIER_BILL_PAYMENTS_UNWOUND',
            entityType: 'SUPPLIER_BILL',
            entityId: bill.id,
            userId: user.id,
            tenantId: user.tenantId,
            details: JSON.stringify({
              billNumber: bill.billNumber,
              amountPaidAtStart,
              paymentReversalSummary,
              reversalReason
            })
          }
        });
      }
    }

    let inventoryReversalStats = {
      batchCount: 0,
      consumptionsRemoved: 0,
      affectedProductIds: []
    };

    if (bill.journalEntryId) {
      // bill.journalEntryId may point to a Transaction or a JournalEntry depending on
      // which code path created the bill. Try Transaction first (current creation path),
      // then fall back to JournalEntry-based reversal, then skip if neither found.
      const linkedTransaction = await prisma.transaction.findFirst({
        where: { id: bill.journalEntryId, tenantId: user.tenantId },
        select: { id: true }
      });

      if (linkedTransaction) {
        const alreadyReversed = await prisma.transaction.findFirst({
          where: {
            tenantId: user.tenantId,
            isReversal: true,
            reversedTransactionId: linkedTransaction.id
          },
          select: { id: true }
        });
        if (!alreadyReversed) {
          await createTransactionReversal({
            transactionId: linkedTransaction.id,
            reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
            userId: user.id,
            tenantId: user.tenantId
          });
        }
      } else {
        // journalEntryId might reference a JournalEntry record instead of a Transaction.
        // Look up the JournalEntry and reverse via its linked transactionId if available.
        const journalEntry = await prisma.journalEntry.findFirst({
          where: { id: bill.journalEntryId, tenantId: user.tenantId },
          select: { id: true, transactionId: true }
        });

        if (journalEntry?.transactionId) {
          const alreadyReversed = await prisma.transaction.findFirst({
            where: {
              tenantId: user.tenantId,
              isReversal: true,
              reversedTransactionId: journalEntry.transactionId
            },
            select: { id: true }
          });
          if (!alreadyReversed) {
            await createTransactionReversal({
              transactionId: journalEntry.transactionId,
              reversalReason: `${reversalReason} (Bill ${bill.billNumber || bill.id})`,
              userId: user.id,
              tenantId: user.tenantId
            });
          }
        } else {
          console.warn(
            `[Bill Reversal] No Transaction found for bill ${bill.id} journalEntryId=${bill.journalEntryId}. ` +
            `Proceeding with cancellation without accounting reversal.`
          );
        }
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

      const inv = await reverseSupplierBillInventoryInTx(tx, {
        bill,
        tenantId: user.tenantId
      });
      inventoryReversalStats = {
        batchCount: inv.batchCount,
        consumptionsRemoved: inv.consumptionsRemoved,
        affectedProductIds: inv.affectedProductIds || []
      };

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
            amountPaidBeforeCancel: amountPaidAtStart,
            hadJournal: Boolean(bill.journalEntryId),
            inventoryReversal: inventoryReversalStats,
            paymentReversalSummary,
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

