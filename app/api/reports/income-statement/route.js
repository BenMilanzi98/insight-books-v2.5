// Legacy income-statement / P&L API — Phase 4 cutover.
// Canonical: POST /api/accounting-v2/reports/generate { type: 'INCOME_STATEMENT' }
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

    await auditReportAccess({
      user,
      reportType: 'income-statement',
      tenantIds,
      scope,
      filters: { blocked: 'LEGACY_REPORT_DISABLED' },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/income-statement is disabled. Use Accounting V2 Income Statement at /api/accounting-v2/reports/generate.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  } catch (error) {
    console.error('Error on retired income-statement route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/income-statement is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
}
