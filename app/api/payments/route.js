// app/api/payments/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance, processCapitalTransfer } from '@/lib/core';
import {
  createInvoicePaymentJournalEntry,
  getPaymentAccount,
  getStandardAccounts,
  getExpenseAccount
} from '@/lib/transactionJournalHelpers';
import { generateReferenceNumber } from '@/lib/journalService';
import { validateTransactionBalance } from '@/lib/accountingValidation';

// Helper function to format payment data
const formatPaymentResponse = (payment) => {
  return {
    id: payment.id,
    type: payment.type,
    invoiceId: payment.invoiceId,
    invoiceNumber: payment.invoice?.invoiceNumber,
    amount: payment.amount,
    paymentDate: payment.paymentDate,
    paymentMethod: payment.paymentMethod,
    sourceAccount: payment.sourceAccount,
    destinationAccount: payment.destinationAccount,
    reference: payment.reference,
    notes: payment.notes,
    status: payment.status,
    createdAt: payment.createdAt,
    client: payment.invoice?.client ? {
      id: payment.invoice.client.id,
      name: payment.invoice.client.name
    } : null
  };
};

async function recordPaymentTransaction({
  tenantId,
  userId,
  paymentId,
  type,
  amount,
  paymentDate,
  paymentMethod,
  sourceAccount,
  destinationAccount,
  invoice,
  notes
}) {
  const numericAmount = Number(amount || 0);
  if (!tenantId || !userId || !paymentId || !numericAmount || numericAmount <= 0) {
    return;
  }

  const methodKey = paymentMethod || sourceAccount || 'cash';

  try {
    if (type === 'invoice' && invoice) {
      await createInvoicePaymentJournalEntry({
        tenantId,
        userId,
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        paymentDate,
        paymentAmount: numericAmount,
        paymentMethod: methodKey
      });
      return;
    }

    let lines = [];
    let sourceType = 'Payment';
    const entryDate = paymentDate ? new Date(paymentDate) : new Date();
    const description = notes?.trim() || undefined;

    if (type === 'expense') {
      const paymentAccount = await getPaymentAccount(tenantId, methodKey);
      const expenseAccount = await getExpenseAccount(tenantId, 'Operating Expenses');
      if (!paymentAccount || !expenseAccount) return;
      sourceType = 'ExpensePayment';
      lines = [
        {
          accountId: expenseAccount.id,
          debitAmount: numericAmount,
          creditAmount: 0,
          description: description || 'Expense'
        },
        {
          accountId: paymentAccount.id,
          debitAmount: 0,
          creditAmount: numericAmount,
          description: 'Cash outflow'
        }
      ];
    } else if (type === 'sale') {
      const accounts = await getStandardAccounts(tenantId);
      const revenueAccount = accounts.salesRevenue || accounts.serviceRevenue;
      const paymentAccount = await getPaymentAccount(tenantId, methodKey);
      if (!revenueAccount || !paymentAccount) return;
      sourceType = 'SalePayment';
      lines = [
        {
          accountId: paymentAccount.id,
          debitAmount: numericAmount,
          creditAmount: 0,
          description: 'Cash received'
        },
        {
          accountId: revenueAccount.id,
          debitAmount: 0,
          creditAmount: numericAmount,
          description: 'Revenue'
        }
      ];
    } else if (type === 'transfer') {
      const fromAccount = await getPaymentAccount(tenantId, sourceAccount);
      const toAccount = await getPaymentAccount(tenantId, destinationAccount);
      if (!fromAccount || !toAccount) return;
      sourceType = 'Transfer';
      lines = [
        {
          accountId: toAccount.id,
          debitAmount: numericAmount,
          creditAmount: 0,
          description: 'Transfer in'
        },
        {
          accountId: fromAccount.id,
          debitAmount: 0,
          creditAmount: numericAmount,
          description: 'Transfer out'
        }
      ];
    } else {
      return;
    }

    const balanceValidation = validateTransactionBalance(lines);
    if (!balanceValidation.isValid) {
      console.error('Payment transaction not balanced:', balanceValidation.error);
      return;
    }

    const reference = await generateReferenceNumber(prisma, tenantId, entryDate);

    await prisma.transaction.create({
      data: {
        tenantId,
        date: entryDate,
        reference,
        description: description || 'Payment transaction',
        entryType: 'Regular',
        status: 'posted',
        sourceType,
        sourceId: paymentId,
        createdById: userId,
        postedById: userId,
        postedDate: new Date(),
        lines: {
          create: lines.map((line, index) => ({
            lineNumber: index + 1,
            accountId: line.accountId,
            debitAmount: line.debitAmount,
            creditAmount: line.creditAmount,
            description: line.description
          }))
        }
      }
    });
  } catch (error) {
    console.error('Failed to record payment transaction:', error);
  }
}

