// app/api/expenses/restore/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';

// POST - Restore a deleted expense
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { expenseId, reason = 'Manual restoration' } = body;

    // Validate input
    if (!expenseId) {
      return NextResponse.json(
        { error: 'Expense ID is required' },
        { status: 400 }
      );
    }

    // Find the deleted expense
    const expense = await prisma.expense.findUnique({
      where: { 
        id: expenseId,
        tenantId: user.tenantId,
        isDeleted: true
      },
      include: {
        deletedBy: {
          select: { name: true }
        }
      }
    });

    if (!expense) {
      return NextResponse.json(
        { error: 'Deleted expense not found' },
        { status: 404 }
      );
    }

    // Restore the expense
    await prisma.$transaction(async (tx) => {
      // Restore the expense
      await tx.expense.update({
        where: { id: expenseId },
        data: {
          isDeleted: false,
          deletedAt: null,
          deletedById: null,
          deletionReason: null
        }
      });

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          action: 'EXPENSE_RESTORED',
          entityType: 'EXPENSE',
          entityId: expenseId,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            status: expense.status,
            restorationReason: reason,
            originalDeletionDate: expense.deletedAt,
            originalDeletionReason: expense.deletionReason,
            deletedBy: expense.deletedBy?.name
          })
        }
      });
    });

    return NextResponse.json({
      message: 'Expense restored successfully',
      expense: {
        id: expense.id,
        description: expense.description,
        amount: expense.amount,
        category: expense.category
      }
    });

  } catch (error) {
    console.error('Error restoring expense:', error);
    return NextResponse.json(
      { error: 'Failed to restore expense. Please try again.' },
      { status: 500 }
    );
  }
}
