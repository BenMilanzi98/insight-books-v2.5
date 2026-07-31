import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  ensureDefaultScenarios,
  listScenarios,
  createCustomScenario,
  cloneScenario,
} from '../../../../lib/financialPlanning/application/scenarioService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, [
      PLANNING_PERMISSIONS.VIEW_FORECASTS,
      PLANNING_PERMISSIONS.MANAGE_SCENARIOS,
    ]);
    if (guard.response) return guard.response;
    await ensureDefaultScenarios(prisma, guard.context);
    const scenarios = await listScenarios(prisma, guard.context.businessId);
    return NextResponse.json({ scenarios });
  } catch (error) {
    return accountingErrorResponse(error, 'list scenarios');
  }
}

export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.MANAGE_SCENARIOS);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'clone') {
      const scenario = await cloneScenario(prisma, guard.context, body.sourceScenarioId, body);
      return NextResponse.json({ scenario }, { status: 201 });
    }
    const scenario = await createCustomScenario(prisma, guard.context, body);
    return NextResponse.json({ scenario }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create scenario');
  }
}
