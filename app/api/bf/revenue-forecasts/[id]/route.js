/** @deprecated Use /api/budget-forecast/forecasts/[id] */
import { NextResponse } from 'next/server';

const GONE = {
  error: 'Deprecated. Use /api/budget-forecast/forecasts.',
  code: 'LEGACY_BUDGET_API_DISABLED',
  migrateTo: '/api/budget-forecast/forecasts',
  use: '/api/budget-forecast/forecasts',
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function PATCH() {
  return NextResponse.json(GONE, { status: 410 });
}

export async function DELETE() {
  return NextResponse.json(GONE, { status: 410 });
}
