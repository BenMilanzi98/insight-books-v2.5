// app/api/expenses/batch-delete/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { createExpenseReversal, validateReversalReason } from '@/lib/transactionReversalService';

// POST - Batch delete expenses
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
    const { expenseIds, reason = 'Batch expense removal from register' } = body;

    const reasonValidation = validateReversalReason(body.reversalReason || reason);
    if (!reasonValidation.isValid) {
      return NextResponse.json(
        {
          error: reasonValidation.error,
          hint: 'Provide reversalReason (or reason) with at least 10 characters for audit.'
        },
        { status: 400 }
      );
    }
    const auditReason = reasonValidation.reason;

    // Validate input
    if (!expenseIds || !Array.isArray(expenseIds) || expenseIds.length === 0) {
      return NextResponse.json(
        { error: 'Expense IDs are required and must be an array' },
        { status: 400 }
      );
    }

    if (expenseIds.length > 100) {
      return NextResponse.json(
        { error: 'Cannot delete more than 100 expenses at once' },
        { status: 400 }
      );
    }

    // Validate all expenses exist and belong to the user's tenant
    const expenses = await prisma.expense.findMany({
      where: {
        id: { in: expenseIds },
        tenantId: user.tenantId,
        isDeleted: false // Only allow deletion of non-deleted expenses
      },
      select: {
        id: true,
        description: true,
        amount: true,
        category: true,
        status: true,
        submittedById: true,
        isReversal: true
      }
    });

    if (expenses.length !== expenseIds.length) {
      const foundIds = expenses.map(e => e.id);
      const missingIds = expenseIds.filter(id => !foundIds.includes(id));
      return NextResponse.json(
        { 
          error: 'Some expenses were not found or already deleted',
          missingIds
        },
        { status: 404 }
      );
    }

    const reversalFailures = [];
    for (const expense of expenses) {
      if (expense.isReversal) continue;
      const postedJournal = await prisma.transaction.findFirst({
        where: {
          tenantId: user.tenantId,
          sourceType: 'Expense',
          sourceId: expense.id,
          status: 'posted',
          isReversal: false
        },
        select: { id: true }
      });
      if (!postedJournal) continue;

      const existingReversal = await prisma.expense.findFirst({
        where: {
          tenantId: user.tenantId,
          isReversal: true,
          reversedTransactionId: expense.id
        },
        select: { id: true }
      });
      if (existingReversal) continue;

      try {
        await createExpenseReversal({
          expenseId: expense.id,
          reversalReason: `${auditReason} (batch)`,
          userId: user.id,
          tenantId: user.tenantId
        });
      } catch (revErr) {
        reversalFailures.push({
          id: expense.id,
          error: revErr.message || 'Reversal failed'
        });
      }
    }

    if (reversalFailures.length > 0) {
      return NextResponse.json(
        {
          error: 'Some expenses could not be reversed in the general ledger. No expenses were soft-deleted.',
          reversalFailures
        },
        { status: 400 }
      );
    }

    // Perform batch soft delete (after successful reversals)
    const results = await prisma.$transaction(async (tx) => {
      const updateResult = await tx.expense.updateMany({
        where: {
          id: { in: expenseIds },
          tenantId: user.tenantId,
          isDeleted: false
        },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          deletedById: user.id,
          deletionReason: auditReason
        }
      });

      const auditEntries = expenses.map((expense) => ({
        action: 'EXPENSE_BATCH_DELETED_AFTER_REVERSAL',
        entityType: 'EXPENSE',
        entityId: expense.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          description: expense.description,
          amount: expense.amount,
          category: expense.category,
          status: expense.status,
          reversalReason: auditReason,
          batchOperation: true,
          canRestore: true
        })
      }));

      await tx.auditLog.createMany({
        data: auditEntries
      });

      return {
        deletedCount: updateResult.count,
        expenses: expenses.map((e) => ({
          id: e.id,
          description: e.description,
          amount: e.amount
        }))
      };
    });

    return NextResponse.json({
      message: `Successfully deleted ${results.deletedCount} expenses`,
      deletedCount: results.deletedCount,
      expenses: results.expenses
    });

  } catch (error) {
    console.error('Error in batch delete expenses:', error);
    return NextResponse.json(
      { error: 'Failed to delete expenses. Please try again.' },
      { status: 500 }
    );
  }
}
