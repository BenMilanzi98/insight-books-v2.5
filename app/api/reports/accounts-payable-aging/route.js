// app/api/reports/accounts-payable-aging/route.js
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
      reportType: 'accounts-payable-aging',
      tenantIds,
      scope,
    });

    return NextResponse.json(
      { error: RETIRED_REPORT_MESSAGE, retired: true, reportId: 'accounts-payable-aging', scope },
      { status: 410 }
    );
  } catch (error) {
    console.error('accounts-payable-aging:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
