// app/api/budgets/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  getRevenueBudgets,
  createRevenueBudget,
  getBranchesForBudget,
  getCategoriesForBudget,
  autoCloseExpiredBudgets,
  PERIOD_TYPES
} from '@/lib/budgetService';
import prisma from '@/lib/prisma';

// GET - List all revenue budgets
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
    const startDateFrom = searchParams.get('startDateFrom');
    const startDateTo = searchParams.get('startDateTo');
    const includeLocked = searchParams.get('includeLocked') === 'true';
    const budgetType = searchParams.get('budgetType');

    // Auto-close expired budgets first
    await autoCloseExpiredBudgets(user.tenantId);

    const budgets = await getRevenueBudgets(user.tenantId, {
      status: status || undefined,
      periodType: periodType || undefined,
      startDateFrom: startDateFrom || undefined,
      startDateTo: startDateTo || undefined,
      includeLocked,
      budgetType: budgetType || undefined
    });

    return NextResponse.json({
      success: true,
      data: budgets,
      periodTypes: PERIOD_TYPES
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budgets' },
      { status: 500 }
    );
  }
}

// POST - Create new revenue budget
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
      periodType = 'monthly',
      startDate,
      endDate,
      expectedRevenue,
      budgetType = 'revenue',
      currency,
      breakdowns,
      items
    } = body;

    // Validation
    if (!name || !startDate || !endDate || !expectedRevenue) {
      return NextResponse.json(
        { error: 'Name, start date, end date, and expected amount are required' },
        { status: 400 }
      );
    }

    // Validate period type
    if (!Object.values(PERIOD_TYPES).includes(periodType)) {
      return NextResponse.json(
        { error: 'Invalid period type. Must be monthly, quarterly, or yearly' },
        { status: 400 }
      );
    }

    // Validate expected revenue is positive
    if (expectedRevenue <= 0) {
      return NextResponse.json(
        { error: budgetType === 'expense'
          ? 'Expected expense must be greater than zero'
          : 'Expected revenue must be greater than zero'
        },
        { status: 400 }
      );
    }

    if (!['revenue', 'expense'].includes(budgetType)) {
      return NextResponse.json(
        { error: 'Budget type must be revenue or expense' },
        { status: 400 }
      );
    }

    if (budgetType === 'expense' && breakdowns && breakdowns.length > 0) {
      return NextResponse.json(
        { error: 'Breakdowns are only supported for revenue budgets' },
        { status: 400 }
      );
    }

    if (items && Array.isArray(items) && items.length > 0) {
      const accountIds = items.map(item => item.accountId).filter(Boolean);
      if (accountIds.length !== items.length) {
        return NextResponse.json(
          { error: 'All line items must reference a valid account from the Chart of Accounts.' },
          { status: 400 }
        );
      }

      const accounts = await prisma.account.findMany({
        where: {
          tenantId: user.tenantId,
          id: { in: accountIds },
          isActive: true,
          accountType: 'Expense'
        },
        select: { id: true, accountType: true }
      });

      if (accounts.length !== new Set(accountIds).size) {
        return NextResponse.json(
          { error: 'Line items must reference active Expense accounts.' },
          { status: 400 }
        );
      }
    }

    // Validate breakdowns total matches expected revenue
    if (budgetType === 'revenue' && breakdowns && Array.isArray(breakdowns) && breakdowns.length > 0) {
      const breakdownTotal = breakdowns.reduce(
        (sum, item) => sum + (item.budgetedAmount || 0),
        0
      );
      const tolerance = 0.01;
      if (Math.abs(breakdownTotal - expectedRevenue) > tolerance) {
        return NextResponse.json(
          { 
            error: `Breakdown total (${breakdownTotal.toFixed(2)}) must match expected revenue (${expectedRevenue.toFixed(2)})` 
          },
          { status: 400 }
        );
      }
    }

    const budget = await createRevenueBudget(user.tenantId, user.id, {
      name,
      description,
      budgetType,
      periodType,
      startDate,
      endDate,
      expectedRevenue,
      currency: currency || 'MWK',
      breakdowns,
      items
    });

    return NextResponse.json({
      success: true,
      message: budgetType === 'expense'
        ? 'Expense budget created successfully'
        : 'Revenue budget created successfully',
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

// GET /api/budgets/options - Get options for budget creation (branches, categories)
export async function OPTIONS(request) {
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

    const [branches, categories] = await Promise.all([
      getBranchesForBudget(user.tenantId),
      getCategoriesForBudget(user.tenantId)
    ]);

    return NextResponse.json({
      success: true,
      data: {
        branches,
        categories,
        periodTypes: Object.entries(PERIOD_TYPES).map(([key, value]) => ({
          value,
          label: key.charAt(0) + key.slice(1)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching budget options:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch options' },
      { status: 500 }
    );
  }
}
