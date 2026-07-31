// Legacy balance-sheet account-trace — Phase 4 cutover.
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
      reportType: 'balance-sheet-account-trace',
      tenantIds,
      scope,
      filters: { blocked: 'LEGACY_REPORT_DISABLED' },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/balance-sheet/account-trace is disabled. Use Accounting V2 report drill-down.',
      '/api/accounting-v2/reports/drill-down'
    );
  } catch (error) {
    console.error('Error on retired balance-sheet account-trace route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy balance-sheet account-trace is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
}