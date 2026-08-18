import { buildAnnualPeriods, buildMonthlyPeriods, buildQuarterlyPeriods, formatPeriodLabel, parsePeriodKey } from './periods.js';

export const PERIOD_GRANULARITIES = Object.freeze(['MONTH', 'QUARTER', 'YEAR']);

/**
 * List selectable period options for variance reports.
 * @param {Date|string} startDate
 * @param {Date|string} endDate
 * @param {'MONTH'|'QUARTER'|'YEAR'} granularity
 */
export function listPeriodFilterOptions(startDate, endDate, granularity = 'MONTH') {
  const g = String(granularity || 'MONTH').toUpperCase();
  let periods;
  if (g === 'YEAR') periods = buildAnnualPeriods(startDate, endDate);
  else if (g === 'QUARTER') periods = buildQuarterlyPeriods(startDate, endDate);
  else periods = buildMonthlyPeriods(startDate, endDate);

  const options = periods.map((p) => {
    const freq =
      g === 'YEAR' ? 'ANNUAL' : g === 'QUARTER' ? 'QUARTERLY' : 'MONTHLY';
    return {
      key: p.key,
      label: g === 'ALL' ? p.key : formatPeriodLabel(p, freq),
      startDate: p.periodStart,
      endDate: p.periodEnd,
    };
  });

  return [{ key: 'ALL', label: 'Full budget period', startDate: new Date(startDate), endDate: new Date(endDate) }, ...options];
}

/**
 * Resolve API start/end from filter selection.
 */
export function resolvePeriodFilterRange(budgetStart, budgetEnd, periodKey) {
  if (!periodKey || periodKey === 'ALL') {
    return { startDate: new Date(budgetStart), endDate: new Date(budgetEnd) };
  }
  const parsed = parsePeriodKey(periodKey);
  if (!parsed) {
    return { startDate: new Date(budgetStart), endDate: new Date(budgetEnd) };
  }
  return { startDate: parsed.periodStart, endDate: parsed.periodEnd };
}