// GET - Fetch payments with filtering, sorting, and pagination
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Parse query parameters
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const sortBy = searchParams.get('sortBy') || 'paymentDate';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const method = searchParams.get('method');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Build filter object for Prisma
    const where = {
      tenantId: user.tenantId
    };
    
    // Add status filter if provided
    if (status) {
      where.status = status;
    }
    
    // Add payment method filter if provided
    if (method) {
      where.paymentMethod = method;
    }
    
    // Add date range filters if provided
    if (dateFrom) {
      where.paymentDate = {
        ...where.paymentDate,
        gte: new Date(dateFrom)
      };
    }
    
    if (dateTo) {
      where.paymentDate = {
        ...where.paymentDate,
        lte: new Date(dateTo)
      };
    }
    
    // Add search filter if provided
    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        {
          invoice: {
            OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { client: { name: { contains: search, mode: 'insensitive' } } }
            ]
          }
        }
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.payment.count({ where });
    
    // Build sort object for Prisma
    const orderBy = { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' };
    
    // Fetch payments
    const payments = await prisma.payment.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // Format payments for response
    const formattedPayments = payments.map(formatPaymentResponse);
    
    // Return payments with pagination metadata
    return NextResponse.json({
      payments: formattedPayments,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments. Please try again.' },
      { status: 500 }
    );
  }
}
export async function POST(request) {
  try {
    const body = await request.json();
    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const {
      invoiceId,
      amount,
      paymentDate,
      reference,
      notes,
      type,
      sourceAccount,
      destinationAccount
    } = body;

    if (!amount || !paymentDate || !sourceAccount || !type) {
      return NextResponse.json({ error: 'Amount, payment date, type, and payment method are required' }, { status: 400 });
    }

    // Validate accounts
    if (type === "expense" && !sourceAccount) {
      return NextResponse.json({ error: 'Source account is required for expense' }, { status: 400 });
    }
    if (type === "transfer" && (!sourceAccount || !destinationAccount)) {
      return NextResponse.json({ error: 'Both source and destination accounts are required for transfer' }, { status: 400 });
    }
    const paymentMethod = sourceAccount;
    // Special handling for invoices
    let invoice = null;
    if (type === "invoice") {
      if (!invoiceId) return NextResponse.json({ error: 'Invoice ID required for invoice payments' }, { status: 400 });

      invoice = await prisma.invoice.findFirst({
        where: { id: invoiceId, tenantId: user.tenantId },
        include: { payments: true }
      });

      if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
      const remaining = invoice.total - totalPaid;
      if (amount > remaining) {
        return NextResponse.json({ error: `Payment exceeds remaining invoice amount (${remaining})` }, { status: 400 });
      }
    }

    // Find capital account for transfer validation
    const capitalAccount = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        type: 'EQUITY',
        name: { contains: 'Capital', mode: 'insensitive' }
      }
    });

    // 🔐 Create payment
    const newPayment = await prisma.payment.create({
      data: {
        invoiceId: invoice?.id || null,
        amount,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
        status: 'Completed',
        tenantId: user.tenantId,
        type,
        sourceAccount: sourceAccount || null,
        destinationAccount: destinationAccount || null
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: { select: { id: true, name: true } }
          }
        }
      }
    });

    // Update invoice payment totals if this is an invoice payment
    if (invoice && type === "invoice") {
      const totalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
      const remainingBalance = invoice.total - totalPaid;
      const lastPaymentDate = new Date(paymentDate);

      // Determine new status
      let newStatus;
      if (remainingBalance <= 0) {
        newStatus = 'paid';
      } else if (totalPaid > 0) {
        newStatus = 'partial';
      } else {
        newStatus = 'pending';
      }

      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          totalPaid: totalPaid,
          remainingBalance: Math.max(0, remainingBalance),
          lastPaymentDate: lastPaymentDate,
          status: newStatus
        }
      });
    }

    // 🔄 Handle balance updates
    if (["invoice", "sale"].includes(type)) {
      await updateAccountBalance(user.tenantId, paymentMethod, amount, "add");
    } else if (type === "expense") {
      await updateAccountBalance(user.tenantId, sourceAccount, amount, "subtract");
    } else if (type === "transfer") {
      // Check if this is a capital account transfer
      const isCapitalAccountTransfer = sourceAccount === capitalAccount?.id;
      
      if (isCapitalAccountTransfer) {
        // For capital account transfers, use the simple balance update method
        // since destination is a payment method key, not an Account model ID
        await updateAccountBalance(user.tenantId, sourceAccount, amount, "subtract");
        await updateAccountBalance(user.tenantId, destinationAccount, amount, "add");
      } else {
        // For regular account-to-account transfers, use the enhanced function
        try {
          await processCapitalTransfer(user.tenantId, sourceAccount, destinationAccount, amount, notes || 'Transfer between accounts');
        } catch (transferError) {
          console.error('Transfer error:', transferError);
          // Fallback to old method if the new one fails
          await updateAccountBalance(user.tenantId, sourceAccount, amount, "subtract");
          await updateAccountBalance(user.tenantId, destinationAccount, amount, "add");
        }
      }
    } else if (type === "adjustment") {
      await updateAccountBalance(user.tenantId, paymentMethod, amount, "add");
    }

    await recordPaymentTransaction({
      tenantId: user.tenantId,
      userId: user.id,
      paymentId: newPayment.id,
      type,
      amount,
      paymentDate,
      paymentMethod,
      sourceAccount,
      destinationAccount,
      invoice,
      notes
    });

    // 🧾 Update invoice status
    if (type === "invoice" && invoice) {
      const newTotalPaid = invoice.payments.reduce((sum, p) => sum + p.amount, 0) + amount;
      const newStatus = newTotalPaid >= invoice.total ? "Paid" : "Partial";
      await prisma.invoice.update({ where: { id: invoice.id }, data: { status: newStatus } });
    }

    // 📝 Audit log
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: newPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          type,
          amount,
          method: paymentMethod,
          ...(invoice ? { invoiceNumber: invoice.invoiceNumber } : {})
        })
      }
    });

    return NextResponse.json({ message: "Payment recorded", payment: formatPaymentResponse(newPayment) }, { status: 201 });
  } catch (error) {
    console.error("Payment POST error:", error);
    return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
  }
}

