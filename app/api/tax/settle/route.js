// app/api/tax/settle/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { updateAccountBalance } from '@/lib/core';

// POST - Settle tax liability by creating an expense record
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
    
    // Validate required fields
    if (!body.amount || !body.date || !body.paymentMethod) {
      return NextResponse.json(
        { error: 'Amount, date, and payment method are required' },
        { status: 400 }
      );
    }

    // Parse amount
    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than zero' },
        { status: 400 }
      );
    }

    // Use database transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the tax settlement expense
      const expense = await tx.expense.create({
        data: {
          description: body.description || `Tax Settlement - ${new Date(body.date).toLocaleDateString()}`,
          amount: amount,
          date: new Date(body.date),
          category: 'Tax Settlement',
          paymentMethod: body.paymentMethod,
          sourceAccountId: body.sourceAccountId || null,
          merchant: body.merchant || 'Tax Authority',
          status: 'Approved', // Tax settlements are automatically approved
          notes: body.notes || 'Automated tax settlement',
          submittedById: user.id,
          tenantId: user.tenantId,
        }
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          amount,
          paymentDate: new Date(body.date),
          paymentMethod: body.paymentMethod,
          reference: `Tax Settlement - ${expense.id}`,
          status: 'Completed',
          tenantId: user.tenantId,
          type: 'tax_settlement',
          sourceAccount: body.paymentMethod || null
        }
      });

      // Update account balance
      await updateAccountBalance(user.tenantId, body.paymentMethod, amount, "subtract");

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'TAX_SETTLEMENT_CREATED',
          entityType: 'EXPENSE',
          entityId: expense.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: expense.description,
            amount: expense.amount,
            paymentMethod: body.paymentMethod,
            settlementDate: body.date,
            taxPeriod: body.taxPeriod || null,
            automaticSettlement: true
          })
        }
      });

      return { expense, payment };
    });

    // Format response
    return NextResponse.json({
      message: 'Tax settlement recorded successfully',
      settlement: {
        id: result.expense.id,
        description: result.expense.description,
        amount: result.expense.amount.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }),
        date: result.expense.date.toISOString().split('T')[0],
        paymentMethod: result.expense.paymentMethod,
        status: result.expense.status,
        paymentId: result.payment.id
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating tax settlement:', error);
    return NextResponse.json(
      { error: 'Failed to record tax settlement. Please try again.' },
      { status: 500 }
    );
  }
}
