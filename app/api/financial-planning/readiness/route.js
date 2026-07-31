import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import { assessPlanningReadiness } from '../../../../lib/financialPlanning/application/readinessService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, [
      PLANNING_PERMISSIONS.VIEW,
      PLANNING_PERMISSIONS.VIEW_DASHBOARD,
    ]);
    if (guard.response) return guard.response;
    const readiness = await assessPlanningReadiness(prisma, guard.context);
    return NextResponse.json({ readiness });
  } catch (error) {
    return accountingErrorResponse(error, 'assess planning readiness');
  }
}
