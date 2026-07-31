import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  getPlanningConfiguration,
  upsertDraftPlanningConfiguration,
  approvePlanningConfiguration,
} from '../../../../lib/financialPlanning/application/configService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, [
      PLANNING_PERMISSIONS.VIEW,
      PLANNING_PERMISSIONS.MANAGE_CONFIGURATION,
    ]);
    if (guard.response) return guard.response;
    const configuration = await getPlanningConfiguration(prisma, guard.context.businessId);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'get planning configuration');
  }
}

export async function PUT(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.MANAGE_CONFIGURATION);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (body.action === 'approve') {
      const configuration = await approvePlanningConfiguration(prisma, guard.context);
      return NextResponse.json({ configuration });
    }
    const configuration = await upsertDraftPlanningConfiguration(prisma, guard.context, body);
    return NextResponse.json({ configuration });
  } catch (error) {
    return accountingErrorResponse(error, 'update planning configuration');
  }
}
