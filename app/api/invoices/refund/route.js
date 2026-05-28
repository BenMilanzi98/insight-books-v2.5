import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { getPaymentAccount } from '@/lib/transactionJournalHelpers';
import { generateReferenceNumber } from '@/lib/journalService';
import { getStandardAccounts } from '@/lib/transactionJournalHelpers';
import { updateAccountBalanceOnTransaction } from '@/lib/accountBalanceService';
import { assertPeriodOpen } from '@/lib/accountingPeriodService';
import { addMoney, moneyGreaterOrEqual, parseMoney, subtractMoney } from '@/lib/money';

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
    const refundAmountNum = parseMoney(refundAmount);

    if (!invoiceId) {
      return NextResponse.json(
        { success: false, error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (refundAmountNum <= 0) {
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
    const totalPaid = invoice.payments.reduce((sum, payment) => addMoney(sum, payment.amount), 0);
    const totalRefunded = invoice.refunds.reduce((sum, refund) => addMoney(sum, refund.refundAmount), 0);
    const availableForRefund = subtractMoney(totalPaid, totalRefunded);

    console.log('Refund validation:', {
      invoiceId,
      invoiceStatus: invoice.status,
      totalPaid,
      totalRefunded,
      availableForRefund,
      requestedRefund: refundAmountNum,
      payments: invoice.payments.length,
      refunds: invoice.refunds.length
    });

    if (availableForRefund <= 0) {
      return NextResponse.json(
        { success: false, error: `No amount available for refund. Total paid: ${totalPaid}, Total refunded: ${totalRefunded}` },
        { status: 400 }
      );
    }

    if (refundAmountNum > availableForRefund) {
      return NextResponse.json(
        { success: false, error: `Refund amount cannot exceed available amount. Available: ${availableForRefund}, Requested: ${refundAmountNum}` },
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
          refundAmount: refundAmountNum,
          refundReason: refundReason.trim(),
          refundMethod: refundMethod,
          notes: notes?.trim() || null,
          tenantId: user.tenantId,
          status: 'completed',
          processedAt: new Date()
        }
      });

      // Calculate new refund total
      const newTotalRefunded = addMoney(totalRefunded, refundAmountNum);

      // Determine new invoice status
      let newStatus = invoice.status;
      if (moneyGreaterOrEqual(newTotalRefunded, totalPaid)) {
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
      let remainingRefundAmount = refundAmountNum;
      const updatedPayments = [];
      const paymentRefundMap = new Map(); // Track refund amounts per payment method

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

        // Track refund amount per payment method
        const currentAmount = paymentRefundMap.get(payment.paymentMethod) || 0;
        paymentRefundMap.set(payment.paymentMethod, currentAmount + refundFromThisPayment);

        // Note: Account balance will be updated via journal entries below
        // No need to call updateAccountBalance here as it will be handled by updateAccountBalanceOnTransaction

        updatedPayments.push(updatedPayment);
        remainingRefundAmount -= refundFromThisPayment;
      }

      // Get standard accounts for journal entries
      const accounts = await getStandardAccounts(user.tenantId, tx);
      if (!accounts.accountsReceivable) {
        throw new Error('Accounts Receivable account not found. Please set up your chart of accounts.');
      }

      // Create journal entries for refund
      // For each payment method, create transaction lines
      const refundDate = new Date();
      const refundReference = await generateReferenceNumber(tx, user.tenantId, refundDate);
      
      const transactionLines = [];
      let lineNumber = 1;

      // Debit: Accounts Receivable (to restore AR that was reduced by payment)
      transactionLines.push({
        lineNumber: lineNumber++,
        accountId: accounts.accountsReceivable.id,
        debitAmount: refundAmountNum,
        creditAmount: 0,
        description: `Accounts Receivable restored for refund of Invoice ${invoice.invoiceNumber}`,
      });

      // Credit: Cash/Bank accounts (one line per payment method)
      let totalCredit = 0;
      for (const [paymentMethod, amount] of paymentRefundMap.entries()) {
        const paymentAccount = await getPaymentAccount(user.tenantId, paymentMethod, tx);
        if (!paymentAccount) {
          throw new Error(`Payment account not found for method: ${paymentMethod}`);
        }

        transactionLines.push({
          lineNumber: lineNumber++,
          accountId: paymentAccount.id,
          debitAmount: 0,
          creditAmount: amount,
          description: `Refund via ${paymentMethod} for Invoice ${invoice.invoiceNumber}`,
        });
        totalCredit += amount;
      }

      // Validate transaction balance
      const totalDebit = transactionLines.reduce((sum, line) => addMoney(sum, line.debitAmount), 0);
      const totalCreditCalculated = transactionLines.reduce((sum, line) => addMoney(sum, line.creditAmount), 0);
      
      if (Math.abs(totalDebit - totalCreditCalculated) > 0.01) {
        throw new Error(`Transaction does not balance. Debits: ${totalDebit}, Credits: ${totalCreditCalculated}`);
      }

      await assertPeriodOpen(user.tenantId, refundDate, tx);
      // Create the refund transaction
      const refundTransaction = await tx.transaction.create({
        data: {
          tenantId: user.tenantId,
          date: refundDate,
          reference: refundReference,
          description: `Refund for Invoice ${invoice.invoiceNumber} - ${refundReason.trim()}`,
          entryType: 'Refund',
          status: 'posted',
          sourceType: 'InvoiceRefund',
          sourceId: refund.id,
          createdById: user.id,
          postedById: user.id,
          postedDate: new Date(),
          lines: {
            create: transactionLines,
          },
        },
        include: { lines: true },
      });

      // Update account balances
      for (const line of refundTransaction.lines) {
        await updateAccountBalanceOnTransaction(
          line.accountId,
          line.debitAmount,
          line.creditAmount,
          tx
        );
      }

      // Store transaction ID in refund record
      await tx.invoiceRefund.update({
        where: { id: refund.id },
        data: { transactionId: refundTransaction.id }
      });

      // Reverse tax postings for refunded invoice
      try {
        const { reverseAutoPostTaxEntry } = await import('@/lib/taxCalculationService');
        // Find original Tax-Invoice transactions for this invoice
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

            // Find the tax type that uses this account
            const taxType = await tx.taxType.findFirst({
              where: { accountId: line.accountId, tenantId: user.tenantId, status: 'Active' },
            });
            if (!taxType) continue;

            // Scale reversal if partial refund
            const refundRatio = refundAmountNum / parseMoney(invoice.total);
            const reversalAmount = Number((taxAmt * refundRatio).toFixed(2));
            if (reversalAmount <= 0) continue;

            await reverseAutoPostTaxEntry({
              tenantId: user.tenantId,
              userId: user.id,
              taxTypeId: taxType.id,
              taxAmount: reversalAmount,
              transactionDate: refundDate,
              sourceType: 'InvoiceRefund',
              sourceId: invoiceId,
              description: `Tax reversal for refund of invoice ${invoice.invoiceNumber}`,
              tx,
            });
          }
        }
      } catch (taxReversalError) {
        console.error('Error reversing tax for refunded invoice:', taxReversalError);
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
            refundAmount: refundAmountNum,
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

      return { invoice: updatedInvoice, refund, updatedPayments, refundTransaction };
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
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process refund. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
