import { NextResponse } from 'next/server';

/** Report IDs / URL segments that are intentionally no longer served. */
export const RETIRED_REPORT_IDS = new Set([
  'accounts-receivable-aging',
  'accounts-payable-aging',
  'inventory-valuation',
  'sales-analysis',
  'expense-analysis',
  'profitability-analysis',
  'trial-balance',
  'balance-sheet',
  'income-statement',
  'profit-loss',
  'cash-flow',
]);

export const RETIRED_REPORT_MESSAGE =
  'This report has been removed. Use Reports for Income Statement, Balance Sheet, Cash Flow, Sales Report, or Expense Report.';

/** Canonical Accounting V2 report generate API. */
export const ACCOUNTING_V2_REPORTS_GENERATE = '/api/accounting-v2/reports/generate';
export const ACCOUNTING_V2_REPORTS_EXPORT = '/api/accounting-v2/reports/export';

/**
 * Phase 4 — financial statement generators that duplicate Accounting V2.
 * @param {string} [error]
 * @param {string} [use]
 */
export function legacyFinancialReportDisabledResponse(
  error = 'Legacy financial report API is disabled. Use Accounting V2 reports.',
  use = ACCOUNTING_V2_REPORTS_GENERATE
) {
  return NextResponse.json(
    {
      error,
      code: 'LEGACY_REPORT_DISABLED',
      use,
      retired: true,
    },
    { status: 410 }
  );
}

export function retiredReportResponse(reportId) {
  if (
    reportId === 'trial-balance' ||
    reportId === 'balance-sheet' ||
    reportId === 'income-statement' ||
    reportId === 'profit-loss' ||
    reportId === 'cash-flow'
  ) {
    return legacyFinancialReportDisabledResponse(
      `Legacy /api/reports/${reportId} is disabled. Use Accounting V2 reports.`,
      ACCOUNTING_V2_REPORTS_GENERATE
    );
  }
  return NextResponse.json(
    { error: RETIRED_REPORT_MESSAGE, retired: true, reportId },
    { status: 410 }
  );
}
