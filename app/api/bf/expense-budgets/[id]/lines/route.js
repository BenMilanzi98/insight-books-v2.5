/** @deprecated Use /api/budget-forecast/budgets/[id]/lines */
import { NextResponse } from 'next/server';

const GONE = {
  error: 'Deprecated. Use /api/budget-forecast/budgets.',
  code: 'LEGACY_BUDGET_API_DISABLED',
  migrateTo: '/api/budget-forecast/budgets',
  use: '/api/budget-forecast/budgets',
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function PUT() {
  return NextResponse.json(GONE, { status: 410 });
}
