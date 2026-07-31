import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { listBudgets, createBudget } from '@/lib/budgetForecast/application/budgetService';

/** @deprecated Use /api/budget-forecast/budgets */
export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const data = await listBudgets(user.tenantId);
    return NextResponse.json({
      success: true,
      data,
      deprecated: true,
      migrateTo: '/api/budget-forecast/budgets',
    });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, 'budgets.create', async (user) => {
    const body = await request.json();
    const data = await createBudget(user.tenantId, user.id, body);
    return NextResponse.json({
      success: true,
      data,
      deprecated: true,
      migrateTo: '/api/budget-forecast/budgets',
    });
  });
}
