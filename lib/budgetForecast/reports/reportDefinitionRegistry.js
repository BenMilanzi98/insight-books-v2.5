/**
 * Server-side Budget & Forecast report definitions.
 * Formulas and sign policy are documented for reconciliation with screen/export.
 */

const REPORTS = Object.freeze({
  BVA: Object.freeze({
    id: 'BVA',
    name: 'Budget versus Actual',
    group: 'ACTUAL_COMPARISON',
    formula: {
      rawVariance: 'actualMinor - budgetMinor',
      favourableRevenue: 'actualMinor - budgetMinor',
      favourableExpense: 'budgetMinor - actualMinor',
      variancePercent: 'favourableVariance / abs(budgetMinor) * 100',
      zeroBudget: 'NEW_UNPLANNED_ACTIVITY',
    },
    signPolicy: 'P&L natural-positive via Accounting V2 ledger summary',
    actualsSource: 'getBusinessLedgerSummary',
    neverPosts: true,
  }),
  BVF: Object.freeze({
    id: 'BVF',
    name: 'Budget versus Forecast',
    group: 'FORECAST_REPORTS',
    formula: {
      rawVariance: 'forecastMinor - budgetMinor',
    },
    signPolicy: 'Same account-kind favourable rules as BvA',
    neverPosts: true,
  }),
  FVA: Object.freeze({
    id: 'FVA',
    name: 'Forecast versus Actual',
    group: 'FORECAST_REPORTS',
    formula: {
      rawVariance: 'actualMinor - forecastMinor',
    },
    actualsSource: 'getBusinessLedgerSummary',
    neverPosts: true,
  }),
  UTILIZATION: Object.freeze({
    id: 'UTILIZATION',
    name: 'Budget Utilization',
    group: 'MANAGEMENT_REPORTS',
    formula: {
      expenseUtilization: 'actual / budget * 100',
      revenueAchievement: 'actual / budget * 100',
    },
    neverPosts: true,
  }),
  CASH_OUTLOOK: Object.freeze({
    id: 'CASH_OUTLOOK',
    name: 'Cash Outlook',
    group: 'OVERVIEW',
    formula: {
      closingCash: 'openingCash + projectedInflows - projectedOutflows',
    },
    note: 'Opening cash from GL cash/bank accounts; never posts.',
    neverPosts: true,
  }),
  COMPLETION: Object.freeze({
    id: 'COMPLETION',
    name: 'Budget Completion',
    group: 'BUDGET_REPORTS',
    formula: { score: 'weighted explainable checklist 0-100' },
    neverPosts: true,
  }),
  BUDGET: Object.freeze({
    id: 'BUDGET',
    name: 'Budget Report',
    group: 'BUDGET_REPORTS',
    formula: {
      annual: 'sum(periodAmounts.plannedAmountMinor)',
      byPeriod: 'periodAmounts.plannedAmountMinor',
    },
    note: 'Approved plan only — no actuals mixed in.',
    neverPosts: true,
  }),
});

export function getReportDefinition(id) {
  const def = REPORTS[String(id || '').toUpperCase()];
  if (!def) {
    const err = new Error(`Unknown report definition: ${id}`);
    err.status = 404;
    err.code = 'REPORT_NOT_FOUND';
    throw err;
  }
  return def;
}

export function listReportDefinitions() {
  return Object.values(REPORTS);
}

export { REPORTS };
