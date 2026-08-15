import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  generateForecastAiSuggestions,
  listForecastAiSuggestions,
  reviewForecastAiSuggestion,
} from '@/lib/budgetForecast/application/aiSuggestionService';

export async function GET(request) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { searchParams } = new URL(request.url);
    const data = await listForecastAiSuggestions(user.tenantId, {
      forecastId: searchParams.get('forecastId') || undefined,
      status: searchParams.get('status') || undefined,
    });
    return NextResponse.json({ success: true, data });
  });
}

export async function POST(request) {
  return withBudgetForecastAuth(request, ['budgets.create', 'budgets.update'], async (user) => {
    const body = await request.json();
    if (body.action === 'review' || body.suggestionId) {
      const data = await reviewForecastAiSuggestion(user.tenantId, user.id, body.suggestionId, body);
      return NextResponse.json({ success: true, data });
    }
    const data = await generateForecastAiSuggestions(user.tenantId, user.id, body);
    return NextResponse.json({ success: true, data });
  });
}
