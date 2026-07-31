import { minorToNumber } from './money.js';

/**
 * @param {'REVENUE'|'EXPENSE'|'COST_OF_SALES'|'PROFIT'|string} lineKind
 * @param {number|bigint} budgetMinor
 * @param {number|bigint} actualMinor
 */
export function computeVariance(lineKind, budgetMinor, actualMinor) {
  const budget = minorToNumber(budgetMinor);
  const actual = minorToNumber(actualMinor);
  const raw = actual - budget;
  const kind = String(lineKind || '').toUpperCase();

  let favourable;
  if (kind === 'REVENUE' || kind === 'OTHER_INCOME' || kind === 'PROFIT') {
    favourable = raw;
  } else if (
    kind === 'EXPENSE' ||
    kind === 'COST_OF_SALES' ||
    kind === 'OTHER_EXPENSE' ||
    kind === 'CAPEX'
  ) {
    favourable = budget - actual;
  } else {
    favourable = raw;
  }

  let variancePercent = null;
  let percentState = null;
  if (budget === 0) {
    if (actual === 0) {
      variancePercent = 0;
      percentState = 'ZERO_BOTH';
    } else {
      percentState = 'NEW_UNPLANNED_ACTIVITY';
    }
  } else {
    variancePercent = (favourable / Math.abs(budget)) * 100;
  }

  const status = resolveVarianceStatus(kind, budget, actual, favourable, percentState);

  return {
    budgetMinor: budget,
    actualMinor: actual,
    rawVarianceMinor: raw,
    favourableVarianceMinor: favourable,
    variancePercent,
    percentState,
    status,
    isFavourable: favourable >= 0,
  };
}

function resolveVarianceStatus(kind, budget, actual, favourable, percentState) {
  if (percentState === 'NEW_UNPLANNED_ACTIVITY') return 'NEW_UNPLANNED_ACTIVITY';
  if (budget === 0 && actual === 0) return 'NO_ACTUAL';
  if (actual === 0 && budget !== 0) return 'NO_ACTUAL';

  const isRevenue = kind === 'REVENUE' || kind === 'OTHER_INCOME' || kind === 'PROFIT';
  if (Math.abs(favourable) < 1) return 'ON_TRACK';

  if (isRevenue) {
    if (favourable > 0) return 'ABOVE_TARGET';
    return 'BELOW_TARGET';
  }

  if (favourable > 0) return 'UNDER_BUDGET';
  if (favourable < 0) return 'OVER_BUDGET';
  return 'ON_TRACK';
}

export const VARIANCE_STATUS = Object.freeze({
  ON_TRACK: 'ON_TRACK',
  FAVOURABLE: 'FAVOURABLE',
  UNFAVOURABLE: 'UNFAVOURABLE',
  OVER_BUDGET: 'OVER_BUDGET',
  UNDER_BUDGET: 'UNDER_BUDGET',
  BELOW_TARGET: 'BELOW_TARGET',
  ABOVE_TARGET: 'ABOVE_TARGET',
  NO_BUDGET: 'NO_BUDGET',
  NO_ACTUAL: 'NO_ACTUAL',
  NEW_UNPLANNED_ACTIVITY: 'NEW_UNPLANNED_ACTIVITY',
  MATERIAL_VARIANCE: 'MATERIAL_VARIANCE',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
});

export function classifyAccountKind(accountType, accountCategory) {
  const cat = String(accountCategory || '').toUpperCase();
  if (cat) {
    if (cat.includes('REVENUE') || cat === 'OTHER_INCOME') return cat === 'OTHER_INCOME' ? 'OTHER_INCOME' : 'REVENUE';
    if (cat.includes('COST_OF_SALES') || cat === 'COGS') return 'COST_OF_SALES';
    if (cat.includes('EXPENSE')) return 'EXPENSE';
    if (cat === 'ASSET') return 'ASSET';
    if (cat === 'LIABILITY' || cat === 'EQUITY') return cat;
  }
  const t = String(accountType || '').toLowerCase();
  if (t === 'income' || t === 'revenue') return 'REVENUE';
  if (t === 'expense') return 'EXPENSE';
  if (t === 'asset') return 'ASSET';
  if (t === 'liability') return 'LIABILITY';
  if (t === 'equity') return 'EQUITY';
  return 'EXPENSE';
}
