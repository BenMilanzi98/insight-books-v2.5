import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import {
  getExpenseBudget,
  updateExpenseBudget,
  deleteExpenseBudget,
  listPeriodKeysInRange,
} from '@/lib/bfService';

export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'budgets.view')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = await getExpenseBudget(params.id, user.tenantId);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const periodKeys = listPeriodKeysInRange(row.startDate, row.endDate, row.periodType);
    return NextResponse.json({ success: true, data: row, periodKeys });
  } catch (error) {
    console.error('bf expense-budget GET:', error);
    return NextResponse.json({ error: error.message || 'Failed to load' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
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
    const row = await updateExpenseBudget(params.id, user.tenantId, body);
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('bf expense-budget PATCH:', error);
    return NextResponse.json({ error: error.message || 'Failed to update' }, { status: 400 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'budgets.delete')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ok = await deleteExpenseBudget(params.id, user.tenantId);
    if (!ok) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('bf expense-budget DELETE:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete' }, { status: 500 });
  }
}
