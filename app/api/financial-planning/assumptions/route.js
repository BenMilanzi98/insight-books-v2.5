import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  ensureDraftAssumptionSet,
  upsertAssumption,
  approveAssumptionSet,
} from '../../../../lib/financialPlanning/application/assumptionService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, [
      PLANNING_PERMISSIONS.VIEW_FORECASTS,
      PLANNING_PERMISSIONS.MANAGE_ASSUMPTIONS,
    ]);
    if (guard.response) return guard.response;
    const { searchParams } = new URL(request.url);
    const scenarioId = searchParams.get('scenarioId');
    if (!scenarioId) {
      return NextResponse.json({ error: 'scenarioId required' }, { status: 400 });
    }
    const assumptionSet = await ensureDraftAssumptionSet(prisma, guard.context, scenarioId);
    return NextResponse.json({ assumptionSet });
  } catch (error) {
    return accountingErrorResponse(error, 'get assumptions');
  }
}

export async function PUT(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.MANAGE_ASSUMPTIONS);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'approve') {
      const assumptionSet = await approveAssumptionSet(prisma, guard.context, body.assumptionSetId);
      return NextResponse.json({ assumptionSet });
    }
    const assumption = await upsertAssumption(prisma, guard.context, body.assumptionSetId, body);
    return NextResponse.json({ assumption });
  } catch (error) {
    return accountingErrorResponse(error, 'update assumptions');
  }
}
