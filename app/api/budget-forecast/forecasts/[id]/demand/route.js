import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import { getProductDemandHints } from '@/lib/budgetForecast/application/productDemandService';

export async function GET(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    await params; // forecast id reserved for future scoped filters
    const { searchParams } = new URL(request.url);
    const data = await getProductDemandHints(user.tenantId, {
      lookbackMonths: Number(searchParams.get('lookbackMonths') || 6),
      horizonMonths: Number(searchParams.get('horizonMonths') || 3),
      take: Number(searchParams.get('take') || 25),
    });
    return NextResponse.json({ success: true, data });
  });
}
