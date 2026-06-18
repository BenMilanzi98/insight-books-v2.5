import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { reverseGlEntry } from '@/lib/accountingEngine/reverseGlEntry.js';
import { POSTED_TRANSACTION_STATUSES } from '@/lib/accountingEngine/constants.js';
import { addMoney } from '@/lib/money';

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
    const totalPaid = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
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

      const voidDate = new Date();
      const reversalReason = reason.trim();
      await assertPeriodOpen(user.tenantId, voidDate, tx);

      const originalTransactions = await tx.transaction.findMany({
        where: {
          tenantId: user.tenantId,
          sourceId: invoiceId,
          status: { in: POSTED_TRANSACTION_STATUSES },
          isReversal: false,
        },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      for (const origTxn of originalTransactions) {
        await reverseGlEntry({
          tenantId: user.tenantId,
          userId: user.id,
          originalTransactionId: origTxn.id,
          reason: reversalReason,
          entryDate: voidDate,
          tx,
        });
      }

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

    if (error.code === 'PERIOD_LOCKED') {
      const base = error.message || `Cannot void in closed accounting period: ${error.period?.periodName || 'unknown'}.`;
      const message = base.includes('Reopen') ? base : `${base} Reopen the period in Accounting Periods to void this invoice.`;
      return NextResponse.json(
        {
          success: false,
          error: message,
          details: { code: 'PERIOD_LOCKED', periodName: error.period?.periodName },
        },
        { status: 403 }
      );
    }

    if (error.code === 'ALREADY_REVERSED') {
      return NextResponse.json(
        { success: false, error: error.message || 'Invoice journals have already been reversed.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to void invoice. Please try again.' },
      { status: 500 }
    );
  }
}
