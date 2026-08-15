import { NextResponse } from 'next/server';
import { withBudgetForecastAuth } from '@/lib/budgetForecast/http';
import {
  getAssumptionSet,
  updateAssumptionSet,
  deleteAssumptionSet,
} from '@/lib/budgetForecast/application/assumptionService';

export async function GET(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.view', async (user) => {
    const { id } = await params;
    const data = await getAssumptionSet(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}

export async function PUT(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.update', async (user) => {
    const { id } = await params;
    const body = await request.json();
    const data = await updateAssumptionSet(user.tenantId, id, body);
    return NextResponse.json({ success: true, data });
  });
}

export async function DELETE(request, { params }) {
  return withBudgetForecastAuth(request, 'budgets.update', async (user) => {
    const { id } = await params;
    const data = await deleteAssumptionSet(user.tenantId, id);
    return NextResponse.json({ success: true, data });
  });
}
