// app/api/expense-categories/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

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

    return NextResponse.json({
      categories: categories.map(cat => ({
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
 * POST /api/expense-categories
 * Create a new expense category with automatic account code generation
 */
export async function POST(request) {
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

    const body = await request.json();
    const { name, description } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const categoryName = name.trim();

    // Check if category already exists
    const existingCategory = await prisma.expenseCategory.findFirst({
      where: {
        tenantId: user.tenantId,
        name: { equals: categoryName, mode: 'insensitive' }
      }
    });

    if (existingCategory) {
      return NextResponse.json(
        { error: 'An expense category with this name already exists' },
        { status: 409 }
      );
    }

    // Generate account code (5001-5999) so all categories fall under 5000 - Expense
    const accountCode = await generateExpenseAccountCode(user.tenantId);

    // Parent account: 5000 - Expense (so categories accumulate under it)
    const parentExpense = await prisma.account.findFirst({
      where: {
        tenantId: user.tenantId,
        isActive: true,
        OR: [
          { accountCode: '5000' },
          { code: '5000' }
        ]
      },
      select: { id: true }
    });

    // Create account in Chart of Accounts (child of 5000 - Expense)
    const account = await prisma.account.create({
      data: {
        tenantId: user.tenantId,
        accountCode: accountCode,
        accountName: categoryName,
        accountType: 'Expense',
        normalBalance: 'Debit',
        description: description || `Expense account for ${categoryName}`,
        isActive: true,
        isSystem: false,
        ...(parentExpense?.id && { parentAccountId: parentExpense.id })
      }
    });

    // Create expense category linked to the account
    const category = await prisma.expenseCategory.create({
      data: {
        name: categoryName,
        description: description || null,
        accountId: account.id,
        accountCode: accountCode,
        tenantId: user.tenantId
      },
      include: {
        account: {
          select: {
            id: true,
            accountCode: true,
            accountName: true,
            accountType: true,
            isActive: true
          }
        }
      }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'EXPENSE_CATEGORY_CREATED',
        entityType: 'EXPENSE_CATEGORY',
        entityId: category.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          categoryId: category.id,
          name: category.name,
          accountCode: category.accountCode,
          accountId: account.id
        })
      }
    }).catch(err => {
      console.warn('Failed to create audit log:', err);
      // Don't fail the request if audit log fails
    });

    return NextResponse.json({
      message: 'Expense category created successfully',
      category: {
        id: category.id,
        name: category.name,
        description: category.description,
        accountCode: category.accountCode,
        accountId: category.accountId,
        account: category.account
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating expense category:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category or account with this name/code already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create expense category. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * Generate the next expense account code: sequential in 5001-5999 (first available).
 * All created categories fall under 5000 - Expense; codes are unique and assigned in order.
 */
async function generateExpenseAccountCode(tenantId) {
  const existingAccounts = await prisma.account.findMany({
    where: {
      tenantId,
      accountType: 'Expense',
      accountCode: { not: null }
    },
    select: { accountCode: true }
  });

  const existingCategories = await prisma.expenseCategory.findMany({
    where: { tenantId },
    select: { accountCode: true }
  });

  const usedSet = new Set(
    [
      ...existingAccounts.map(a => a.accountCode).filter(Boolean),
      ...existingCategories.map(c => c.accountCode).filter(Boolean)
    ].map(String)
  );

  // Sequential: assign first available code in 5001-5999 (fills gaps, keeps order)
  for (let code = 5001; code <= 5999; code++) {
    const codeStr = String(code);
    if (!usedSet.has(codeStr)) return codeStr;
  }

  throw new Error('Expense account code range (5001-5999) is exhausted');
}
