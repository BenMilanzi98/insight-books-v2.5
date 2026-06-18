import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getBalanceSheetAccountTrace } from '@/lib/balanceSheetAccountTrace';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

/**
 * GET /api/reports/balance-sheet/account-trace
 * Full balance source breakdown + posted GL lines for balance sheet account drill-down.
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, userQ, scope, tenantIds, primaryTenantId, reportBranchId } = boot;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');
    const asOfDate = searchParams.get('asOfDate');

    if (!accountId || !asOfDate) {
      return NextResponse.json(
        { error: 'accountId and asOfDate are required' },
        { status: 400 }
      );
    }

    if (tenantIds.length > 1) {
      return NextResponse.json(
        { error: 'Account trace is available for a single selected business only.' },
        { status: 400 }
      );
    }

    const trace = await getBalanceSheetAccountTrace(prisma, primaryTenantId, accountId, {
      asOfDate,
      branchId: reportBranchId,
      inventoryUser: userQ,
    });

    await auditReportAccess({
      user,
      reportType: 'balance-sheet-account-trace',
      tenantIds,
      scope,
      filters: { accountId, asOfDate },
    });

    return NextResponse.json({ ...trace, scope });
  } catch (error) {
    console.error('Balance sheet account trace error:', error);
    const message = error?.message || 'Failed to load account trace';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
