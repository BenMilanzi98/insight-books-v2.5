import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

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
      // For expense categories, use Chart of Accounts (Expense type)
      const expenseAccounts = await prisma.account.findMany({
        where: {
          tenantId: user.tenantId,
          isActive: true,
          accountType: 'Expense'
        },
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          accountType: true
        },
        orderBy: {
          accountCode: 'asc'
        }
      });

      categories = expenseAccounts.map(acc => ({
        id: acc.id,
        code: acc.accountCode,
        name: acc.accountName,
        type: acc.accountType
      }));
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
    } else {
      return NextResponse.json(
        { error: 'Expense categories are managed in the Chart of Accounts.' },
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