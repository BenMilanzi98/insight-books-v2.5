import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { generateReferenceNumber } from '@/lib/journalService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';

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

      // Reverse all journal entries for this invoice
      try {
        const originalTransactions = await tx.transaction.findMany({
          where: {
            tenantId: user.tenantId,
            sourceId: invoiceId,
            status: 'posted',
          },
          include: { lines: true },
        });

        const voidDate = new Date();
        await assertPeriodOpen(user.tenantId, voidDate, tx);

        for (const origTxn of originalTransactions) {
          const reversalRef = await generateReferenceNumber(tx, user.tenantId, voidDate);
          const reversedLines = origTxn.lines.map((line, idx) => ({
            lineNumber: idx + 1,
            accountId: line.accountId,
            debitAmount: Number(line.creditAmount || 0),
            creditAmount: Number(line.debitAmount || 0),
            description: `VOID reversal: ${line.description || ''}`,
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
              lines: { create: reversedLines },
            },
            include: { lines: true },
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
      } catch (reversalError) {
        console.error('Error reversing journal entries for voided invoice:', reversalError);
      }

      // Reverse tax postings for voided invoice
      try {
        const { reverseAutoPostTaxEntry } = await import('@/lib/taxCalculationService');
        const taxTransactions = await tx.transaction.findMany({
          where: {
            sourceType: 'Tax-Invoice',
            sourceId: invoiceId,
            tenantId: user.tenantId,
            status: 'posted',
          },
          include: { lines: true },
        });

        for (const taxTxn of taxTransactions) {
          for (const line of taxTxn.lines) {
            const taxAmt = Number(line.creditAmount || 0) || Number(line.debitAmount || 0);
            if (taxAmt <= 0) continue;

            const taxType = await tx.taxType.findFirst({
              where: { accountId: line.accountId, tenantId: user.tenantId, status: 'Active' },
            });
            if (!taxType) continue;

            await reverseAutoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId: taxType.id,
              taxAmount: taxAmt,
              transactionDate: new Date(),
              sourceType: 'InvoiceVoid',
              sourceId: invoiceId,
              description: `Tax reversal for voided invoice ${invoice.invoiceNumber}`,
              tx,
            });
          }
        }
      } catch (taxReversalError) {
        console.error('Error reversing tax for voided invoice:', taxReversalError);
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
    return NextResponse.json(
      { success: false, error: 'Failed to void invoice. Please try again.' },
      { status: 500 }
    );
  }
}
