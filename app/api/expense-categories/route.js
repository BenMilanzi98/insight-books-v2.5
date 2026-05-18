// app/api/expense-categories/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { isSystemExpenseStructurePickerAccount } from '@/lib/systemExpenseCategoryCodes.js';
import { accountBlocksDirectPosting } from '@/lib/coaDirectPostingEligibility';

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
            isActive: true,
            mergedIntoAccountId: true,
            acceptsNewTransactions: true,
            _count: {
              select: {
                childAccounts: { where: { isActive: true } },
              },
            },
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

    const allowed = categories.filter((cat) => {
      if (cat.account) {
        return (
          isSystemExpenseStructurePickerAccount(cat.account) &&
          !accountBlocksDirectPosting(cat.account).blocked
        );
      }
      return isSystemExpenseStructurePickerAccount({
        accountCode: cat.accountCode || '',
        accountType: 'Expense',
        mergedIntoAccountId: null,
      });
    });

    return NextResponse.json({
      categories: allowed.map(cat => ({
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
