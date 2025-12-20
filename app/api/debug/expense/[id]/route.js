// app/api/debug/expense/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const { id } = params;
    
    // Get the raw expense data
    const expense = await prisma.expense.findFirst({
      where: { 
        id: id, 
        tenantId: user.tenantId 
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Expense not found' },
        { status: 404 }
      );
    }

    // Return raw data for debugging
    return NextResponse.json({
      rawExpense: expense,
      amountAnalysis: {
        value: expense.amount,
        type: typeof expense.amount,
        isNaN: isNaN(expense.amount),
        parseFloat: parseFloat(expense.amount),
        stringified: String(expense.amount)
      },
      paidAmountAnalysis: {
        value: expense.paidAmount,
        type: typeof expense.paidAmount,
        isNaN: isNaN(expense.paidAmount),
        parseFloat: parseFloat(expense.paidAmount),
        stringified: String(expense.paidAmount)
      }
    });
    
  } catch (error) {
    console.error('Error debugging expense:', error);
    return NextResponse.json(
      { error: 'Failed to debug expense' },
      { status: 500 }
    );
  }
}
