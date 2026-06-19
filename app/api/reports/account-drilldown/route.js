import { NextResponse } from 'next/server';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import { getAccountDrilldown } from '@/lib/accountingReportService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const { primaryTenantId, user, tenantIds, scope, reportBranchId } = boot;
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const asOfDate = searchParams.get('asOfDate');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!accountId) {
      return NextResponse.json({ error: 'accountId is required' }, { status: 400 });
    }

    if (tenantIds.length > 1) {
      return NextResponse.json(
        { error: 'Account drill-down is available for one business at a time.' },
        { status: 400 }
      );
    }

    const drilldown = await getAccountDrilldown({
      tenantId: primaryTenantId,
      accountId,
      asOfDate,
      startDate,
      endDate,
      branchId: reportBranchId,
    });

    await auditReportAccess({
      user,
      reportType: 'account-drilldown',
      tenantIds,
      scope,
      filters: { accountId, asOfDate, startDate, endDate },
    });

    return NextResponse.json(drilldown);
  } catch (error) {
    console.error('Account drill-down failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load account drill-down.' },
      { status: error.message === 'Account not found' ? 404 : 500 }
    );
  }
}
