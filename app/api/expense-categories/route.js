// app/api/expense-categories/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { isPhinduExpenseStructureCode } from '@/lib/phinduExpenseCategoryCodes.js';

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

    const categories = await prisma.expenseCategory.findMany({
      where: {
        tenantId: user.tenantId
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            code: true,
            accountName: true,
            accountType: true,
            isActive: true
          }
        },
        _count: {
          select: {
            expenses: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    const phinduOnly = categories.filter((cat) => {
      const code = cat.account?.accountCode || cat.account?.code || cat.accountCode || '';
      return isPhinduExpenseStructureCode(code);
    });

    return NextResponse.json({
      categories: phinduOnly.map(cat => ({
        id: cat.id,
        name: cat.name,
        description: cat.description,
        accountCode: cat.accountCode,
        accountId: cat.accountId,
        account: cat.account,
        expenseCount: cat._count.expenses,
        createdAt: cat.createdAt,
        updatedAt: cat.updatedAt
      }))
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
 * POST /api/expense-categories — disabled; categories are fixed to PHINDU CoA codes.
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        'Creating expense categories from the app is disabled. Use the predefined PHINDU expense accounts (chart of accounts structure).',
    },
    { status: 403 }
  );
}
