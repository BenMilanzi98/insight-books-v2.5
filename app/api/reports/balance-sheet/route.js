// Legacy balance-sheet API — Phase 4 cutover.
// Canonical: POST /api/accounting-v2/reports/generate { type: 'BALANCE_SHEET' }
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
      reportType: 'balance-sheet',
      tenantIds,
      scope,
      filters: { blocked: 'LEGACY_REPORT_DISABLED' },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/balance-sheet is disabled. Use Accounting V2 Balance Sheet at /api/accounting-v2/reports/generate.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  } catch (error) {
    console.error('Error on retired balance-sheet route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/balance-sheet is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
}
