import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  listAssumptionSets,
  createAssumptionSet,
} from '@/lib/budgetForecast/application/assumptionService';

export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const data = await listAssumptionSets(user.tenantId);
    return NextResponse.json({ success: true, data });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, ['budgets.create', 'budgets.update'], async (user) => {
    const body = await request.json();
    const data = await createAssumptionSet(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data });
  });
}
