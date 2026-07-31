import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma.js';
import { guardCloseRoute, accountingErrorResponse } from '../../../../lib/accountingClose/api/routeGuard.js';
import { CLOSE_PERMISSIONS } from '../../../../lib/accountingClose/permissions.js';
import {
  buildReopeningImpactAnalysis,
  requestYearReopen,
  approveYearReopen,
  executeYearReopen,
} from '../../../../lib/accountingClose/application/reopenService.js';

export async function GET(request) {
  try {
    const guard = await guardCloseRoute(request, [
      CLOSE_PERMISSIONS.VIEW,
      CLOSE_PERMISSIONS.REQUEST_REOPEN,
    ]);
    if (guard.response) return guard.response;
    const financialYearId = new URL(request.url).searchParams.get('financialYearId');
    if (!financialYearId) {
      return NextResponse.json({ error: 'financialYearId required' }, { status: 400 });
    }
    const impact = await buildReopeningImpactAnalysis(prisma, guard.context, financialYearId);
    return NextResponse.json({ impact });
  } catch (error) {
    return accountingErrorResponse(error, 'reopen impact analysis');
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const action = body.action || 'request';

    const perm =
      action === 'approve'
        ? CLOSE_PERMISSIONS.APPROVE_REOPEN
        : action === 'execute'
          ? CLOSE_PERMISSIONS.REOPEN_YEAR
          : CLOSE_PERMISSIONS.REQUEST_REOPEN;

    const guard = await guardCloseRoute(request, perm);
    if (guard.response) return guard.response;

    if (action === 'request') {
      const req = await requestYearReopen(prisma, guard.context, body);
      return NextResponse.json({ request: req }, { status: 201 });
    }
    if (action === 'approve') {
      const req = await approveYearReopen(prisma, guard.context, body.requestId);
      return NextResponse.json({ request: req });
    }
    if (action === 'execute') {
      const result = await executeYearReopen(prisma, guard.context, body.requestId, {
        ...body,
        hasPermission: guard.can,
      });
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: `Unknown action ${action}` }, { status: 400 });
  } catch (error) {
    return accountingErrorResponse(error, 'year reopen');
  }
}
