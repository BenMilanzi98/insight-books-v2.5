/**
 * /api/accounting-v2/reports/reconciliation — independent report
 * reconciliation service (§69) and unmapped-account report (§48).
 *
 * POST { fromDate, toDate, asOfDate?, branchId? } — cross-report reconciliation
 * GET  ?view=unmapped&... — unmapped account report
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import {
  runReportReconciliation,
  generateUnmappedAccountReport,
} from '@/lib/accountingV2/reporting/reportValidationService.js';
import { normalizeReportRequest } from '@/lib/accountingV2/reporting/reportContracts.js';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPORTS_VIEW_INTEGRITY]);
  if (guard.response) return guard.response;
  try {
    const body = await request.json().catch(() => ({}));
    const req = normalizeReportRequest(guard.context, 'TRIAL_BALANCE', body);
    const result = await runReportReconciliation(prisma, guard.context, req);
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'report reconciliation');
  }
}

export async function GET(request) {
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPORTS_VIEW_INTEGRITY]);
  if (guard.response) return guard.response;
  try {
    const { searchParams } = new URL(request.url);
    const req = normalizeReportRequest(guard.context, 'BALANCE_SHEET', {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      asOfDate: searchParams.get('asOfDate') || undefined,
    });
    const result = await generateUnmappedAccountReport(prisma, guard.context, req);
    return NextResponse.json(result);
  } catch (error) {
    return accountingErrorResponse(error, 'unmapped account report');
  }
}
