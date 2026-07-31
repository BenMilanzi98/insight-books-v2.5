/**
 * /api/accounting-v2/reports/drill-down — line-level and account-level
 * drill-down. Filters always preserve the report's business/date scope.
 *
 * POST { reportType, params, lineId, page?, pageSize? }
 *   regenerates the report canonically and drills into one line
 *   (sum of drill-down items must equal the line — REP-025 disclosed).
 * GET  ?accountId=&fromDate=&toDate=&branchId=&page=&pageSize=
 *   account-level General Ledger drill-down (Trial Balance rows).
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { generateReport } from '@/lib/accountingV2/reporting/financialReportService.js';
import { drillDownReportLine } from '@/lib/accountingV2/reporting/reportDrillDownService.js';
import { permissionsForReportType } from '@/lib/accountingV2/reporting/reportPermissions.js';
import { getAccountLedger } from '@/lib/accountingV2/ledger/ledgerQueryService.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const reportType = String(body.reportType ?? '').toUpperCase();
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.REPORTS_VIEW_DRILL_DOWN,
    ...permissionsForReportType(reportType),
  ]);
  if (guard.response) return guard.response;
  try {
    const { envelope } = await generateReport(prisma, guard.context, reportType, body.params ?? {}, {
      recordRun: false,
    });
    const drill = await drillDownReportLine(prisma, guard.context, envelope, body.lineId, {
      page: body.page,
      pageSize: body.pageSize,
    });
    return NextResponse.json(drill);
  } catch (error) {
    return accountingErrorResponse(error, 'report drill-down');
  }
}

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [
    ACCOUNTING_PERMISSIONS.REPORTS_VIEW_DRILL_DOWN,
    ACCOUNTING_PERMISSIONS.LEDGER_VIEW,
  ]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const ledger = await getAccountLedger(prisma, guard.context, {
      accountId: searchParams.get('accountId'),
      startDate: searchParams.get('fromDate') ? new Date(searchParams.get('fromDate')) : undefined,
      endDate: searchParams.get('toDate') ? new Date(searchParams.get('toDate')) : undefined,
      branchId: searchParams.get('branchId') || null,
      page: Number(searchParams.get('page') ?? 1),
      pageSize: Number(searchParams.get('pageSize') ?? 50),
    });
    return NextResponse.json(ledger);
  } catch (error) {
    return accountingErrorResponse(error, 'account drill-down');
  }
}
