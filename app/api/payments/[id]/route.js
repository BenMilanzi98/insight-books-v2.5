// app/api/payments/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  createPaymentReversal,
  createTransactionReversal,
  validateReversalReason
} from '@/lib/transactionReversalService';
import { updateAccountBalance } from '@/lib/core';
import {
  findInvoicePaymentJournalTransactionId,
  reverseJournalEntriesLinkedToPaymentId
} from '@/lib/financialReversalHelpers';

function normalizePaymentMethod(method) {
  const methodStr = (method ?? '').toString().trim();
  if (!methodStr) return 'cash';
  if (methodStr.includes('_')) return methodStr.toLowerCase();
  if (methodStr.length > 20 && /^[a-z0-9]+$/i.test(methodStr) && !methodStr.includes(' ')) {
    return methodStr;
  }
  return methodStr.toLowerCase().replace(/\s+/g, '_') || 'cash';
}

// Helper function to format payment data (same as in the main route.js)
const formatPaymentResponse = (payment) => {
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status,
    createdAt: payment.createdAt,
    client: payment.invoice?.client ? {
      id: payment.invoice.client.id,
      name: payment.invoice.client.name
    } : null
  };
};

// GET - Fetch a single payment by ID
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const paymentId = id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if payment exists and belongs to tenant
    const payment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    if (!payment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }
    
    // Return the payment
    return NextResponse.json(formatPaymentResponse(payment));
  } catch (error) {
    console.error(`Error fetching payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch payment. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update a payment
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const paymentId = id;
    const body = await request.json();
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if payment exists and belongs to tenant
    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          include: {
            payments: true
          }
        }
      }
    });
    
    if (!existingPayment) {
      return NextResponse.json(
        { error: 'Payment not found' },
        { status: 404 }
      );
    }

    // Completed / posted payments: no silent edits that change accounting — reverse then re-record
    const completedLike =
      String(existingPayment.status || '').toLowerCase() === 'completed' ||
      String(existingPayment.status || '').toLowerCase() === 'paid';
    if (completedLike) {
      const triesToChangeAccounting =
        body.amount !== undefined ||
        body.paymentDate !== undefined ||
        body.paymentMethod !== undefined ||
        (body.status !== undefined &&
          String(body.status).toLowerCase() !== String(existingPayment.status || '').toLowerCase());
      if (triesToChangeAccounting) {
        return NextResponse.json(
          {
            error:
              'This payment is completed and posted. You cannot change amount, date, method, or status here. Reverse the payment (with a reversal reason) and record a corrected payment so the general ledger stays aligned.'
          },
          { status: 400 }
        );
      }
    }
    
    // If changing amount, check if it exceeds invoice total
    if (body.amount !== undefined && body.amount !== existingPayment.amount) {
      const invoice = existingPayment.invoice;
      const otherPaymentsTotal = invoice.payments
        .filter(p => p.id !== paymentId)
        .reduce((sum, p) => sum + p.amount, 0);
        
      const remainingAmount = invoice.total - otherPaymentsTotal;
      
      if (body.amount > remainingAmount) {
        return NextResponse.json(
          { error: `Payment amount exceeds remaining invoice amount (${remainingAmount})` },
          { status: 400 }
        );
      }
    }
    
    // Prepare update data
    const updateData = {};
    
    // Only include fields that are provided in the request
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.paymentDate !== undefined) updateData.paymentDate = new Date(body.paymentDate);
    if (body.paymentMethod !== undefined) updateData.paymentMethod = body.paymentMethod;
    if (body.reference !== undefined) updateData.reference = body.reference;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.status !== undefined) updateData.status = body.status;
    
    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: updateData,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // If amount changed, update invoice status
    if (body.amount !== undefined && body.amount !== existingPayment.amount) {
      // Get all payments for the invoice
      const allPayments = await prisma.payment.findMany({
        where: {
          invoiceId: existingPayment.invoiceId,
          status: 'Completed'
        }
      });
      
      // Calculate total paid
      const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
      const invoice = existingPayment.invoice;
      
      let newStatus;
      if (totalPaid >= invoice.total) {
        newStatus = 'Paid';
      } else if (totalPaid > 0) {
        newStatus = 'Partial';
      } else {
        newStatus = 'Pending';
      }
      
      await prisma.invoice.update({
        where: { id: existingPayment.invoiceId },
        data: { status: newStatus }
      });
    }
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_UPDATED',
        entityType: 'PAYMENT',
        entityId: updatedPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          changes: updateData,
          invoiceNumber: updatedPayment.invoice.invoiceNumber
        })
      }
    });
    
    // Return updated payment
    return NextResponse.json({
      message: 'Payment updated successfully',
      payment: formatPaymentResponse(updatedPayment)
    });
  } catch (error) {
    console.error(`Error updating payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: 'Failed to update payment. Please try again.' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a payment via full accounting reversal (audit-safe; no hard delete)
export async function DELETE(request, { params }) {
  let paymentId;
  try {
    const { id } = await params;
    paymentId = id;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const reasonRaw = body.reversalReason || body.reason || '';
    const reasonValidation = validateReversalReason(reasonRaw);
    if (!reasonValidation.isValid) {
      return NextResponse.json(
        {
          error: reasonValidation.error,
          hint: 'Provide reversalReason (or reason) with at least 10 characters describing why this payment is removed.'
        },
        { status: 400 }
      );
    }
    const reversalReason = reasonValidation.reason;

    const existingPayment = await prisma.payment.findFirst({
      where: {
        id: paymentId,
        tenantId: user.tenantId
      },
      include: {
        invoice: true,
        allocations: {
          include: {
            paymentAccount: true
          }
        }
      }
    });

    if (!existingPayment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    if (existingPayment.isReversal || existingPayment.status === 'Reversed') {
      return NextResponse.json(
        { error: 'This payment has already been reversed or removed.' },
        { status: 400 }
      );
    }

    const payType = (existingPayment.type || (existingPayment.invoiceId ? 'invoice' : '')).toLowerCase();
    const amount = Number(existingPayment.amount || 0);

    // 1) Reverse invoice-payment journal (sourceId = invoice id, not payment id)
    if (existingPayment.invoiceId && (payType === 'invoice' || payType === '')) {
      const journalTxId = await findInvoicePaymentJournalTransactionId({
        tenantId: user.tenantId,
        invoiceId: existingPayment.invoiceId,
        paymentAmount: amount,
        paymentDate: existingPayment.paymentDate,
        paymentCreatedAt: existingPayment.createdAt
      });
      if (journalTxId) {
        const alreadyRev = await prisma.transaction.findFirst({
          where: { tenantId: user.tenantId, isReversal: true, reversedTransactionId: journalTxId },
          select: { id: true }
        });
        if (!alreadyRev) {
          await createTransactionReversal({
            transactionId: journalTxId,
            reversalReason,
            userId: user.id,
            tenantId: user.tenantId
          });
        }
      }
    }

    // 2) Reverse journals posted with sourceId = paymentId
    await reverseJournalEntriesLinkedToPaymentId({
      tenantId: user.tenantId,
      userId: user.id,
      paymentId,
      reversalReason
    });

    // 3) Reverse payment-account balance impacts (mirror POST)
    if (existingPayment.allocations?.length > 0) {
      for (const alloc of existingPayment.allocations) {
        const account = alloc.paymentAccount;
        if (!account) continue;
        const normalizedMethod = normalizePaymentMethod(account.name);
        if (payType === 'expense') {
          await updateAccountBalance(user.tenantId, normalizedMethod, Number(alloc.amount || 0), 'add');
        } else if (payType === 'invoice' || payType === 'sale' || payType === '') {
          await updateAccountBalance(user.tenantId, normalizedMethod, Number(alloc.amount || 0), 'subtract');
        }
      }
    } else if (payType === 'invoice' || payType === 'sale' || payType === '') {
      const normalizedMethod = normalizePaymentMethod(existingPayment.paymentMethod);
      await updateAccountBalance(user.tenantId, normalizedMethod, amount, 'subtract');
    } else if (payType === 'expense') {
      const normalizedSource = normalizePaymentMethod(existingPayment.sourceAccount || existingPayment.paymentMethod);
      await updateAccountBalance(user.tenantId, normalizedSource, amount, 'add');
    } else if (payType === 'transfer') {
      const normalizedSource = normalizePaymentMethod(existingPayment.sourceAccount);
      const normalizedDestination = normalizePaymentMethod(existingPayment.destinationAccount);
      await updateAccountBalance(user.tenantId, normalizedSource, amount, 'add');
      await updateAccountBalance(user.tenantId, normalizedDestination, amount, 'subtract');
    } else if (payType === 'adjustment') {
      const normalizedMethod = normalizePaymentMethod(existingPayment.paymentMethod);
      await updateAccountBalance(user.tenantId, normalizedMethod, amount, 'subtract');
    }

    // 4) Payment row: reversal pair (original marked Reversed) — not hard-deleted
    await createPaymentReversal({
      paymentId,
      reversalReason,
      userId: user.id,
      tenantId: user.tenantId
    });

    // 5) Recalculate invoice balances from active completed payments
    if (existingPayment.invoiceId && existingPayment.invoice) {
      const activePayments = await prisma.payment.findMany({
        where: {
          invoiceId: existingPayment.invoiceId,
          tenantId: user.tenantId,
          status: 'Completed',
          isReversal: false
        }
      });
      const totalPaid = activePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const inv = existingPayment.invoice;
      const remainingBalance = Math.max(0, Number(inv.total || 0) - totalPaid);
      let newStatus = 'Pending';
      if (remainingBalance <= 0.01) newStatus = 'Paid';
      else if (totalPaid > 0) newStatus = 'Partial';

      const lastCompleted = activePayments.sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      )[0];

      await prisma.invoice.update({
        where: { id: existingPayment.invoiceId },
        data: {
          totalPaid,
          remainingBalance,
          status: newStatus,
          lastPaymentDate: lastCompleted ? lastCompleted.paymentDate : null
        }
      });
    }

    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_REMOVED_VIA_REVERSAL',
        entityType: 'PAYMENT',
        entityId: paymentId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          amount: existingPayment.amount,
          paymentMethod: existingPayment.paymentMethod,
          type: existingPayment.type,
          invoiceId: existingPayment.invoiceId,
          invoiceNumber: existingPayment.invoice?.invoiceNumber,
          reversalReason
        })
      }
    });

    return NextResponse.json({
      message: 'Payment reversed successfully (accounting and audit trail updated).',
      paymentId
    });
  } catch (error) {
    console.error(`Error reversing payment ${paymentId}:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to reverse payment. Please try again.' },
      { status: 500 }
    );
  }
}