import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  listForecasts,
  createForecast,
  getForecastDashboard,
  generateRollingForecast,
  generateCashFlowForecast,
  createScenarioForecasts,
} from '@/lib/budgetForecast/application/forecastService';

export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('dashboard') === '1') {
      const data = await getForecastDashboard(user.tenantId);
      return NextResponse.json({ success: true, data });
    }
    const data = await listForecasts(user.tenantId);
    return NextResponse.json({ success: true, data });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, ['budgets.create', 'budgets.update'], async (user) => {
    const body = await request.json();
    const action = body.action || 'create';
    if (action === 'rolling') {
      const data = await generateRollingForecast(user.tenantId, user.id, body);
      return NextResponse.json({ success: true, data });
    }
    if (action === 'cashFlow') {
      const data = await generateCashFlowForecast(user.tenantId, user.id, body);
      return NextResponse.json({ success: true, data });
    }
    if (action === 'scenarios') {
      const data = await createScenarioForecasts(user.tenantId, user.id, body);
      return NextResponse.json({ success: true, data });
    }
    const data = await createForecast(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data });
  });
}
