import { NextResponse } from 'next/server';

/** @deprecated Heuristic forecasts replaced by /api/budget-forecast/forecasts */
export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated. Use /api/budget-forecast/forecasts with action=rolling.',
      code: 'FORECAST_API_DEPRECATED',
      migrateTo: '/api/budget-forecast/forecasts',
    },
    { status: 410 }
  );
}
