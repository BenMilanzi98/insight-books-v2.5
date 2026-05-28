import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addMoney, parseMoney } from '@/lib/money';

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
    const { refundId, status, transactionId, processingNotes, failureReason } = body;

    if (!refundId) {
      return NextResponse.json(
        { success: false, error: 'Refund ID is required' },
        { status: 400 }
      );
    }

    if (!status || !['processing', 'completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Valid status is required (processing, completed, or failed)' },
        { status: 400 }
      );
    }

    // Find the refund
    const refund = await prisma.invoiceRefund.findFirst({
      where: {
        id: refundId,
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          select: { 
            id: true, 
            invoiceNumber: true, 
            client: { select: { name: true } },
            total: true,
            refundAmount: true
          }
        }
      }
    });

    if (!refund) {
      return NextResponse.json(
        { success: false, error: 'Refund not found' },
        { status: 404 }
      );
    }

    // Check if refund can be processed
    if (refund.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Refund is already completed' },
        { status: 400 }
      );
    }

    if (refund.status === 'failed' && status === 'processing') {
      return NextResponse.json(
        { success: false, error: 'Cannot reprocess a failed refund' },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Update refund status
      const updatedRefund = await tx.invoiceRefund.update({
        where: { id: refundId },
        data: {
          status: status,
          processedAt: status === 'completed' || status === 'failed' ? new Date() : null,
          transactionId: transactionId?.trim() || null,
          processingNotes: processingNotes?.trim() || null,
          failureReason: status === 'failed' ? failureReason?.trim() : null,
          updatedAt: new Date()
        }
      });

      // If refund is completed, update invoice status
      if (status === 'completed') {
        const invoice = await tx.invoice.findUnique({
          where: { id: refund.invoiceId },
          include: { refunds: true }
        });

        if (invoice) {
          const totalRefunded = invoice.refunds
            .filter(r => r.status === 'completed')
            .reduce((sum, r) => addMoney(sum, r.refundAmount), 0);
          
          const totalPaid = await tx.payment.aggregate({
            where: { 
              invoiceId: refund.invoiceId, 
              status: 'Completed' 
            },
            _sum: { amount: true }
          });

          const paidAmount = parseMoney(totalPaid._sum.amount);
          let newStatus = invoice.status;

          if (totalRefunded >= paidAmount) {
            newStatus = 'refunded';
          } else if (totalRefunded > 0) {
            newStatus = 'partially_refunded';
          }

          await tx.invoice.update({
            where: { id: refund.invoiceId },
            data: { 
              status: newStatus,
              updatedAt: new Date()
            }
          });
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'REFUND_STATUS_UPDATE',
          entityType: 'INVOICE_REFUND',
          entityId: refundId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: refund.invoice.invoiceNumber,
            clientName: refund.invoice.client.name,
            refundAmount: refund.refundAmount,
            oldStatus: refund.status,
            newStatus: status,
            transactionId: transactionId,
            processingNotes: processingNotes,
            failureReason: failureReason,
            processedBy: user.email
          }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date()
        }
      });

      return updatedRefund;
    });

    return NextResponse.json({
      success: true,
      message: `Refund ${status} successfully`,
      data: {
        refund: {
          id: result.id,
          status: result.status,
          processedAt: result.processedAt,
          transactionId: result.transactionId,
          processingNotes: result.processingNotes
        }
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
