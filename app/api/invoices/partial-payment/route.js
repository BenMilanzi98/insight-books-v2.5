import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { postCustomerPaymentAccounting } from '@/lib/accountingV2/adapters';
import { ensureInvoicePaymentRevenueRecognition } from '@/lib/ensureInvoicePaymentRevenueRecognition';
import { ensureInvoiceSalesAccounting } from '@/lib/ensureInvoiceSalesAccounting';
import { enrichPaymentsWithMethodNames } from '@/lib/userFacingLabels';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';

// POST - Process a partial payment for an invoice
export async function POST(request) {
  try {
    const body = await request.json();
    const { invoiceId, amount, paymentMethod, paymentDate, reference, notes } = body;
    
    // Convert amount to a safe 2-decimal money number
    const numericAmount = parseMoney(amount);
    
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
          where: { status: 'Completed', isReversal: false },
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

    // Calculate remaining balance (only completed, non-reversal payments)
    const totalPaid = invoice.payments.reduce(
      (sum, payment) => addMoney(sum, payment.amount),
      0
    );
    const invTotal = parseMoney(invoice.total);
    const remainingBalance = subtractMoney(invTotal, totalPaid);

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
      // Recognize revenue + COGS before cash application (covers Draft/Partial
      // invoices that were never posted, and backfills missing Invoice-COGS).
      await ensureInvoiceSalesAccounting({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId,
        force: true,
      });

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
          tenantId: user.tenantId,
          branchId: invoice.branchId ?? null,
        }
      });

      // Update invoice payment totals
      const newTotalPaid = addMoney(totalPaid, numericAmount);
      const newRemainingBalance = subtractMoney(invTotal, newTotalPaid);
      const lastPaymentDate = paymentDateObj;

      // Determine new status
      let newStatus;
      if (newRemainingBalance <= 0.005) {
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
            where: { status: 'Completed', isReversal: false },
            orderBy: { paymentDate: 'desc' }
          }
        }
      });

      // V2 customer payment accounting — fail closed
      await postCustomerPaymentAccounting({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        paymentId: payment.id,
        invoiceId: invoice.id,
        paymentAmount: numericAmount,
        paymentDate: paymentDateObj,
        paymentMethod,
      });

      await ensureInvoicePaymentRevenueRecognition({
        db: tx,
        tenantId: user.tenantId,
        userId: user.id,
        invoiceId,
        paymentId: payment.id,
        paymentAmount: numericAmount,
        paymentDate: paymentDateObj,
      });

      return { payment, invoice: updatedInvoice };
    }, { maxWait: 15000, timeout: 120000 });

    const payment = result.payment;
    const updatedInvoice = result.invoice;

    // Format response data
    const [formattedPayment] = await enrichPaymentsWithMethodNames(prisma, user.tenantId, [
      {
        id: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
      },
    ]);

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
          where: { status: 'Completed', isReversal: false },
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

    const formattedPayments = await enrichPaymentsWithMethodNames(
      prisma,
      user.tenantId,
      invoice.payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
      }))
    );

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
