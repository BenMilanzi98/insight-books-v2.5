// app/api/expense-categories/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getPostableExpenseAccountOptions } from '@/lib/accountingMappingRules';

/**
 * GET /api/expense-categories
 * Fetch all expense categories for the tenant
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const categories = await getPostableExpenseAccountOptions(user.tenantId);

    return NextResponse.json({
      categories
    });
  } catch (error) {
    console.error('Error fetching expense categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch expense categories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/expense-categories — disabled; link GL via Chart of Accounts (expense range 5000–5999).
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Creating expense categories from the app is disabled. Add expense accounts under Chart of accounts; they appear in expenses automatically.',
    },
    { status: 403 }
  );
}
