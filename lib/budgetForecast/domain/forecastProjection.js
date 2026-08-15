/**
 * Pure forecast projection amounts. Unit-agnostic (same unit as inputs).
 */

export const FORECAST_METHODS = Object.freeze({
  CURRENT_RUN_RATE: 'CURRENT_RUN_RATE',
  HISTORICAL_AVERAGE: 'HISTORICAL_AVERAGE',
  BUDGET_REMAINDER: 'BUDGET_REMAINDER',
  RECURRING: 'RECURRING',
  MANUAL: 'MANUAL',
  OPEN_RECEIVABLES: 'OPEN_RECEIVABLES',
  OPEN_PAYABLES: 'OPEN_PAYABLES',
  INVENTORY_DEMAND: 'INVENTORY_DEMAND',
});

/**
 * @returns {number} projected total for the forecast horizon (rounded)
 */
export function projectForecastAmount({
  method,
  historical = 0,
  budgetAmt = 0,
  periodsCount = 1,
  actualsMonths = 1,
  growthPercent = 0,
  scenarioFactor = 1,
  recurringAmount = null,
  openScheduledTotal = null,
}) {
  const m = String(method || FORECAST_METHODS.CURRENT_RUN_RATE).toUpperCase();
  const periods = Math.max(1, Number(periodsCount) || 1);
  const lookback = Math.max(1, Number(actualsMonths) || 1);
  const hist = Number(historical) || 0;
  const budget = Number(budgetAmt) || 0;
  const growth = Number(growthPercent) || 0;
  const factor = Number(scenarioFactor) || 1;

  let projected = hist;

  if (m === FORECAST_METHODS.MANUAL) {
    projected = 0;
  } else if (m === FORECAST_METHODS.OPEN_RECEIVABLES || m === FORECAST_METHODS.OPEN_PAYABLES) {
    projected = openScheduledTotal != null ? Number(openScheduledTotal) || 0 : hist;
  } else if (m === FORECAST_METHODS.INVENTORY_DEMAND) {
    projected = openScheduledTotal != null ? Number(openScheduledTotal) || 0 : hist;
  } else if (m === FORECAST_METHODS.BUDGET_REMAINDER) {
    projected = Math.max(0, budget - hist);
  } else if (m === FORECAST_METHODS.RECURRING) {
    const monthly =
      recurringAmount != null && Number.isFinite(Number(recurringAmount))
        ? Number(recurringAmount)
        : hist / lookback;
    projected = monthly * periods;
  } else if (m === FORECAST_METHODS.HISTORICAL_AVERAGE || m === FORECAST_METHODS.CURRENT_RUN_RATE) {
    projected = (hist / lookback) * periods;
  }

  projected = Math.round(projected * (1 + growth / 100) * factor);
  return projected;
}

export function scenarioFactorFor(scenarioType) {
  const s = String(scenarioType || 'BASE_CASE').toUpperCase();
  if (s === 'BEST_CASE') return 1.1;
  if (s === 'WORST_CASE') return 0.9;
  return 1;
}
