// app/api/reports/sales-analysis/route.js
import { NextResponse } from 'next/server';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import { RETIRED_REPORT_MESSAGE } from '@/lib/retiredReports';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, scope, tenantIds } = boot;

    await auditReportAccess({
      user,
      reportType: 'sales-analysis',
      tenantIds,
      scope,
    });

    return NextResponse.json(
      { error: RETIRED_REPORT_MESSAGE, retired: true, reportId: 'sales-analysis', scope },
      { status: 410 }
    );
  } catch (error) {
    console.error('sales-analysis:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
