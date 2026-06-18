import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { buildTrialBalance } from '@/lib/trialBalanceReport';
import { resolveReportTenantScope } from '@/lib/reportTenantScope';
import { generateScopedTrialBalance } from '@/lib/reportingEngine/multiTenantReporting';
import { logReportAccess } from '@/lib/reportAuditLog';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const scopeResult = await resolveReportTenantScope(request, user);
    if (!scopeResult.ok) {
      return NextResponse.json({ error: scopeResult.error }, { status: scopeResult.status });
    }

    const { tenantIds, tenants, scope, branchId, branchScoped, reportingCurrency } = scopeResult;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const branchIdParam = searchParams.get('branchId');
    const includeZero = (searchParams.get('includeZero') || 'false').toLowerCase() === 'true';

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start date and end date are required' }, { status: 400 });
    }

    const effectiveBranchId =
      branchIdParam === 'all' || branchIdParam === ''
        ? null
        : branchIdParam ?? (branchScoped ? branchId : null);

    const report = await generateScopedTrialBalance({
      tenantIds,
      tenants,
      startDate,
      endDate,
      branchId: effectiveBranchId,
      includeZero,
      scope,
      reportingCurrency,
    });

    await logReportAccess({
      userId: user.id,
      tenantId: tenantIds[0],
      reportType: 'trial-balance',
      action: 'REPORT_GENERATED',
      tenantIds,
      businessNames: scope.businessNames,
      filters: { startDate, endDate, includeZero },
    });

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating trial balance:', error);
    return NextResponse.json(
      { error: 'Failed to generate trial balance', message: error.message },
      { status: 500 }
    );
  }
}
