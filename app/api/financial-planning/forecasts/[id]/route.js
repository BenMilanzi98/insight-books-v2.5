import { NextResponse } from 'next/server';
import prisma from '../../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../../lib/financialPlanning/permissions.js';
import {
  getForecastVersion,
  calculateForecastVersion,
  approveForecastVersion,
  createManualOverride,
} from '../../../../../lib/financialPlanning/application/forecastService.js';

export async function GET(request, { params }) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.VIEW_FORECASTS);
    if (guard.response) return guard.response;
    const { id } = await params;
    const version = await getForecastVersion(prisma, guard.context.businessId, id);
    return NextResponse.json({
      version,
      disclaimer:
        'Projections are planning estimates, not guaranteed outcomes. Forecast values never post to the General Ledger.',
    });
  } catch (error) {
    return accountingErrorResponse(error, 'get forecast version');
  }
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.action === 'calculate') {
      const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.RECALCULATE_FORECAST);
      if (guard.response) return guard.response;
      const version = await calculateForecastVersion(prisma, guard.context, id, body);
      return NextResponse.json({ version });
    }
    if (body.action === 'approve') {
      const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.APPROVE_FORECAST);
      if (guard.response) return guard.response;
      const version = await approveForecastVersion(prisma, guard.context, id);
      return NextResponse.json({ version });
    }
    if (body.action === 'override') {
      const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.CREATE_OVERRIDES);
      if (guard.response) return guard.response;
      const override = await createManualOverride(prisma, guard.context, id, body);
      return NextResponse.json({ override }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'action must be calculate, approve, or override' },
      { status: 400 }
    );
  } catch (error) {
    return accountingErrorResponse(error, 'forecast version action');
  }
}
