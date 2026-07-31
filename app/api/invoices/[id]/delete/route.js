import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { reverseSourceJournals } from '@/lib/accountingV2/application/reverseSourceJournals.js';

export async function POST(request, { params }) {
  let invoiceId;
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const resolved = await params;
    invoiceId = resolved.id;

    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        tenantId: user.tenantId
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const reasonRaw = body.reason || body.voidReason || body.reversalReason || body.deletionReason;
    const voidReason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';

    if (!voidReason || voidReason.length < 3) {
      return NextResponse.json(
        { error: 'Void reason is required (minimum 3 characters)' },
        { status: 400 }
      );
    }

    const totalPaid = Number(invoice.totalPaid || 0);
    if (totalPaid > 0) {
      return NextResponse.json(
        { error: 'Cannot remove an invoice with payments applied. Process refund instead.' },
        { status: 400 }
      );
    }

    if (invoice.status === 'void' || invoice.status === 'voided') {
      return NextResponse.json({ error: 'Invoice is already voided.' }, { status: 400 });
    }
    if (invoice.status === 'refunded' || invoice.status === 'partially_refunded') {
      return NextResponse.json(
        { error: 'Cannot void a refunded invoice' },
        { status: 400 }
      );
    }

    const voidDate = new Date();
    await assertPeriodOpen(user.tenantId, voidDate);

    // Fresh-books: reverse V2 journals only (no Transaction.create / balance mutation).
    const v2Reversal = await reverseSourceJournals({
      tenantId: user.tenantId,
      userId: user.id,
      reason: voidReason,
      sourceTypes: ['Invoice', 'Invoice-COGS'],
      sourceIds: [invoiceId],
      requireJournals: true,
      postingDate: voidDate.toISOString().slice(0, 10),
    });

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const originalTotal = invoice.total;

      const updated = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: 'void',
          voidedAt: voidDate,
          voidedById: user.id,
          voidReason: voidReason,
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
            clientId: invoice.clientId,
            originalTotal: originalTotal,
            voidReason: voidReason,
            voidedBy: user.email,
            v2JournalsReversed: v2Reversal.reversed.map((r) => r.originalJournalId),
            v2JournalsSkipped: v2Reversal.skippedAlreadyReversed,
          }),
          ipAddress:
            request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown'
        }
      });

      return updated;
    });

    return NextResponse.json({
      message: 'Invoice voided successfully',
      invoice: {
        id: updatedInvoice.id,
        invoiceNumber: invoice.invoiceNumber,
        status: updatedInvoice.status,
        voidedAt: updatedInvoice.voidedAt,
        voidReason: updatedInvoice.voidReason
      }
    });
  } catch (error) {
    console.error(`Error deleting invoice ${invoiceId}:`, error);
    if (error.code === 'NO_V2_JOURNAL_TO_REVERSE') {
      return NextResponse.json(
        {
          error: error.message || 'No posted V2 journal found to reverse for this invoice.',
          details: { code: 'NO_V2_JOURNAL_TO_REVERSE', ...(error.details || {}) },
        },
        { status: 409 }
      );
    }
    if (error.code === 'PERIOD_LOCKED') {
      return NextResponse.json(
        { error: error.message || 'Accounting period is locked.' },
        { status: 403 }
      );
    }
    return NextResponse.json(
      { error: error.message || 'Failed to delete invoice. Please try again.' },
      { status: 500 }
    );
  }
}
