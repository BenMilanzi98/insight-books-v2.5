/**
 * /api/accounting-v2/reports/export — CSV / Excel / PDF exports.
 *
 * GET ?type=INCOME_STATEMENT&format=csv|xlsx|pdf&<report filters>
 *
 * The export consumes the SAME completed result the screen shows (one
 * generation, one calculation service — REP-026). Every export is audited.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { guardAccountingRoute, accountingErrorResponse } from '@/lib/accountingV2/api/routeGuard.js';
import { ACCOUNTING_PERMISSIONS } from '@/lib/accountingV2/permissions.js';
import { generateReport } from '@/lib/accountingV2/reporting/financialReportService.js';
import { permissionsForReportType } from '@/lib/accountingV2/reporting/reportPermissions.js';
import {
  exportReportToCsv,
  exportReportToExcel,
  exportReportToPdf,
} from '@/lib/accountingV2/reporting/reportExportService.js';
import { recordAccountingAudit } from '@/lib/accountingV2/infrastructure/auditTrail.js';

export const dynamic = 'force-dynamic';

const CONTENT_TYPES = {
  csv: 'text/csv; charset=utf-8',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pdf: 'application/pdf',
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const reportType = String(searchParams.get('type') ?? '').toUpperCase();
  const format = String(searchParams.get('format') ?? 'csv').toLowerCase();
  const guard = await guardAccountingRoute(request, [ACCOUNTING_PERMISSIONS.REPORTS_EXPORT]);
  if (guard.response) return guard.response;
  const typeGuard = await guardAccountingRoute(request, permissionsForReportType(reportType));
  if (typeGuard.response) return typeGuard.response;
  if (!CONTENT_TYPES[format]) {
    return NextResponse.json({ error: `Unsupported format: ${format}` }, { status: 400 });
  }
  try {
    const params = {
      fromDate: searchParams.get('fromDate') || undefined,
      toDate: searchParams.get('toDate') || undefined,
      asOfDate: searchParams.get('asOfDate') || undefined,
      financialYearStartDate: searchParams.get('financialYearStartDate') || undefined,
      branchId: searchParams.get('branchId') || undefined,
      includeZeroBalances: searchParams.get('includeZeroBalances') === '1',
      groupBy: searchParams.get('groupBy') || undefined,
      reportBasis: searchParams.get('reportBasis') || searchParams.get('accountingMethod') || undefined,
      breakdown: searchParams.get('breakdown') || undefined,
      currency: searchParams.get('currency') || undefined,
      applyCitProvision:
        reportType === 'INCOME_STATEMENT'
          ? searchParams.get('applyCitProvision') !== 'false'
          : searchParams.get('applyCitProvision') === 'true',
    };
    const { envelope } = await generateReport(prisma, guard.context, reportType, params, {
      recordRun: false,
    });

    let body;
    if (format === 'csv') body = exportReportToCsv(envelope);
    else if (format === 'xlsx') body = await exportReportToExcel(envelope);
    else body = await exportReportToPdf(envelope);

    await recordAccountingAudit(
      {
        action: 'acctv2.report.export',
        entityType: 'AcctV2Report',
        entityId: envelope.reportId,
        userId: guard.context.userId,
        tenantId: guard.context.businessId,
        newValues: {
          reportType,
          format,
          filtersHash: envelope.filtersHash,
          definitionVersion: envelope.definitionVersion,
          integrityStatus: envelope.integrityStatus,
        },
        requestId: guard.context.requestId,
        correlationId: guard.context.correlationId,
      },
      prisma
    );

    const filename = `${reportType.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.${format}`;
    return new NextResponse(body, {
      headers: {
        'Content-Type': CONTENT_TYPES[format],
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return accountingErrorResponse(error, `export ${reportType} report`);
  }
}
