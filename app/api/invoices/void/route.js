import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { reverseSourceJournals } from '@/lib/accountingV2/application/reverseSourceJournals.js';
import { addMoney } from '@/lib/money';

export async function POST(request) {
  try {
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

    const totalPaid = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
    if (totalPaid > 0) {
      return NextResponse.json(
        { success: false, error: 'Cannot void invoice with payments. Process refund instead.' },
        { status: 400 }
      );
    }

    const voidDate = new Date();
    const reversalReason = reason.trim();
    await assertPeriodOpen(user.tenantId, voidDate);

    // V2 reverse first (own posting boundary), then mark invoice void.
    const v2Reversal = await reverseSourceJournals({
      tenantId: user.tenantId,
      userId: user.id,
      reason: reversalReason,
      sourceTypes: ['Invoice', 'Invoice-COGS'],
      sourceIds: [invoiceId],
      requireJournals: true,
      postingDate: voidDate.toISOString().slice(0, 10),
    });

    const result = await prisma.$transaction(async (tx) => {
      const originalTotal = invoice.total;

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'void',
          voidedAt: voidDate,
          voidedById: user.id,
          voidReason: reversalReason,
          originalTotal: originalTotal,
          updatedAt: voidDate
        }
      });

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
            voidReason: reversalReason,
            voidedBy: user.email,
            v2JournalsReversed: v2Reversal.reversed.map((r) => r.originalJournalId),
            v2JournalsSkipped: v2Reversal.skippedAlreadyReversed,
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

    if (error.code === 'NO_V2_JOURNAL_TO_REVERSE') {
      return NextResponse.json(
        {
          success: false,
          error: error.message || 'No posted V2 journal found to reverse for this invoice.',
          details: { code: 'NO_V2_JOURNAL_TO_REVERSE', ...(error.details || {}) },
        },
        { status: 409 }
      );
    }

    if (error.code === 'ALREADY_REVERSED' || error.name === 'SourceAlreadyPostedError') {
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
