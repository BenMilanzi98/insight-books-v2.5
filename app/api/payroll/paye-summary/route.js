import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { buildPayeSummaryReport, emptyPayeSummary } from '@/lib/payrollEngine/payeSummaryService';
import { resolveReportTenantScope } from '@/lib/reportTenantScope';

export const dynamic = 'force-dynamic';

function parseFilters(searchParams) {
  return {
    fromDate: searchParams.get('fromDate') || undefined,
    toDate: searchParams.get('toDate') || undefined,
    employeeId: searchParams.get('employeeId') || undefined,
    departmentId: searchParams.get('departmentId') || undefined,
    department: searchParams.get('department') || undefined,
    branch: searchParams.get('branch') || undefined,
    payrollStatus: searchParams.get('payrollStatus') || undefined,
    journalPosted: searchParams.get('journalPosted') || undefined,
    excludeReversed: searchParams.get('includeReversed') !== 'true',
  };
}

export async function GET(request) {
  try {
    const perm = await requireAnyPermission(request, [
      'payroll.view',
      'payroll.export',
      'hr.view',
      'reports.view',
    ]);
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const scope = await resolveReportTenantScope(request, user);
    if (!scope.ok) {
      return NextResponse.json({ error: scope.error }, { status: scope.status });
    }

    const { searchParams } = new URL(request.url);
    const filters = parseFilters(searchParams);

    const report = await buildPayeSummaryReport({
      tenantIds: scope.tenantIds,
      filters,
      db: prisma,
    });

    return NextResponse.json({
      ...report,
      scope: scope.scope,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('paye-summary GET:', error);
    return NextResponse.json(
      {
        ...emptyPayeSummary(),
        error: error.message || 'Failed to fetch PAYE summary',
      },
      { status: 200 },
    );
  }
}
