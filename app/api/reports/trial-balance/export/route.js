// Legacy trial-balance export — Phase 4 cutover.
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import {
  ACCOUNTING_V2_REPORTS_EXPORT,
  legacyFinancialReportDisabledResponse,
} from '@/lib/retiredReports';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request) {
  try {
    const boot = await bootstrapReportRoute(request);
    if (boot.error) return boot.error;
    const { user, scope, tenantIds } = boot;

    await auditReportAccess({
      user,
      reportType: 'trial-balance',
      tenantIds,
      scope,
      filters: { blocked: 'LEGACY_REPORT_DISABLED', format: 'export' },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/trial-balance/export is disabled. Use Accounting V2 report export.',
      ACCOUNTING_V2_REPORTS_EXPORT
    );
  } catch (error) {
    console.error('Error on retired trial-balance export route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy trial-balance export is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_EXPORT
    );
  }
}
