/**
 * Daily POS Micro Report API – one calendar day.
 */
import { NextResponse } from 'next/server';
import { generatePosDailyReport } from '@/lib/posDailyReportService';
import { normalizeReportYmdParam } from '@/lib/reportingSourceRules';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, userQ, scope, tenantIds, tenants, primaryTenantId } = boot;

    const url = request.nextUrl ?? request.url;
    const searchParams = typeof url === 'object' && url.searchParams ? url.searchParams : new URL(String(url || '').startsWith('http') ? url : `http://localhost${String(url || '').startsWith('/') ? url : '/'}`, 'http://localhost').searchParams;
    let date = searchParams.get('date');
    date = normalizeReportYmdParam(date);

    const branchIdParam = searchParams.get('branchId');
    const allBranches = /^(1|true|yes)$/i.test(String(searchParams.get('allBranches') || ''));

    let branchForReport = null;
    let branchIdsIn = null;

    if (branchIdParam && branchIdParam.trim() !== '') {
      branchForReport = branchIdParam.trim();
    } else if (allBranches) {
      const allowed = userQ.allowedBranchIds;
      if (Array.isArray(allowed) && allowed.length === 0) {
        await auditReportAccess({
          user,
          reportType: 'pos-daily',
          tenantIds,
          scope,
          filters: { date },
        });
        return NextResponse.json({
          companyName: '',
          logoUrl: null,
          date,
          period: { startDate: date, endDate: date },
          totalSales: 0,
          transactionCount: 0,
          itemsSold: 0,
          averageSaleValue: 0,
          paymentBreakdown: [],
          paymentGrandTotal: 0,
          cashierBreakdown: [],
          totalCogs: 0,
          grossProfit: 0,
          voidedCount: 0,
          refundCount: 0,
          productsAffected: 0,
          metadata: { generatedAt: new Date().toISOString(), noBranchAccess: true },
          scope,
        });
      }
      branchForReport = null;
      if (allowed != null && Array.isArray(allowed) && allowed.length > 0) {
        branchIdsIn = allowed;
      }
    } else {
      branchForReport = userQ.currentBranchId || null;
    }

    let report;
    let byTenant = null;

    if (tenantIds.length > 1) {
      const reports = await Promise.all(
        tenantIds.map(async (tenantId) => {
          const tenant = tenants.find((t) => t.id === tenantId);
          const r = await generatePosDailyReport(tenantId, date, branchForReport, { branchIdsIn });
          return { tenantId, tenantName: tenant?.name || tenantId, report: r };
        })
      );
      report = reports[0]?.report || {};
      byTenant = reports.map(({ tenantId, tenantName, report: r }) => ({
        tenantId,
        tenantName,
        totalSales: r.totalSales,
        transactionCount: r.transactionCount,
        grossProfit: r.grossProfit,
      }));
      report = {
        ...report,
        companyName: 'Consolidated — Multiple Businesses',
        totalSales: reports.reduce((s, x) => s + (Number(x.report.totalSales) || 0), 0),
        transactionCount: reports.reduce((s, x) => s + (Number(x.report.transactionCount) || 0), 0),
        itemsSold: reports.reduce((s, x) => s + (Number(x.report.itemsSold) || 0), 0),
        grossProfit: reports.reduce((s, x) => s + (Number(x.report.grossProfit) || 0), 0),
        totalCogs: reports.reduce((s, x) => s + (Number(x.report.totalCogs) || 0), 0),
      };
    } else {
      report = await generatePosDailyReport(primaryTenantId, date, branchForReport, {
        branchIdsIn,
      });
    }

    await auditReportAccess({
      user,
      reportType: 'pos-daily',
      tenantIds,
      scope,
      filters: { date },
    });

    return NextResponse.json({ ...report, scope, byTenant });
  } catch (error) {
    console.error('Error generating POS daily report:', error);
    return NextResponse.json(
      { error: 'Failed to generate daily POS report. Please try again.' },
      { status: 500 }
    );
  }
}
