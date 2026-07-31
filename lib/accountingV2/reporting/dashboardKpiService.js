/**
 * Phase 7 — dashboard KPI alignment (§59).
 *
 * Dashboard financial KPIs come from the SAME canonical report services as the
 * formal statements — never independent calculations — so a dashboard figure
 * always agrees with the corresponding report for the same scope.
 */

import { generateIncomeStatement, generateBalanceSheet } from './financialStatementService.js';
import { normalizeReportRequest, amount } from './reportContracts.js';

/**
 * Canonical financial KPIs for a business.
 * @param {object} scope {fromDate, toDate, asOfDate, branchId, financialYearStartDate}
 */
export async function getDashboardFinancialKpis(db, context, scope = {}) {
  const isRequest = normalizeReportRequest(context, 'INCOME_STATEMENT', scope);
  const bsRequest = normalizeReportRequest(context, 'BALANCE_SHEET', scope);
  const [is, bs] = await Promise.all([
    generateIncomeStatement(db, context, isRequest),
    generateBalanceSheet(db, context, bsRequest),
  ]);

  const lineMinor = (env, lineId) =>
    env.lines.find((l) => l.lineId === lineId)?.currentAmount.minor ?? 0;

  const revenue = is.totals.revenue.minor;
  const expenses =
    lineMinor(is, 'operating-expenses') +
    lineMinor(is, 'depreciation-amortization') +
    lineMinor(is, 'other-expenses') +
    lineMinor(is, 'finance-costs') +
    lineMinor(is, 'tax-expense');
  const cash = lineMinor(bs, 'cash');
  const receivables = lineMinor(bs, 'accounts-receivable');
  const payables = lineMinor(bs, 'accounts-payable');
  const inventory = lineMinor(bs, 'inventory');
  const currentAssets = cash + receivables + inventory + lineMinor(bs, 'prepayments');
  const currentLiabilities =
    payables + lineMinor(bs, 'taxes-payable') + lineMinor(bs, 'payroll-liabilities');
  const totalLiabilities = bs.totals.totalLiabilities.minor;
  const totalEquity = bs.totals.totalEquity.minor;

  return {
    scope: {
      fromDate: is.dateRange.fromDate,
      toDate: is.dateRange.toDate,
      asOfDate: bs.asOfDate,
      label: 'Income figures are period activity; position figures are as-of balances.',
    },
    integrity: { incomeStatement: is.integrityStatus, balanceSheet: bs.integrityStatus },
    kpis: {
      revenue: amount(revenue),
      expenses: amount(expenses),
      grossProfit: amount(is.totals.grossProfit.minor),
      netProfit: amount(is.totals.netProfit.minor),
      cashBalance: amount(cash),
      receivables: amount(receivables),
      payables: amount(payables),
      inventory: amount(inventory),
      totalAssets: amount(bs.totals.totalAssets.minor),
      totalLiabilities: amount(totalLiabilities),
      totalEquity: amount(totalEquity),
      workingCapital: amount(currentAssets - currentLiabilities),
      currentRatio:
        currentLiabilities !== 0 ? Number((currentAssets / currentLiabilities).toFixed(2)) : null,
      debtToEquity:
        totalEquity !== 0 ? Number((totalLiabilities / totalEquity).toFixed(2)) : null,
    },
    sourcePolicy: is.sourcePolicy,
  };
}
