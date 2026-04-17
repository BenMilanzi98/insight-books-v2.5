import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { listRevenueForecasts, createRevenueForecast, BF_PERIOD_TYPES } from '@/lib/bfService';

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
    const rows = await listRevenueForecasts(user.tenantId, { status });
    return NextResponse.json({ success: true, data: rows, periodTypes: BF_PERIOD_TYPES });
  } catch (error) {
    console.error('bf revenue-forecasts GET:', error);
    return NextResponse.json({ error: error.message || 'Failed to list forecasts' }, { status: 500 });
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
    const row = await createRevenueForecast(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data: row });
  } catch (error) {
    console.error('bf revenue-forecasts POST:', error);
    return NextResponse.json({ error: error.message || 'Failed to create forecast' }, { status: 400 });
  }
}
