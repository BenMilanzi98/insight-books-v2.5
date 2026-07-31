import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { getForecast, deleteForecast } from '@/lib/budgetForecast/application/forecastService';

export async function GET(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { id } = await params;
    const data = await getForecast(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}

export async function DELETE(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.delete', async (user) => {
    const { id } = await params;
    const data = await deleteForecast(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}
