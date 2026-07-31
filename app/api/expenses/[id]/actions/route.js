import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { postApprovedExpenseJournalIfMissing } from '@/lib/expenseGlPosting';
import {
  EXPENSE_STATUSES,
  assertExpenseTransition,
  canEditDraft,
  normalizeExpenseStatus,
} from '@/lib/expenses/expenseStateMachine';

/**
 * POST /api/expenses/[id]/actions
 * Body: { action: 'submit' | 'approve' | 'reject' | 'request_changes' | 'post' }
 */
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || '').trim().toLowerCase();

    const needsApprovePerm = ['approve', 'reject', 'post'].includes(action);
    const perm = await requirePermission(
      request,
      needsApprovePerm ? 'expenses.approve' : 'expenses.update'
    );
    if (perm) return perm;

    const expense = await prisma.expense.findFirst({
      where: { id, tenantId: user.tenantId, isDeleted: false },
    });
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    const current = normalizeExpenseStatus(expense.status) || EXPENSE_STATUSES.DRAFT;
    let nextStatus = null;

    switch (action) {
      case 'submit':
        nextStatus = EXPENSE_STATUSES.SUBMITTED;
        break;
      case 'approve':
        nextStatus = EXPENSE_STATUSES.APPROVED;
        break;
      case 'reject':
        nextStatus = EXPENSE_STATUSES.REJECTED;
        break;
      case 'request_changes':
        nextStatus = EXPENSE_STATUSES.PENDING;
        break;
      case 'post':
        // Post GL for already-approved expense (idempotent)
        if (!canEditDraft(current) && current !== EXPENSE_STATUSES.APPROVED) {
          return NextResponse.json(
            { error: `Cannot post expense in status "${expense.status}"`, code: 'EXPENSE_NOT_POSTABLE' },
            { status: 409 }
          );
        }
        if (current !== EXPENSE_STATUSES.APPROVED) {
          assertExpenseTransition(current, EXPENSE_STATUSES.APPROVED);
          nextStatus = EXPENSE_STATUSES.APPROVED;
        } else {
          nextStatus = EXPENSE_STATUSES.APPROVED;
        }
        break;
      default:
        return NextResponse.json(
          {
            error: 'Unknown action. Use submit, approve, reject, request_changes, or post.',
            code: 'EXPENSE_UNKNOWN_ACTION',
          },
          { status: 400 }
        );
    }

    try {
      if (current !== nextStatus) {
        assertExpenseTransition(current, nextStatus);
      }
    } catch (err) {
      return NextResponse.json(
        { error: err.message, code: err.code || 'EXPENSE_INVALID_TRANSITION' },
        { status: 409 }
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.expense.update({
        where: { id },
        data: { status: nextStatus },
      });
      if (nextStatus === EXPENSE_STATUSES.APPROVED) {
        await postApprovedExpenseJournalIfMissing({
          tx,
          tenantId: user.tenantId,
          userId: user.id,
          expense: row,
        });
      }
      return row;
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: `EXPENSE_${action.toUpperCase()}`,
          entityType: 'EXPENSE',
          entityId: id,
          userId: user.id,
          tenantId: user.tenantId,
          details: JSON.stringify({ from: current, to: nextStatus, action }),
        },
      });
    } catch {
      /* non-blocking */
    }

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        status: updated.status,
        from: current,
        to: nextStatus,
        action,
      },
    });
  } catch (error) {
    console.error('Expense action failed:', error);
    const status =
      error?.code === 'EXPENSE_INVALID_TRANSITION' ||
      error?.code?.startsWith('EXPENSE_GL')
        ? 400
        : 500;
    return NextResponse.json(
      { error: error.message || 'Expense action failed', code: error.code },
      { status }
    );
  }
}
