import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { getPostableExpenseAccountOptions } from '@/lib/accountingMappingRules';

/** Product/stock categories (InventoryCategory model). API accepts `stock` or `inventory`; DB unchanged. */
function isProductCategoryType(type) {
  return type === 'inventory' || type === 'stock';
}

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
    const type = searchParams.get('type'); // 'expense', 'inventory', or 'stock'

    let categories = [];

    if (isProductCategoryType(type)) {
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
      // Expense picker rows are sourced from Chart of Accounts only.
      if (!user.tenantId) {
        return NextResponse.json({ categories: [], type: 'expense' });
      }
      categories = await getPostableExpenseAccountOptions(user.tenantId);
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

    if (isProductCategoryType(type)) {
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
      return NextResponse.json(
        {
          error:
            'Expense categories cannot be created here. Add expense GL accounts under Chart of accounts (5000–5999 range).',
        },
        { status: 403 }
      );
    } else {
      return NextResponse.json(
        { error: 'Invalid category type. Use "stock", "inventory", or "expense"' },
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
