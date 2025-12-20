// app/api/expenses/deleted/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// GET - Fetch deleted expenses for restoration
export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const search = searchParams.get('search') || '';

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = {
      tenantId: user.tenantId,
      isDeleted: true
    };

    if (search) {
      whereClause.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { merchant: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get deleted expenses with pagination
    const [expenses, totalCount] = await Promise.all([
      prisma.expense.findMany({
        where: whereClause,
        include: {
          submittedBy: {
            select: { name: true }
          },
          deletedBy: {
            select: { name: true }
          }
        },
        orderBy: { deletedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.expense.count({ where: whereClause })
    ]);

    // Format expenses for response
    const formattedExpenses = expenses.map(expense => ({
      id: expense.id,
      description: expense.description,
      amount: expense.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }),
      rawAmount: expense.amount,
      date: expense.date.toISOString().split('T')[0],
      category: expense.category,
      merchant: expense.merchant,
      status: expense.status,
      submittedBy: expense.submittedBy?.name,
      deletedBy: expense.deletedBy?.name,
      deletedAt: expense.deletedAt?.toISOString(),
      deletionReason: expense.deletionReason,
      createdAt: expense.createdAt.toISOString(),
      canRestore: true
    }));

    return NextResponse.json({
      expenses: formattedExpenses,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching deleted expenses:', error);
    return NextResponse.json(
      { error: 'Failed to fetch deleted expenses. Please try again.' },
      { status: 500 }
    );
  }
}
