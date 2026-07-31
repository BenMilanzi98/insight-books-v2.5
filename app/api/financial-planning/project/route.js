import { NextResponse } from 'next/server';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import { projectThreeStatements } from '../../../../lib/financialPlanning/domain/threeStatementEngine.js';
import { parseToMinor } from '../../../../lib/financialPlanning/domain/money.js';

/**
 * Stateless projection preview (server-side). Does not persist and never writes GL.
 */
export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, [
      PLANNING_PERMISSIONS.VIEW_FORECASTS,
      PLANNING_PERMISSIONS.RECALCULATE_FORECAST,
    ]);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (!body.opening) {
      return NextResponse.json({ error: 'opening Balance Sheet required' }, { status: 400 });
    }
    const result = projectThreeStatements({
      opening: body.opening,
      baseRevenueMinor:
        body.baseRevenueMinor != null
          ? BigInt(body.baseRevenueMinor)
          : parseToMinor(body.baseRevenue || '0'),
      months: body.months || 12,
      assumptions: body.assumptions || {},
      labels: body.labels,
    });
    return NextResponse.json({
      result,
      neverPostsToGl: true,
      disclaimer: result.disclaimer,
    });
  } catch (error) {
    return accountingErrorResponse(error, 'project three statements');
  }
}
