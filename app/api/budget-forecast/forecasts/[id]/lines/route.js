import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { saveForecastLines } from '@/lib/budgetForecast/application/forecastService';

export async function PUT(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.update', async (user) => {
    const { id } = await params;
    const body = await request.json();
    if (!Object.prototype.hasOwnProperty.call(body, 'lines')) {
      return NextResponse.json(
        { error: 'lines array is required', code: 'INVALID_LINES' },
        { status: 400 }
      );
    }
    const data = await saveForecastLines(user.tenantId, id, body.lines || []);
    return NextResponse.json({ success: true, data });
  });
}
