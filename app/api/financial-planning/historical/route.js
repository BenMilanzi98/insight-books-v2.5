import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import { buildHistoricalDataset } from '../../../../lib/financialPlanning/application/historicalDatasetService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.VIEW_FORECASTS);
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    const lookbackMonths = Number(searchParams.get('lookbackMonths') || 24);
    const dataset = await buildHistoricalDataset(prisma, guard.context, { lookbackMonths });
    return NextResponse.json({ dataset });
  } catch (error) {
    return accountingErrorResponse(error, 'build historical dataset');
  }
}
