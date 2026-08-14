/**
 * /api/accounting-v2/reports/generate — canonical report generation.
 *
 * GET  ?type=TRIAL_BALANCE&fromDate=&toDate=&asOfDate=&branchId=&
 *       comparisonFromDate=&comparisonToDate=&includeZeroBalances=&cache=1
 *
 * Business always comes from the session. No raw report SQL and no arbitrary
 * account queries are accepted from clients.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { generateReport } from '@/lib/accountingV2/reporting/financialReportService.js';
import { permissionsForReportType } from '@/lib/accountingV2/reporting/reportPermissions.js';
import { REPORT_TYPES } from '@/lib/accountingV2/reporting/reportTypes.js';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reportType = String(searchParams.get('type') ?? '').toUpperCase();
  if (!REPORT_TYPES[reportType]) {
    return NextResponse.json({ error: `Unknown report type: ${reportType}` }, { status: 400 });
  }
  const guard = await guardAccountingRoute(request, permissionsForReportType(reportType));
  if (guard.response) return guard.response;
  try {
    const params = {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      asOfDate: searchParams.get('asOfDate') || undefined,
      financialYearStartDate: searchParams.get('financialYearStartDate') || undefined,
      comparisonFromDate: searchParams.get('comparisonFromDate') || undefined,
      comparisonToDate: searchParams.get('comparisonToDate') || undefined,
      comparisonAsOfDate: searchParams.get('comparisonAsOfDate') || undefined,
      branchId: searchParams.get('branchId') || undefined,
      includeZeroBalances: searchParams.get('includeZeroBalances') === '1',
      reportDefinitionVersion: searchParams.get('definitionVersion') || undefined,
      groupBy: searchParams.get('groupBy') || undefined,
      reportBasis: searchParams.get('reportBasis') || searchParams.get('accountingMethod') || undefined,
      breakdown: searchParams.get('breakdown') || undefined,
      currency: searchParams.get('currency') || undefined,
      // P&L: default on so CIT applies to the selected period (incl. pre-enable activity).
      applyCitProvision:
        reportType === 'INCOME_STATEMENT'
          ? searchParams.get('applyCitProvision') !== 'false'
          : searchParams.get('applyCitProvision') === 'true',
    };
    const { envelope } = await generateReport(prisma, guard.context, reportType, params, {
      useCache: searchParams.get('cache') === '1',
    });
    return NextResponse.json(envelope);
  } catch (error) {
    return accountingErrorResponse(error, `generate ${reportType} report`);
  }
}
