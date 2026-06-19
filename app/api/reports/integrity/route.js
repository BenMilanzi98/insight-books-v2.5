import { NextResponse } from 'next/server';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import { runReportIntegrityCheck } from '@/lib/reportIntegrityService';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;

    const { primaryTenantId, user, tenantIds, scope } = boot;

    if (tenantIds.length > 1) {
      return NextResponse.json(
        { error: 'Integrity check is available for one business at a time.' },
        { status: 400 }
      );
    }

    const result = await runReportIntegrityCheck({ tenantId: primaryTenantId });

    await auditReportAccess({
      user,
      reportType: 'integrity',
      tenantIds,
      scope,
      filters: {},
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Report integrity check failed:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run integrity check.' },
      { status: 500 }
    );
  }
}
