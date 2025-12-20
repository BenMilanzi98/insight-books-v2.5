// app/api/budgets/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { createBudget, getBudgets } from '@/lib/budgetService';
import prisma from '@/lib/prisma';

// GET - List all budgets
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const periodType = searchParams.get('periodType');

    const budgets = await getBudgets(user.tenantId, {
      status: status || undefined,
      periodType: periodType || undefined
    });

    return NextResponse.json({
      success: true,
      data: budgets
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

// POST - Create new budget
export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      periodType = 'annual',
      startDate,
      endDate,
      items = []
    } = body;

    // Validation
    if (!name || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Name, start date, and end date are required' },
        { status: 400 }
      );
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Budget must have at least one item' },
        { status: 400 }
      );
    }

    // Validate all accounts exist and belong to tenant
    const accountIds = items.map(item => item.accountId);
    const accounts = await prisma.account.findMany({
      where: {
        id: { in: accountIds },
        tenantId: user.tenantId,
        isActive: true
      }
    });

    if (accounts.length !== accountIds.length) {
      return NextResponse.json(
        { error: 'One or more accounts not found or inactive' },
        { status: 400 }
      );
    }

    const budget = await createBudget(user.tenantId, {
      name,
      description,
      periodType,
      startDate,
      endDate,
      items
    });

    return NextResponse.json({
      success: true,
      message: 'Budget created successfully',
      data: budget
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create budget' },
      { status: 500 }
    );
  }
}