// POST - Create a new payment
export async function OldPOST(request) {
  try {
    const body = await request.json();
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Validate required fields
    if (!body.invoiceId || !body.amount || !body.paymentDate || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Invoice, amount, payment date, and payment method are required' },
        { status: 400 }
      );
    }
    
    // Check if invoice exists and belongs to tenant
    const invoice = await prisma.invoice.findFirst({
      where: {
        id: body.invoiceId,
        tenantId: user.tenantId
      },
      include: {
        payments: true
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Calculate total paid and check if payment exceeds invoice amount
    const totalPaid = invoice.payments.reduce((sum, payment) => sum + payment.amount, 0);
    const remainingAmount = invoice.total - totalPaid;
    
    if (body.amount > remainingAmount) {
      return NextResponse.json(
        { error: `Payment amount exceeds remaining invoice amount (${remainingAmount})` },
        { status: 400 }
      );
    }
    
    // Create the payment
    const newPayment = await prisma.payment.create({
      data: {
        invoiceId: body.invoiceId,
        amount: body.amount,
        paymentDate: new Date(body.paymentDate),
        paymentMethod: body.paymentMethod,
        reference: body.reference || null,
        notes: body.notes || null,
        status: 'Completed',
        tenantId: user.tenantId
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            client: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
    
    // Update invoice status based on payment
    const newTotalPaid = totalPaid + body.amount;
    let newStatus;
    
    if (newTotalPaid >= invoice.total) {
      newStatus = 'Paid';
    } else if (newTotalPaid > 0) {
      newStatus = 'Partial';
    } else {
      newStatus = 'Pending';
    }
    
    await prisma.invoice.update({
      where: { id: body.invoiceId },
      data: { status: newStatus }
    });
    
    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: newPayment.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          amount: newPayment.amount,
          paymentMethod: newPayment.paymentMethod,
          invoiceNumber: newPayment.invoice.invoiceNumber
        })
      }
    });
    
    // Return the created payment
    return NextResponse.json(
      { 
        message: 'Payment recorded successfully',
        payment: formatPaymentResponse(newPayment) 
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json(
      { error: 'Failed to record payment. Please try again.' },
      { status: 500 }
    );
  }
}