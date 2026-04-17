import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { replaceExpenseBudgetLines, listPeriodKeysInRange } from '@/lib/bfService';

export async function PUT(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'budgets.update')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const lines = body.lines ?? body;
    const row = await replaceExpenseBudgetLines(params.id, user.tenantId, lines);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const periodKeys = listPeriodKeysInRange(row.startDate, row.endDate, row.periodType);
    return NextResponse.json({ success: true, data: row, periodKeys });
  } catch (error) {
    console.error('bf expense-budget lines PUT:', error);
    return NextResponse.json({ error: error.message || 'Failed to save lines' }, { status: 400 });
  }
}
