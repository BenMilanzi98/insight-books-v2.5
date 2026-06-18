// app/api/reports/expense-analysis/route.js
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
      reportType: 'expense-analysis',
      tenantIds,
      scope,
    });

    return NextResponse.json(
      { error: RETIRED_REPORT_MESSAGE, retired: true, reportId: 'expense-analysis', scope },
      { status: 410 }
    );
  } catch (error) {
    console.error('expense-analysis:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
