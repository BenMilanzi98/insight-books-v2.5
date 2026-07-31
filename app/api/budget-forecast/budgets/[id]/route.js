import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { getBudget, deleteBudget } from '@/lib/budgetForecast/application/budgetService';

export async function GET(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { id } = await params;
    const data = await getBudget(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}

export async function DELETE(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.delete', async (user) => {
    const { id } = await params;
    const data = await deleteBudget(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}
