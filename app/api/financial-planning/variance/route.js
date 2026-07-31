import { NextResponse } from 'next/server';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import { computeVariance } from '../../../../lib/financialPlanning/domain/threeStatementEngine.js';

export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.VIEW_FORECASTS);
    if (guard.response) return guard.response;
    const body = await request.json();
    const lines = Array.isArray(body.lines) ? body.lines : [];
    const results = lines.map((line) => ({
      key: line.key,
      lineType: line.lineType || 'EXPENSE',
      ...computeVariance(line.actualMinor, line.comparisonMinor, line.lineType || 'EXPENSE'),
    }));
    return NextResponse.json({
      results,
      note: 'Favourability is line-type aware. Totals are server-calculated.',
    });
  } catch (error) {
    return accountingErrorResponse(error, 'variance analysis');
  }
}
