// app/api/expenses/cogs-settlement/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateAccountBalance } from '@/lib/core';

// POST - Create COGS settlement expense
export async function POST(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

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
    if (!body.amount || !body.date) {
      return NextResponse.json(
        { error: 'Amount and date are required' },
        { status: 400 }
      );
    }

    const amount = typeof body.amount === 'string' 
      ? parseFloat(body.amount.replace(/,/g, ''))
      : body.amount;

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    // Use database transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create the COGS settlement expense
      const expense = await tx.expense.create({
        data: {
          description: body.description || `COGS Settlement - ${new Date(body.date).toLocaleDateString()}`,
          amount: amount,
          date: new Date(body.date),
          category: 'COGS Settlement',
          paymentMethod: body.paymentMethod || 'cash',
          sourceAccountId: body.sourceAccountId || null,
          merchant: body.merchant || 'COGS Settlement',
          status: 'Approved', // COGS settlements are automatically approved
          notes: body.notes || 'Automated COGS settlement',
          submittedById: user.id,
          tenantId: user.tenantId,
        }
      });

      // Create payment record
      const payment = await tx.payment.create({
        data: {
          expenseId: expense.id, // Link payment to expense
          amount,
          paymentDate: new Date(body.date),
          paymentMethod: body.paymentMethod || 'cash',
          reference: `COGS Settlement - ${expense.id}`,
          status: 'Completed',
          tenantId: user.tenantId,
          type: 'expense', // Use 'expense' type so it appears in dashboard queries
          sourceAccount: body.paymentMethod || null
        }
      });

      // Update account balance
      await updateAccountBalance(user.tenantId, body.paymentMethod || 'cash', amount, "subtract");

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'COGS_SETTLEMENT_CREATED',
          entityType: 'EXPENSE',
          entityId: expense.id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: expense.description,
            amount: expense.amount,
            paymentMethod: body.paymentMethod || 'cash',
            settlementDate: body.date,
            cogsPeriod: body.cogsPeriod || null,
            automaticSettlement: true
          })
        }
      });

      return { expense, payment };
    });

    // Format response
    return NextResponse.json(
      {
        message: 'COGS settlement expense created successfully',
        expense: {
          ...result.expense,
          amount: result.expense.amount.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
          }),
          date: result.expense.date.toISOString().split('T')[0]
        },
        payment: result.payment
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating COGS settlement expense:', error);
    return NextResponse.json(
      { error: 'Failed to create COGS settlement expense' },
      { status: 500 }
    );
  }
}

// GET - Retrieve COGS settlement expenses
export async function GET(request) {
  try {
    // Check for standard access
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;

    // Build where clause
    const whereClause = {
      tenantId: user.tenantId,
      category: 'COGS Settlement',
      isDeleted: false
    };

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    // Get total count
    const totalCount = await prisma.expense.count({
      where: whereClause
    });

    // Get expenses with pagination
    const expenses = await prisma.expense.findMany({
      where: whereClause,
      include: {
        submittedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        payments: {
          where: {
            type: 'expense'
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    });

    // Format expenses
    const formattedExpenses = expenses.map(expense => ({
      ...expense,
      amount: expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      date: expense.date.toISOString().split('T')[0],
      submittedByName: expense.submittedBy?.name || 'Unknown'
    }));

    return NextResponse.json({
      expenses: formattedExpenses,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching COGS settlement expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch COGS settlement expenses' },
      { status: 500 }
    );
  }
}
