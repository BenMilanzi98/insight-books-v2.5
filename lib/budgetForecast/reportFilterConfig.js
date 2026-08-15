const NEEDS_BUDGET = new Set([
  'BVA',
  'BVF',
  'UTILIZATION',
  'BUDGET',
  'COMPLETION',
  'BUDGET_VS_ACTUAL',
  'BUDGET_VS_FORECAST',
  'BUDGET_REPORT',
]);
const NEEDS_FORECAST = new Set([
  'BVF',
  'FVA',
  'CASH_OUTLOOK',
  'BUDGET_VS_FORECAST',
  'FORECAST_VS_ACTUAL',
]);

export function reportNeedsBudget(id) {
  return NEEDS_BUDGET.has(String(id || '').toUpperCase());
}

export function reportNeedsForecast(id) {
  return NEEDS_FORECAST.has(String(id || '').toUpperCase());
}

export const RUNNABLE_REPORT_IDS = new Set([
  'BUDGET',
  'BVA',
  'BVF',
  'FVA',
  'UTILIZATION',
  'CASH_OUTLOOK',
  'COMPLETION',
]);
