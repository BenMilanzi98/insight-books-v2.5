// Legacy cash-flow API — fully retired (R3-C / Phase 4).
// Canonical: POST /api/accounting-v2/reports/generate { type: 'CASH_FLOW' }
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import {
  ACCOUNTING_V2_REPORTS_GENERATE,
  legacyFinancialReportDisabledResponse,
} from '@/lib/retiredReports';

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, scope, tenantIds } = boot;
    const { searchParams } = new URL(request.url);

    await auditReportAccess({
      user,
      reportType: 'cash-flow',
      tenantIds,
      scope,
      filters: {
        startDate: searchParams.get('startDate'),
        endDate: searchParams.get('endDate'),
        blocked: 'LEGACY_REPORT_DISABLED',
      },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/cash-flow is disabled. Use Accounting V2 Cash Flow at /api/accounting-v2/reports/generate.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  } catch (error) {
    console.error('Error on retired cash-flow route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/cash-flow is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
}
