import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../lib/accountingClose/permissions.js';
import {
  createYearEndCloseRun,
  listCloseRuns,
} from '../../../../lib/accountingClose/application/closeRunService.js';

export async function GET(request) {
  try {
    const guard = await guardCloseRoute(request, CLOSE_PERMISSIONS.VIEW);
    if (guard.response) return guard.response;
    const financialYearId = new URL(request.url).searchParams.get('financialYearId') || undefined;
    const runs = await listCloseRuns(prisma, guard.context, { financialYearId });
    return NextResponse.json({ runs });
  } catch (error) {
    return accountingErrorResponse(error, 'list close runs');
  }
}

export async function POST(request) {
  try {
    const guard = await guardCloseRoute(request, CLOSE_PERMISSIONS.CREATE_RUN);
    if (guard.response) return guard.response;
    const body = await request.json();
    if (!body.financialYearId) {
      return NextResponse.json({ error: 'financialYearId required' }, { status: 400 });
    }
    const run = await createYearEndCloseRun(prisma, guard.context, {
      financialYearId: body.financialYearId,
    });
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return accountingErrorResponse(error, 'create close run');
  }
}
