import { NextResponse } from 'next/server';
import { runGlReconciliation } from '@/lib/glReconciliation';
import { bootstrapReportRoute, auditReportAccess, tenantNameMap } from '@/lib/reportRouteBootstrap';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/reports/gl-reconciliation
 *
 * Auditors / admins: verifies TB engine internal consistency (raw survivor map vs TB rows)
 * and that posted manual journals balance per entry.
 *
 * Query: startDate, endDate (required YYYY-MM-DD), branchId optional (all / empty = all branches)
 */
export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, scope, tenantIds, tenants, reportBranchId, branchId, userQ } = boot;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required (YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const branchIdParam = searchParams.get('branchId');
    const effectiveBranchId =
      branchIdParam === 'all' || branchIdParam === ''
        ? null
        : branchIdParam ?? reportBranchId ?? branchId ?? userQ?.currentBranchId ?? null;
    const includeSubledgers = searchParams.get('includeSubledgers') === 'true';

    const tMap = tenantNameMap(tenants);

    if (tenantIds.length > 1) {
      const byTenant = await Promise.all(
        tenantIds.map(async (tenantId) => {
          const report = await runGlReconciliation({
            tenantId,
            branchId: effectiveBranchId,
            startDate,
            endDate,
            includeSubledgers,
          });
          return {
            tenantId,
            businessName: tMap.get(tenantId) || tenantId,
            ...report,
          };
        })
      );

      await auditReportAccess({
        user,
        reportType: 'gl-reconciliation',
        tenantIds,
        scope,
        filters: { startDate, endDate, branchId: effectiveBranchId, includeSubledgers },
      });

      return NextResponse.json({ scope, byTenant });
    }

    const report = await runGlReconciliation({
      tenantId: tenantIds[0],
      branchId: effectiveBranchId,
      startDate,
      endDate,
      includeSubledgers,
    });

    await auditReportAccess({
      user,
      reportType: 'gl-reconciliation',
      tenantIds,
      scope,
      filters: { startDate, endDate, branchId: effectiveBranchId, includeSubledgers },
    });

    return NextResponse.json({ ...report, scope });
  } catch (error) {
    console.error('gl-reconciliation:', error);
    return NextResponse.json(
      { error: 'Failed to run GL reconciliation', message: error.message },
      { status: 500 }
    );
  }
}
