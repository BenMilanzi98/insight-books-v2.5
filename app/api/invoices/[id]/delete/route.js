import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateReferenceNumber } from '@/lib/journalService';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

export async function POST(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: invoiceId } = await params;
    
    // Check if invoice exists and belongs to user's tenant
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

    // Block voiding when the invoice has payments applied (refund flow is required).
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

    // Void with full audit-safe reversal (journal + tax). Keeps invoice visible.
    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const originalTotal = invoice.total;
      const voidDate = new Date();

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

      const originalTransactions = await tx.transaction.findMany({
        where: {
          tenantId: user.tenantId,
          sourceId: invoiceId,
          status: 'posted'
        },
        include: { lines: true }
      });

      await assertPeriodOpen(user.tenantId, voidDate, tx);

      for (const origTxn of originalTransactions) {
        const reversalRef = await generateReferenceNumber(tx, user.tenantId, voidDate);

        const reversedLines = (origTxn.lines || []).map((line, idx) => ({
          lineNumber: idx + 1,
          accountId: line.accountId,
          debitAmount: Number(line.creditAmount || 0),
          creditAmount: Number(line.debitAmount || 0),
          description: `VOID reversal: ${line.description || ''}`
        }));

        const reversalTxn = await tx.transaction.create({
          data: {
            tenantId: user.tenantId,
            date: voidDate,
            reference: reversalRef,
            description: `VOID reversal for invoice ${invoice.invoiceNumber} (${origTxn.sourceType})`,
            entryType: 'Regular',
            status: 'posted',
            sourceType: `${origTxn.sourceType}-Void`,
            sourceId: invoiceId,
            createdById: user.id,
            postedById: user.id,
            postedDate: voidDate,
            lines: { create: reversedLines }
          },
          include: { lines: true }
        });

        for (const line of reversalTxn.lines) {
          await updateAccountBalanceOnTransaction(
            line.accountId,
            line.debitAmount,
            line.creditAmount,
            tx
          );
        }
      }

      try {
        const { reverseAutoPostTaxEntry } = await import('@/lib/taxCalculationService');

        const taxTransactions = await tx.transaction.findMany({
          where: {
            sourceType: 'Tax-Invoice',
            sourceId: invoiceId,
            tenantId: user.tenantId,
            status: 'posted'
          },
          include: { lines: true }
        });

        for (const taxTxn of taxTransactions) {
          for (const line of taxTxn.lines || []) {
            const taxAmt = Number(line.creditAmount || 0) || Number(line.debitAmount || 0);
            if (taxAmt <= 0) continue;

            const taxType = await tx.taxType.findFirst({
              where: { accountId: line.accountId, tenantId: user.tenantId, status: 'Active' }
            });
            if (!taxType) continue;

            await reverseAutoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId: taxType.id,
              taxAmount: taxAmt,
              transactionDate: voidDate,
              sourceType: 'InvoiceVoid',
              sourceId: invoiceId,
              description: `Tax reversal for voided invoice ${invoice.invoiceNumber}`,
              tx
            });
          }
        }
      } catch (taxReversalError) {
        console.error('Error reversing tax for voided invoice:', taxReversalError);
      }

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
            voidedBy: user.email
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
    return NextResponse.json(
      { error: 'Failed to delete invoice. Please try again.' },
      { status: 500 }
    );
  }
}

