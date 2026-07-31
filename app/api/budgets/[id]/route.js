// app/api/budgets/[id]/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  getBudgetById,
  updateRevenueBudget,
  deleteRevenueBudget,
  activateBudget,
  approveBudget,
  closeBudget,
  isBudgetLocked
} from '@/lib/budgetService';
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

    const budget = await getBudgetById(params.id, user.tenantId);

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

    // Check if budget exists and is not locked
    const existingBudget = await prisma.legacyBudget.findFirst({
      where: { id: params.id, tenantId: user.tenantId }
    });

    if (!existingBudget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    // Check if budget is locked
    if (isBudgetLocked(existingBudget)) {
      return NextResponse.json(
        { error: 'Cannot update a locked budget. The budget period has ended and the budget is now read-only.' },
        { status: 400 }
      );
    }

    if (existingBudget.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot update a closed budget' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const budget = await updateRevenueBudget(params.id, user.tenantId, user.id, body);

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

    const result = await deleteRevenueBudget(params.id, user.tenantId);

    return NextResponse.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error deleting budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete budget' },
      { status: 500 }
    );
  }
}

// PATCH - Activate, approve, or close budget
export async function PATCH(request, { params }) {
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
    const { action } = body;

    // Check if budget exists
    const existingBudget = await prisma.legacyBudget.findFirst({
      where: { id: params.id, tenantId: user.tenantId }
    });

    if (!existingBudget) {
      return NextResponse.json(
        { error: 'Budget not found' },
        { status: 404 }
      );
    }

    // Check if budget is locked for actions that modify it
    if (['activate', 'approve', 'close'].includes(action) && isBudgetLocked(existingBudget)) {
      return NextResponse.json(
        { error: 'Cannot modify a locked budget' },
        { status: 400 }
      );
    }

    let result;
    switch (action) {
      case 'activate':
        if (existingBudget.status !== 'draft') {
          return NextResponse.json(
            { error: 'Only draft budgets can be activated' },
            { status: 400 }
          );
        }
        result = await activateBudget(params.id, user.tenantId, user.id);
        return NextResponse.json({
          success: true,
          message: 'Budget activated successfully',
          data: result
        });

      case 'approve':
        if (existingBudget.status !== 'active') {
          return NextResponse.json(
            { error: 'Only active budgets can be approved' },
            { status: 400 }
          );
        }
        result = await approveBudget(params.id, user.tenantId, user.id);
        return NextResponse.json({
          success: true,
          message: 'Budget approved successfully',
          data: result
        });

      case 'close':
        result = await closeBudget(params.id, user.tenantId);
        return NextResponse.json({
          success: true,
          message: 'Budget closed successfully',
          data: result
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use activate, approve, or close' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error performing budget action:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform action' },
      { status: 500 }
    );
  }
}
