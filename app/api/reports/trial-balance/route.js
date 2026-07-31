// Legacy trial-balance API — Phase 4 cutover.
// Canonical: POST /api/accounting-v2/reports/generate { type: 'TRIAL_BALANCE' }
import { NextResponse } from 'next/server';
import { bootstrapReportRoute, auditReportAccess } from '@/lib/reportRouteBootstrap';
import {
  ACCOUNTING_V2_REPORTS_GENERATE,
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
      filters: { blocked: 'LEGACY_REPORT_DISABLED' },
    });

    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/trial-balance is disabled. Use Accounting V2 Trial Balance at /api/accounting-v2/reports/generate.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  } catch (error) {
    console.error('Error on retired trial-balance route:', error);
    return legacyFinancialReportDisabledResponse(
      'Legacy /api/reports/trial-balance is disabled. Use Accounting V2 reports.',
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
}
