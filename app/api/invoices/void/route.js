import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

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
    const { invoiceId, reason } = body;

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!reason || reason.trim().length < 3) {
      return NextResponse.json(
        { success: false, error: 'Void reason is required (minimum 3 characters)' },
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
          where: { status: 'Completed' }
        }
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice can be voided
    if (invoice.status === 'void') {
      return NextResponse.json(
        { success: false, error: 'Invoice is already voided' },
        { status: 400 }
      );
    }

    if (invoice.status === 'refunded' || invoice.status === 'partially_refunded') {
      return NextResponse.json(
        { success: false, error: 'Cannot void a refunded invoice' },
        { status: 400 }
      );
    }

    // Check if there are completed payments
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (totalPaid > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot void invoice with payments. Process refund instead.' },
        { status: 400 }
      );
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Store original total before voiding
      const originalTotal = invoice.total;

      // Update invoice status
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'void',
          voidedAt: new Date(),
          voidedById: user.id,
          voidReason: reason.trim(),
          originalTotal: originalTotal,
          updatedAt: new Date()
        }
      });

      // Create audit log
      await tx.auditLog.create({
        data: {
          action: 'INVOICE_VOID',
          entityType: 'INVOICE',
          entityId: invoiceId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            invoiceNumber: invoice.invoiceNumber,
            clientName: invoice.client.name,
            originalTotal: originalTotal,
            voidReason: reason.trim(),
            voidedBy: user.email
          }),
          ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          timestamp: new Date()
        }
      });

      return updatedInvoice;
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice voided successfully',
      invoice: {
        id: result.id,
        invoiceNumber: result.invoiceNumber,
        status: result.status,
        voidedAt: result.voidedAt,
        voidReason: result.voidReason
      }
    });

  } catch (error) {
    console.error('Error voiding invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to void invoice. Please try again.' },
      { status: 500 }
    );
  }
}
