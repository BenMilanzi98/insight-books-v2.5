import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { enrichPaymentsWithMethodNames } from '@/lib/userFacingLabels';

// POST - Add partial payment to an expense
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { expenseId, amount, paymentMethod, paymentDate, reference, notes } = body;

    // Validate required fields
    if (!expenseId || !amount || !paymentMethod || !paymentDate) {
      return NextResponse.json(
        { error: 'Expense ID, amount, payment method, and payment date are required' },
        { status: 400 }
      );
    }

    // Get the expense
    const expense = await prisma.expense.findFirst({
      where: { 
        id: expenseId, 
        tenantId: user.tenantId 
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    const paymentAmount = parseFloat(amount);
    const currentPaidAmount = expense.paidAmount || 0;
    const newPaidAmount = currentPaidAmount + paymentAmount;
    const totalDue =
      Number(expense.amount) + Number(expense.taxAmount != null ? expense.taxAmount : 0);

    // Validate payment amount
    if (paymentAmount <= 0) {
      return NextResponse.json(
        { error: 'Payment amount must be greater than 0' },
        { status: 400 }
      );
    }

    if (newPaidAmount > totalDue + 1e-6) {
      return NextResponse.json(
        { error: 'Total payments cannot exceed expense amount (including tax)' },
        { status: 400 }
      );
    }

    // Determine new payment status
    let newPaymentStatus;
    if (newPaidAmount >= totalDue - 1e-6) {
      newPaymentStatus = 'Fully paid';
    } else {
      newPaymentStatus = 'Partially';
    }

    // Create payment record - inherit branchId from expense
    const payment = await prisma.payment.create({
      data: {
        expenseId: expenseId,
        amount: paymentAmount,
        paymentDate: new Date(paymentDate),
        paymentMethod,
        reference: reference || null,
        notes: notes || null,
        status: 'Completed',
        tenantId: user.tenantId,
        branchId: expense.branchId || null, // Inherit branchId from expense
        type: 'expense',
        sourceAccount: paymentMethod || null
      }
    });

    // Update expense with new payment status and paid amount
    const updatedExpense = await prisma.expense.update({
      where: { id: expenseId },
      data: {
        paymentStatus: newPaymentStatus,
        paidAmount: newPaidAmount,
        paymentReference: reference || expense.paymentReference
      }
    });

    // Create journal entry for payment if expense has a supplier
    if (expense.supplierId) {
      try {
        const { createExpensePaymentJournalEntry } = await import('@/lib/transactionJournalHelpers');
        await createExpensePaymentJournalEntry({
          tenantId: user.tenantId,
          userId: user.id,
          expenseId: expense.id,
          paymentId: payment.id,
          paymentAmount: paymentAmount,
          paymentMethod: paymentMethod,
          paymentDate: new Date(paymentDate),
          supplierId: expense.supplierId,
          tx: prisma,
        });
        console.log('✅ Journal entry created for supplier expense payment:', payment.id);
      } catch (journalError) {
        console.error('❌ Error creating journal entry for supplier expense payment:', journalError);
        // Don't fail the payment if journal entry creation fails
      }
    } else {
      // Update account balance for non-supplier expenses
      const { updateAccountBalance } = await import('@/lib/core');
      await updateAccountBalance(user.tenantId, paymentMethod, paymentAmount, "subtract");
    }

    // Create audit log entry
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_PAYMENT_ADDED',
        entityType: 'EXPENSE',
        entityId: expense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          paymentId: payment.id,
          paymentAmount: paymentAmount,
          paymentMethod: paymentMethod,
          newPaymentStatus: newPaymentStatus,
          newPaidAmount: newPaidAmount
        })
      }
    });

    if (expense.supplierId) {
      try {
        const { updateSupplierBalance } = await import('@/lib/supplierService');
        await updateSupplierBalance(expense.supplierId, user.tenantId);
      } catch (balErr) {
        console.error('updateSupplierBalance after expense partial payment:', balErr?.message);
      }
    }

    return NextResponse.json({
      message: 'Payment added successfully',
      payment: {
        id: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status
      },
      expense: {
        id: updatedExpense.id,
        paymentStatus: updatedExpense.paymentStatus,
        paidAmount: updatedExpense.paidAmount,
        paymentReference: updatedExpense.paymentReference
      }
    });

  } catch (error) {
    console.error('Error adding payment to expense:', error);
    return NextResponse.json(
      { error: 'Failed to add payment. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - Get payment history for an expense
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const expenseId = searchParams.get('expenseId');
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!expenseId) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      );
    }

    // Get the expense with payments
    const expense = await prisma.expense.findFirst({
      where: { 
        id: expenseId, 
        tenantId: user.tenantId 
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    console.log('Expense data from database:', {
      id: expense.id,
      amount: expense.amount,
      amountType: typeof expense.amount,
      paidAmount: expense.paidAmount,
      paidAmountType: typeof expense.paidAmount,
      rawExpense: expense
    });

    // Get all payments for this expense
    const payments = await prisma.payment.findMany({
      where: { 
        expenseId: expenseId,
        tenantId: user.tenantId,
        type: 'expense'
      },
      orderBy: { paymentDate: 'desc' }
    });

    let formattedPayments = await enrichPaymentsWithMethodNames(
      prisma,
      user.tenantId,
      payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod,
        paymentDate: payment.paymentDate.toISOString().split('T')[0],
        reference: payment.reference,
        notes: payment.notes,
        status: payment.status,
      }))
    );

    // Handle legacy expenses that don't have payment records but are marked as fully paid
    if (payments.length === 0 && expense.paymentStatus === 'Fully paid' && expense.paidAmount > 0) {
      console.log('Creating legacy payment record for expense:', expense.id, 'with paidAmount:', expense.paidAmount);
      formattedPayments = [{
        id: 'legacy-payment',
        amount: expense.paidAmount,
        paymentMethod: expense.paymentMethod || 'cash',
        paymentDate: expense.date || expense.createdAt.toISOString().split('T')[0],
        reference: expense.paymentReference || 'Legacy Payment',
        notes: 'Payment recorded before payment tracking system',
        status: 'Completed'
      }];
    }

    // Parse amounts more robustly
    const parseAmount = (value) => {
      if (value === null || value === undefined) return 0;
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        // Remove commas and parse
        const cleaned = value.replace(/,/g, '').trim();
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
      }
      return 0;
    };

    const parsedAmount = parseAmount(expense.amount);
    const parsedPaidAmount = parseAmount(expense.paidAmount);

    console.log('Parsed amounts:', {
      originalAmount: expense.amount,
      parsedAmount,
      originalPaidAmount: expense.paidAmount,
      parsedPaidAmount
    });

    return NextResponse.json({
      payments: formattedPayments,
      expense: {
        id: expense.id,
        description: expense.description,
        amount: parsedAmount,
        paymentStatus: expense.paymentStatus,
        paidAmount: parsedPaidAmount,
        paymentReference: expense.paymentReference,
        date: expense.date.toISOString().split('T')[0]
      }
    });

  } catch (error) {
    console.error('Error fetching expense payment history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payment history. Please try again.' },
      { status: 500 }
    );
  }
}
