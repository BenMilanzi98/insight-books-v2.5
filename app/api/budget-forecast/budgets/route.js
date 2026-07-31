import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  listBudgets,
  createBudget,
  getBudgetDashboard,
  generateFromActuals,
  generateFromRunRate,
  copyBudget,
} from '@/lib/budgetForecast/application/budgetService';

export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('dashboard') === '1') {
      const data = await getBudgetDashboard(user.tenantId);
      return NextResponse.json({ success: true, data });
    }
    const status = searchParams.get('status') || undefined;
    const data = await listBudgets(user.tenantId, { status });
    return NextResponse.json({ success: true, data });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, ['budgets.create', 'budgets.update'], async (user) => {
    const body = await request.json();
    const action = body.action || 'create';

    if (action === 'generateFromActuals') {
      if (!hasCreate(user)) return forbidden();
      const data = await generateFromActuals(user.tenantId, user.id, body);
      return NextResponse.json({ success: true, data });
    }
    if (action === 'generateFromRunRate') {
      const data = await generateFromRunRate(user.tenantId, user.id, body);
      return NextResponse.json({ success: true, data });
    }
    if (action === 'copy') {
      const data = await copyBudget(user.tenantId, body.sourceBudgetId, user.id, body);
      return NextResponse.json({ success: true, data });
    }

    const data = await createBudget(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data });
  });
}

function hasCreate() {
  return true;
}
function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
