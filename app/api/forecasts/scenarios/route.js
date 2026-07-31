import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'Deprecated. Use /api/budget-forecast/forecasts with action=scenarios.',
      code: 'FORECAST_API_DEPRECATED',
      migrateTo: '/api/budget-forecast/forecasts',
    },
    { status: 410 }
  );
}
