import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../lib/financialPlanning/permissions.js';
import {
  createForecastCycle,
  listForecastCycles,
  createForecastVersion,
  createRollingForecastVersion,
} from '../../../../lib/financialPlanning/application/forecastService.js';

export async function GET(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.VIEW_FORECASTS);
    if (guard.response) return guard.response;
    const cycles = await listForecastCycles(prisma, guard.context.businessId);
    return NextResponse.json({ cycles });
  } catch (error) {
    return accountingErrorResponse(error, 'list forecast cycles');
  }
}

export async function POST(request) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.CREATE_FORECAST);
    if (guard.response) return guard.response;
    const body = await request.json();

    if (body.action === 'createCycle') {
      const cycle = await createForecastCycle(prisma, guard.context, body);
      return NextResponse.json({ cycle }, { status: 201 });
    }
    if (body.action === 'createVersion') {
      const version = await createForecastVersion(prisma, guard.context, body);
      return NextResponse.json({ version }, { status: 201 });
    }
    if (body.action === 'rolling') {
      const version = await createRollingForecastVersion(
        prisma,
        guard.context,
        body.sourceForecastVersionId,
        body
      );
      return NextResponse.json({ version }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'action must be createCycle, createVersion, or rolling' },
      { status: 400 }
    );
  } catch (error) {
    return accountingErrorResponse(error, 'create forecast');
  }
}
