// app/api/reports/stock-movement/route.js
/**
 * Stock Movement Report API
 * Uses lib/stockMovementService – Direct Method: opening from pre-period sum,
 * Qty In = goods_receipt + sales_return, Qty Out = sales + purchase_return,
 * running balance, numeric qty (never "-").
 */
import { NextResponse } from 'next/server';
import { generateStockMovementReport } from '@/lib/stockMovementService';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, userQ, scope, tenantIds, tenants, primaryTenantId, reportBranchId } = boot;

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId') || null;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    let branchId = reportBranchId ?? userQ.currentBranchId ?? null;
    if (branchId && typeof branchId !== 'string') {
      branchId = branchId?.id && typeof branchId.id === 'string' ? branchId.id : null;
    }

    let report;
    let byTenant = null;

    if (tenantIds.length > 1) {
      const reports = await Promise.all(
        tenantIds.map(async (tenantId) => {
          const tenant = tenants.find((t) => t.id === tenantId);
          const r = await generateStockMovementReport(
            tenantId,
            startDate,
            endDate,
            productId,
            branchId
          );
          return { tenantId, tenantName: tenant?.name || tenantId, report: r };
        })
      );
      report = { ...reports[0]?.report, companyName: 'Consolidated — Multiple Businesses' };
      byTenant = reports.map(({ tenantId, tenantName, report: r }) => ({
        tenantId,
        tenantName,
        totalProducts: r.metadata?.totalProducts ?? r.productMovements?.length ?? 0,
        totalClosingQuantity: r.metadata?.totalClosingQuantity ?? 0,
      }));
    } else {
      report = await generateStockMovementReport(
        primaryTenantId,
        startDate,
        endDate,
        productId,
        branchId
      );
    }

    await auditReportAccess({
      user,
      reportType: 'stock-movement',
      tenantIds,
      scope,
      filters: { startDate, endDate, productId },
    });

    return NextResponse.json({ ...report, scope, byTenant });
  } catch (error) {
    console.error('Error generating stock movement report:', error);
    const message =
      process.env.NODE_ENV === 'development'
        ? error?.message || String(error)
        : 'Failed to generate stock movement report. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
