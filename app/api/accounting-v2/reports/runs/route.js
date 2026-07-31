/**
 * /api/accounting-v2/reports/runs — report run audit trail.
 * GET ?reportType=&page=&pageSize=
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { listReportRuns } from '@/lib/accountingV2/reporting/reportRunService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.REPORTS_VIEW,
    ACCOUNTING_PERMISSIONS.REPORTS_VIEW_INTEGRITY,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const result = await listReportRuns(prisma, guard.context, {
      reportType: searchParams.get('reportType') || null,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'list report runs');
  }
}
