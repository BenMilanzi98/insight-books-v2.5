import { NextResponse } from 'next/server';
import { getUserFromSession, hasPermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { buildPlVsActualReport, buildBfDashboardOverview } from '@/lib/bfService';

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
    const expenseBudgetId = searchParams.get('expenseBudgetId') || '';
    const revenueForecastId = searchParams.get('revenueForecastId') || '';
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (!start || !end) {
      return NextResponse.json({ error: 'Query params start and end (ISO dates) are required.' }, { status: 400 });
    }

    const branchScope = (searchParams.get('branchScope') || 'all').toLowerCase();
    const branchScoped = branchScope === 'default' || branchScope === 'mine';
    const branchId = branchScoped ? user.defaultBranchId || null : null;

    if (!expenseBudgetId && !revenueForecastId) {
      const data = await buildBfDashboardOverview({
        tenantId: user.tenantId,
        branchScoped,
        branchId,
        reportStart: start,
        reportEnd: end,
      });
      return NextResponse.json({ success: true, data });
    }

    const data = await buildPlVsActualReport({
      tenantId: user.tenantId,
      branchScoped,
      branchId,
      expenseBudgetId: expenseBudgetId || null,
      revenueForecastId: revenueForecastId || null,
      reportStart: start,
      reportEnd: end,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('bf pl-vs-actual GET:', error);
    return NextResponse.json({ error: error.message || 'Failed to build report' }, { status: 400 });
  }
}
