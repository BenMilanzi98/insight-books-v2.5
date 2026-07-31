import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { migrateBfToGreenfield } from '@/lib/budgetForecast/migration/migrateFromBf';

export async function POST(request) {
  return withBudgetForecastAuth(request, 'budgets.create', async (user) => {
    const data = await migrateBfToGreenfield(user.tenantId, { userId: user.id });
    return NextResponse.json({ success: true, data });
  });
}
