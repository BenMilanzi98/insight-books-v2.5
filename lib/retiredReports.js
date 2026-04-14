import { NextResponse } from 'next/server';

/** Report IDs / URL segments that are intentionally no longer served. */
export const RETIRED_REPORT_IDS = new Set([
  'accounts-receivable-aging',
  'accounts-payable-aging',
  'inventory-valuation',
  'sales-analysis',
  'expense-analysis',
  'profitability-analysis',
]);

export const RETIRED_REPORT_MESSAGE =
  'This report has been removed. Use Reports for Income Statement, Balance Sheet, Cash Flow, Sales Report, or Expense Report.';

export function retiredReportResponse(reportId) {
  return NextResponse.json(
    { error: RETIRED_REPORT_MESSAGE, retired: true, reportId },
    { status: 410 }
  );
}
