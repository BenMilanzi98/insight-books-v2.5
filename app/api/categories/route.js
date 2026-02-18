import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { ensureExpenseAccountsForTenant, EXPENSE_ACCOUNTS_TEMPLATE } from '@/lib/expenseCategoriesTemplate';

// GET - Fetch categories for a tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'expense' or 'inventory'

    let categories = [];

    if (type === 'inventory') {
      // For inventory categories, we'll use the InventoryCategory model
      const inventoryCategories = await prisma.inventoryCategory.findMany({
        where: {
          tenantId: user.tenantId
        },
        select: {
          id: true,
          name: true,
          description: true,
          color: true
        },
        orderBy: {
          name: 'asc'
        }
      });
      categories = inventoryCategories.map(cat => cat.name);
    } else {
      // Expense categories: show ALL expense accounts (ExpenseCategory + any Expense account from Chart of Accounts)
      // Use accountId as id so filter and form (expenseAccountId) work correctly
      const accountIdsFromCategories = new Set();
      try {
        const expenseCategories = await prisma.expenseCategory.findMany({
          where: { tenantId: user.tenantId },
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
          },
          orderBy: { name: 'asc' }
        });
        expenseCategories.forEach(cat => {
          accountIdsFromCategories.add(cat.accountId);
          categories.push({
            id: cat.accountId,
            code: cat.accountCode,
            name: cat.name,
            accountId: cat.accountId,
            account: cat.account,
            description: cat.description
          });
        });
      } catch (expenseCatErr) {
        console.warn('Categories API: expense categories unavailable:', expenseCatErr?.message || expenseCatErr);
      }

      // Add ALL expense accounts: ExpenseCategory (above) + Chart of Accounts
      // Use BOTH type/subtype match AND code range 5000-5999, then merge by id so we never miss any
      const accountSelect = {
        id: true,
        accountCode: true,
        accountName: true,
        name: true,
        accountType: true,
        accountSubtype: true,
        isActive: true
      };
      const baseWhere = { tenantId: user.tenantId, isActive: true };
      try {
        let byTypeAccounts = [];
        let byCodeAccounts = [];
        const runQueries = async () => {
          [byTypeAccounts, byCodeAccounts] = await Promise.all([
            prisma.account.findMany({
              where: {
                ...baseWhere,
                OR: [
                  { accountType: { equals: 'Expense', mode: 'insensitive' } },
                  { type: { equals: 'Expense', mode: 'insensitive' } },
                  { accountSubtype: { equals: 'Cost of Sales', mode: 'insensitive' } },
                  { accountSubtype: { equals: 'Operating Expense', mode: 'insensitive' } },
                  { accountSubtype: { equals: 'Other Expense', mode: 'insensitive' } }
                ]
              },
              select: accountSelect,
              orderBy: { accountName: 'asc' }
            }),
            prisma.account.findMany({
              where: {
                ...baseWhere,
                OR: [
                  { accountCode: { gte: '5000', lte: '5999' } },
                  { code: { gte: '5000', lte: '5999' } }
                ]
              },
              select: accountSelect,
              orderBy: { accountName: 'asc' }
            })
          ]);
        };
        await runQueries();
        let byId = new Map();
        [...byTypeAccounts, ...byCodeAccounts].forEach(acc => byId.set(acc.id, acc));
        // Ensure template expense accounts exist for this tenant when any are missing (creates only missing ones).
        // Fixes tenants who only see "just created" categories and never got the full template.
        if (user.tenantId) {
          const templateCodes = EXPENSE_ACCOUNTS_TEMPLATE.map((t) => t.code);
          const existingTemplateCount = await prisma.account.count({
            where: { tenantId: user.tenantId, accountCode: { in: templateCodes } }
          });
          if (existingTemplateCount < EXPENSE_ACCOUNTS_TEMPLATE.length) {
            try {
              await ensureExpenseAccountsForTenant(user.tenantId, prisma);
              await runQueries();
              byId = new Map();
              [...byTypeAccounts, ...byCodeAccounts].forEach(acc => byId.set(acc.id, acc));
            } catch (ensureErr) {
              console.warn('Categories API: could not ensure expense accounts:', ensureErr?.message || ensureErr);
            }
          }
        }
        const seenIds = new Set(accountIdsFromCategories);
        Array.from(byId.values()).forEach(acc => {
          if (seenIds.has(acc.id)) return;
          seenIds.add(acc.id);
          const label = acc.accountName || acc.name || acc.accountCode || 'Unnamed';
          categories.push({
            id: acc.id,
            code: acc.accountCode || '',
            name: label,
            accountId: acc.id,
            account: acc,
            description: null
          });
        });
        categories.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      } catch (accountErr) {
        console.warn('Categories API: expense accounts unavailable:', accountErr?.message || accountErr);
      }
    }

    return NextResponse.json({
      categories,
      type
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST - Create a new category
export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, type, description, color } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    let category;

    if (type === 'inventory') {
      // Create inventory category
      category = await prisma.inventoryCategory.create({
        data: {
          name: name.trim(),
          description: description || null,
          color: color || '#4f46e5',
          tenantId: user.tenantId
        }
      });
    } else if (type === 'expense') {
      // Redirect to expense categories endpoint
      return NextResponse.json(
        { error: 'Please use /api/expense-categories to create expense categories' },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid category type. Use "inventory" or "expense"' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      category,
      message: 'Category created successfully'
    });
  } catch (error) {
    console.error('Error creating category:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A category with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
} 