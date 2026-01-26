// app/api/budgets/[id]/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { updateBudget, approveBudget } from '@/lib/budgetService';
import prisma from '@/lib/prisma';

// GET - Get budget details
export async function GET(request, { params }) {
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

    const budget = await prisma.budget.findUnique({
      where: {
        id: params.id,
        tenantId: user.tenantId
      },
      include: {
        items: {
          orderBy: {
            period: 'asc'
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!budget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: budget
    });
  } catch (error) {
    console.error('Error fetching budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch budget' },
      { status: 500 }
    );
  }
}

// PUT - Update budget
export async function PUT(request, { params }) {
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

    // Check if budget exists and belongs to tenant
    const existingBudget = await prisma.budget.findUnique({
      where: {
        id: params.id,
        tenantId: user.tenantId
      }
    });

    if (!existingBudget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    // Can't update approved budgets
    if (existingBudget.status === 'approved' || existingBudget.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot update approved or active budgets. Create a new version instead.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const budget = await updateBudget(params.id, user.tenantId, body);

    return NextResponse.json({
      success: true,
      message: 'Budget updated successfully',
      data: budget
    });
  } catch (error) {
    console.error('Error updating budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update budget' },
      { status: 500 }
    );
  }
}

// DELETE - Delete budget
export async function DELETE(request, { params }) {
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

    const budget = await prisma.budget.findUnique({
      where: {
        id: params.id,
        tenantId: user.tenantId
      }
    });

    if (!budget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    // Can't delete approved budgets
    if (budget.status === 'approved' || budget.status === 'active') {
      return NextResponse.json(
        { error: 'Cannot delete approved or active budgets. Archive them instead.' },
        { status: 400 }
      );
    }

    await prisma.budget.delete({
      where: {
        id: params.id
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Budget deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete budget' },
      { status: 500 }
    );
  }
}










