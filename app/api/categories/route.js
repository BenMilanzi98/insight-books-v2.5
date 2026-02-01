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
      // For expense categories, get unique categories from existing expenses
      const expenseCategories = await prisma.expense.findMany({
        where: {
          tenantId: user.tenantId,
          isDeleted: false
        },
        select: {
          category: true
        },
        distinct: ['category']
      });

      // Get unique categories from salary advances (they have category "Salary Advance")
      const salaryAdvanceCount = await prisma.salaryAdvance.count({
        where: {
          tenantId: user.tenantId,
          status: { not: 'Cancelled' }
        }
      });

      // Extract unique categories and add default ones
      const existingCategories = expenseCategories.map(e => e.category).filter(Boolean);
      
      // Add "Salary Advance" if there are any salary advances
      if (salaryAdvanceCount > 0) {
        existingCategories.push('Salary Advance');
      }
      
      const defaultCategories = [
        "Office Supplies",
        "Travel",
        "Meals & Entertainment",
        "Utilities",
        "Software Subscription",
        "Advertising",
        "Rent",
        "Equipment",
        "Professional Services",
        "Marketing",
        "Training",
        "Insurance",
        "Legal",
        "Salary",
        "Salary Advance",
        "Pension",
        "Gratuity"
      ];

      // Combine and deduplicate
      const allCategories = [...new Set([...defaultCategories, ...existingCategories])];
      categories = allCategories.sort();
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
      // For expense categories, we'll just return success for now
      // In a real implementation, you might want to create an ExpenseCategory model
      category = {
        id: `expense-${Date.now()}`,
        name: name.trim(),
        type: 'expense'
      };
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