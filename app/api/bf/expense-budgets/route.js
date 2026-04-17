import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { listExpenseBudgets, createExpenseBudget, BF_PERIOD_TYPES } from '@/lib/bfService';

export async function GET(request) {
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const rows = await listExpenseBudgets(user.tenantId, { status });
    return NextResponse.json({ success: true, data: rows, periodTypes: BF_PERIOD_TYPES });
  } catch (error) {
    console.error('bf expense-budgets GET:', error);
    return NextResponse.json({ error: error.message || 'Failed to list budgets' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!hasPermission(user, 'budgets.create')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const row = await createExpenseBudget(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('bf expense-budgets POST:', error);
    return NextResponse.json({ error: error.message || 'Failed to create budget' }, { status: 400 });
  }
}
