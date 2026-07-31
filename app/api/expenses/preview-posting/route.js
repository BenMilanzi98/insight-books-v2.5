import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { previewExpensePosting } from '@/lib/expenses/expensePostingPreview.js';

/**
 * POST /api/expenses/preview-posting
 * Body: { expenseId } or expense draft fields.
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'expenses.view');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    let expense = null;

    if (body.expenseId) {
      expense = await prisma.expense.findFirst({
        where: {
          id: String(body.expenseId),
          tenantId: user.tenantId,
          isDeleted: false,
        },
      });
      if (!expense) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }
    } else if (body.expense && typeof body.expense === 'object') {
      expense = { ...body.expense, tenantId: user.tenantId };
    } else if (body.amount != null || body.expenseAccountId) {
      expense = { ...body, tenantId: user.tenantId };
    } else {
      return NextResponse.json(
        { error: 'Provide expenseId or expense fields (amount, expenseAccountId, …)' },
        { status: 400 }
      );
    }

    const preview = await previewExpensePosting({
      tenantId: user.tenantId,
      userId: user.id,
      expense,
      db: prisma,
    });

    return NextResponse.json({ preview });
  } catch (error) {
    console.error('expense preview-posting:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview expense posting' },
      { status: 500 }
    );
  }
}
