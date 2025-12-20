import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';
import { createInvoicePaymentJournalEntry } from '@/lib/transactionJournalHelpers';

// POST - Process a partial payment for an invoice
export async function POST(request) {
  try {
    const body = await request.json();
    const { invoiceId, amount, paymentMethod, paymentDate, reference, notes } = body;
    
    // Convert amount to number
    const numericAmount = parseFloat(amount);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be a valid number greater than 0' },
        { status: 400 }
      );
    }

    if (!paymentMethod) {
      return NextResponse.json(
        { error: 'Payment method is required' },
        { status: 400 }
      );
    }

    // Get the invoice with current payments
    const invoice = await prisma.invoice.findFirst({
      where: { 
        id: invoiceId, 
        tenantId: user.tenantId 
      },
      include: { 
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' }
        },
        client: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if invoice is in a valid state for payment
    if (['void', 'refunded', 'partially_refunded', 'paid'].includes(invoice.status.toLowerCase())) {
      return NextResponse.json(
        { error: 'Cannot process payment for voided, refunded, or fully paid invoice' },
        { status: 400 }
      );
    }

    // Calculate remaining balance
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingBalance = invoice.total - totalPaid;

    // Validate payment amount
    if (numericAmount > remainingBalance) {
      return NextResponse.json(
        { error: `Payment amount exceeds remaining balance of ${remainingBalance.toLocaleString()}` },
        { status: 400 }
      );
    }

    const paymentDateObj = new Date(paymentDate || new Date());
    
    // Process payment in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the payment record
      const payment = await tx.payment.create({
        data: {
          amount: numericAmount,
          paymentMethod: paymentMethod,
          paymentDate: paymentDateObj,
          reference: reference || '',
          notes: notes || '',
          status: 'Completed',
          type: 'invoice',
          invoiceId: invoiceId,
          tenantId: user.tenantId
        }
      });

      // Update invoice payment totals
      const newTotalPaid = totalPaid + numericAmount;
      const newRemainingBalance = invoice.total - newTotalPaid;
      const lastPaymentDate = paymentDateObj;

      // Determine new status
      let newStatus;
      if (newRemainingBalance <= 0) {
        newStatus = 'Paid';
      } else if (newTotalPaid > 0) {
        newStatus = 'Partial';
      } else {
        newStatus = 'Pending';
      }

      // Update the invoice
      const updatedInvoice = await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          totalPaid: newTotalPaid,
          remainingBalance: Math.max(0, newRemainingBalance),
          lastPaymentDate: lastPaymentDate,
          status: newStatus
        },
        include: {
          client: true,
          payments: {
            where: { status: 'Completed' },
            orderBy: { paymentDate: 'desc' }
          }
        }
      });

      // Update account balance
      try {
        await updateAccountBalance(user.tenantId, paymentMethod, numericAmount, 'add');
      } catch (error) {
        console.error('Error updating account balance:', error);
        // Don't fail the payment if account balance update fails
      }

      // Create journal entry for invoice payment
      try {
        await createInvoicePaymentJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          paymentDate: paymentDateObj,
          paymentAmount: numericAmount,
          paymentMethod,
          tx,
        });
      } catch (journalError) {
        console.error('Error creating journal entry for invoice payment:', journalError);
        // Don't fail the payment if journal entry creation fails
      }

      return { payment, invoice: updatedInvoice };
    });

    const payment = result.payment;
    const updatedInvoice = result.invoice;

    // Format response data
    const formattedPayment = {
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString().split('T')[0],
      reference: payment.reference,
      notes: payment.notes,
      status: payment.status
    };

    const formattedInvoice = {
      id: updatedInvoice.id,
      invoiceNumber: updatedInvoice.invoiceNumber,
      total: updatedInvoice.total,
      totalPaid: updatedInvoice.totalPaid,
      remainingBalance: updatedInvoice.remainingBalance,
      status: updatedInvoice.status,
      lastPaymentDate: updatedInvoice.lastPaymentDate?.toISOString().split('T')[0] || null
    };

    return NextResponse.json({
      message: 'Partial payment processed successfully',
      payment: formattedPayment,
      invoice: formattedInvoice
    }, { status: 201 });

  } catch (error) {
    console.error('Error processing partial payment:', error);
    return NextResponse.json(
      { error: 'Failed to process partial payment. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - Get payment history for an invoice
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    // Get the invoice with payments
    const invoice = await prisma.invoice.findFirst({
      where: { 
        id: invoiceId, 
        tenantId: user.tenantId 
      },
      include: { 
        payments: {
          where: { status: 'Completed' },
          orderBy: { paymentDate: 'desc' }
        },
        client: true
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Format payments data
    const formattedPayments = invoice.payments.map(payment => ({
      id: payment.id,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString().split('T')[0],
      reference: payment.reference,
      notes: payment.notes,
      status: payment.status
    }));

    return NextResponse.json({
      payments: formattedPayments,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        total: invoice.total,
        totalPaid: invoice.totalPaid,
        remainingBalance: invoice.remainingBalance,
        status: invoice.status,
        client: invoice.client
      }
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history. Please try again.' },
      { status: 500 }
    );
  }
}
