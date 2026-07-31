import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../lib/accountingClose/permissions.js';
import { assessYearEndReadiness } from '../../../../lib/accountingClose/application/readinessService.js';

export async function GET(request) {
  try {
    const guard = await guardCloseRoute(request, [
      CLOSE_PERMISSIONS.VIEW,
      CLOSE_PERMISSIONS.RUN_READINESS,
    ]);
    if (guard.response) return guard.response;
    const financialYearId = new URL(request.url).searchParams.get('financialYearId');
    if (!financialYearId) {
      return NextResponse.json({ error: 'financialYearId required' }, { status: 400 });
    }
    const result = await assessYearEndReadiness(prisma, guard.context, { financialYearId });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'assess year-end readiness');
  }
}
