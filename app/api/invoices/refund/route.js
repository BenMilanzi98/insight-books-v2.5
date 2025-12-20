import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';

export async function POST(request) {
  try {
    // Get authenticated user
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { invoiceId, refundAmount, refundReason, refundMethod, notes } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!refundAmount || refundAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Valid refund amount is required' },
        { status: 400 }
      );
    }

    if (!refundReason || refundReason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Refund reason is required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    if (!refundMethod) {
      return NextResponse.json(
        { success: false, error: 'Refund method is required' },
        { status: 400 }
      );
    }

    // Find the invoice
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        tenantId: user.tenantId
      },
      include: {
        client: {
          select: { name: true, email: true }
        },
        payments: {
          where: { status: 'Completed' },
          orderBy: { createdAt: 'asc' }
        },
        refunds: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice can be refunded
    if (invoice.status === 'void') {
      return NextResponse.json(
        { success: false, error: 'Cannot refund a voided invoice' },
        { status: 400 }
      );
    }

    if (invoice.status === 'draft') {
      return NextResponse.json(
        { success: false, error: 'Cannot refund a draft invoice' },
        { status: 400 }
      );
    }

    // Check if invoice has any payments
    if (invoice.payments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot refund an invoice with no payments. Please void the invoice instead.' },
        { status: 400 }
      );
    }

    // Calculate total paid and already refunded
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const totalRefunded = invoice.refunds.reduce((sum, refund) => sum + refund.refundAmount, 0);
    const availableForRefund = totalPaid - totalRefunded;

    console.log('Refund validation:', {
      invoiceId,
      invoiceStatus: invoice.status,
      totalPaid,
      totalRefunded,
      availableForRefund,
      requestedRefund: refundAmount,
      payments: invoice.payments.length,
      refunds: invoice.refunds.length
    });

    if (availableForRefund <= 0) {
      return NextResponse.json(
        { success: false, error: `No amount available for refund. Total paid: ${totalPaid}, Total refunded: ${totalRefunded}` },
        { status: 400 }
      );
    }

    if (refundAmount > availableForRefund) {
      return NextResponse.json(
        { success: false, error: `Refund amount cannot exceed available amount. Available: ${availableForRefund}, Requested: ${refundAmount}` },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Store original total if not already stored
      const originalTotal = invoice.originalTotal || invoice.total;

      // Create refund record with completed status
      const refund = await tx.invoiceRefund.create({
        data: {
          invoiceId: invoiceId,
          refundedById: user.id,
          refundAmount: refundAmount,
          refundReason: refundReason.trim(),
          refundMethod: refundMethod,
          notes: notes?.trim() || null,
          tenantId: user.tenantId,
          status: 'completed',
          processedAt: new Date()
        }
      });

      // Calculate new refund total
      const newTotalRefunded = totalRefunded + refundAmount;

      // Determine new invoice status
      let newStatus = invoice.status;
      if (newTotalRefunded >= totalPaid) {
        newStatus = 'refunded';
      } else if (newTotalRefunded > 0) {
        newStatus = 'partially_refunded';
      }

      // Update invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: newStatus,
          refundedAt: new Date(),
          refundedById: user.id,
          refundReason: refundReason.trim(),
          refundAmount: newTotalRefunded,
          originalTotal: originalTotal,
          updatedAt: new Date()
        }
      });

      // Update payment records to reflect refunds
      let remainingRefundAmount = refundAmount;
      const updatedPayments = [];

      for (const payment of invoice.payments) {
        if (remainingRefundAmount <= 0) break;

        const paymentAvailableForRefund = payment.amount - (payment.refundedAmount || 0);
        if (paymentAvailableForRefund <= 0) continue;

        const refundFromThisPayment = Math.min(remainingRefundAmount, paymentAvailableForRefund);
        const newRefundedAmount = (payment.refundedAmount || 0) + refundFromThisPayment;

        // Update payment record
        const updatedPayment = await tx.payment.update({
          where: { id: payment.id },
          data: {
            refundedAmount: newRefundedAmount,
            status: newRefundedAmount >= payment.amount ? 'Refunded' : 'Partially_Refunded',
            updatedAt: new Date()
          }
        });

        // Update account balance to reflect the refund
        await updateAccountBalance(user.tenantId, payment.paymentMethod, refundFromThisPayment, "subtract");

        updatedPayments.push(updatedPayment);
        remainingRefundAmount -= refundFromThisPayment;
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_REFUND',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.client.name,
            originalTotal: originalTotal,
            totalPaid: totalPaid,
            refundAmount: refundAmount,
            totalRefunded: newTotalRefunded,
            refundReason: refundReason.trim(),
            refundMethod: refundMethod,
            refundedBy: user.email,
            paymentsUpdated: updatedPayments.length
          }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date()
        }
      });

      return { invoice: updatedInvoice, refund, updatedPayments };
    });

    return NextResponse.json({
      success: true,
      message: 'Refund processed successfully',
      data: {
        invoice: {
          id: result.invoice.id,
          invoiceNumber: result.invoice.invoiceNumber,
          status: result.invoice.status,
          refundAmount: result.invoice.refundAmount,
          refundedAt: result.invoice.refundedAt
        },
        refund: {
          id: result.refund.id,
          amount: result.refund.refundAmount,
          reason: result.refund.refundReason,
          method: result.refund.refundMethod,
          date: result.refund.refundDate,
          status: result.refund.status
        },
        paymentsUpdated: result.updatedPayments.length
      }
    });

  } catch (error) {
    console.error('Error processing refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process refund. Please try again.' },
      { status: 500 }
    );
  }
}
