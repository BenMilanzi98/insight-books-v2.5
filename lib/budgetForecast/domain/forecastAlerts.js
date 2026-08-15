/**
 * Computed forecast alerts (dashboard callouts). No email/push.
 */

/**
 * @param {object} input
 * @param {Array} [input.cashMonths]
 * @param {number} [input.forecastRevenueMinor]
 * @param {number} [input.forecastExpenseMinor]
 * @param {number} [input.budgetRevenueMinor]
 * @param {number} [input.budgetExpenseMinor]
 * @param {string} [input.method]
 * @param {string|null} [input.sourceBudgetId]
 * @param {number} [input.thresholdPercent] default 10
 * @returns {Array<{ key: string, severity: 'warning'|'critical'|'info', message: string }>}
 */
export function buildForecastAlerts({
  cashMonths = [],
  forecastRevenueMinor = 0,
  forecastExpenseMinor = 0,
  budgetRevenueMinor = 0,
  budgetExpenseMinor = 0,
  method = null,
  sourceBudgetId = null,
  thresholdPercent = 10,
} = {}) {
  const alerts = [];
  const dip = (cashMonths || []).find((m) => Number(m.closingCash) < 0 || m.warning === 'CASH_DIP');
  if (dip) {
    alerts.push({
      key: 'cash_dip',
      severity: 'critical',
      message: `Cash outlook dips below zero in ${dip.key || 'a forecast month'}. Review receipts and payments.`,
    });
  }

  const thr = Math.max(0, Number(thresholdPercent) || 10) / 100;
  if (budgetRevenueMinor > 0) {
    const shortfall = budgetRevenueMinor - forecastRevenueMinor;
    if (shortfall > budgetRevenueMinor * thr) {
      const pct = Math.round((shortfall / budgetRevenueMinor) * 100);
      alerts.push({
        key: 'revenue_shortfall',
        severity: 'warning',
        message: `Forecast revenue is about ${pct}% below the linked budget.`,
      });
    }
  }
  if (budgetExpenseMinor > 0 && forecastExpenseMinor > budgetExpenseMinor * (1 + thr)) {
    const over = Math.round(((forecastExpenseMinor - budgetExpenseMinor) / budgetExpenseMinor) * 100);
    alerts.push({
      key: 'expense_over',
      severity: 'warning',
      message: `Forecast expenses are about ${over}% above the linked budget.`,
    });
  }

  if (String(method || '').toUpperCase() === 'BUDGET_REMAINDER' && !sourceBudgetId) {
    alerts.push({
      key: 'missing_source_budget',
      severity: 'info',
      message: 'Budget remainder method needs a source budget before regenerate.',
    });
  }

  return alerts;
}
