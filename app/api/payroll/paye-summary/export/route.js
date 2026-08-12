import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requireAnyPermission } from '@/lib/auth';
import { buildPayeSummaryReport } from '@/lib/payrollEngine/payeSummaryService';
import { resolveReportTenantScope } from '@/lib/reportTenantScope';
import { generatePayeSummaryWorkbook } from '@/lib/payrollEngine/payeSummaryExport';

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
    const perm = await requireAnyPermission(request, ['payroll.export', 'payroll.view', 'hr.view', 'reports.view']);
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
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();
    const filters = parseFilters(searchParams);

    const report = await buildPayeSummaryReport({
      tenantIds: scope.tenantIds,
      filters,
      db: prisma,
    });

    const tenant = await prisma.tenant.findFirst({
      where: { id: scope.tenantIds[0] },
      select: { name: true },
    });

    const meta = {
      businessName: scope.scope?.businessLabel || tenant?.name || 'Business',
      periodLabel: filters.fromDate && filters.toDate
        ? `${filters.fromDate} to ${filters.toDate}`
        : 'All periods',
      generatedBy: user.name || user.email || 'User',
      generatedAt: new Date(),
      filters,
    };

    if (format === 'pdf') {
      const { generatePayeSummaryPdfBuffer } = await import('@/lib/payrollEngine/payeSummaryPdf');
      const buffer = await generatePayeSummaryPdfBuffer(report, meta);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="paye-summary-${Date.now()}.pdf"`,
        },
      });
    }

    const buffer = generatePayeSummaryWorkbook(report, meta);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="paye-summary-${Date.now()}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('paye-summary export:', error);
    return NextResponse.json(
      { error: 'Export failed', details: error.message },
      { status: 500 },
    );
  }
}
