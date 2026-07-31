/**
 * /api/accounting-v2/reports/kpis — canonical dashboard financial KPIs (§59).
 * Same calculation services as the formal statements; dashboards using this
 * endpoint always agree with reports for the same scope.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { getDashboardFinancialKpis } from '@/lib/accountingV2/reporting/dashboardKpiService.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.REPORTS_VIEW,
    ACCOUNTING_PERMISSIONS.VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const result = await getDashboardFinancialKpis(prisma, guard.context, {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      asOfDate: searchParams.get('asOfDate') || undefined,
      financialYearStartDate: searchParams.get('financialYearStartDate') || undefined,
      branchId: searchParams.get('branchId') || undefined,
    });
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'dashboard financial KPIs');
  }
}
