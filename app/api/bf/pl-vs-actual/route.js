/** @deprecated Use /api/budget-forecast/reports */
import { NextResponse } from 'next/server';

const GONE = {
  error: 'Deprecated. Use /api/budget-forecast/reports.',
  code: 'LEGACY_BUDGET_API_DISABLED',
  migrateTo: '/api/budget-forecast/reports',
  use: '/api/budget-forecast/reports',
};

export async function GET() {
  return NextResponse.json(GONE, { status: 410 });
}
