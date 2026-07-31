import { minorToNumber } from './money.js';

/** Expense utilization = actual / budget * 100 */
export function expenseUtilization(budgetMinor, actualMinor) {
  const budget = minorToNumber(budgetMinor);
  const actual = minorToNumber(actualMinor);
  if (budget === 0) {
    return {
      utilizationPercent: null,
      remainingMinor: -actual,
      state: actual === 0 ? 'ZERO_BUDGET' : 'NO_BUDGET',
      status: actual === 0 ? 'ON_TRACK' : 'NO_BUDGET',
    };
  }
  const pct = Math.round((actual / budget) * 10000) / 100;
  const remaining = budget - actual;
  let status = 'ON_TRACK';
  if (pct > 100) status = 'OVER_BUDGET';
  else if (pct >= 90) status = 'NEAR_LIMIT';
  else if (pct <= 50) status = 'UNDER_UTILIZED';
  return {
    utilizationPercent: pct,
    remainingMinor: remaining,
    state: 'OK',
    status,
  };
}

/** Revenue achievement = actual / budget * 100 */
export function revenueAchievement(budgetMinor, actualMinor) {
  const budget = minorToNumber(budgetMinor);
  const actual = minorToNumber(actualMinor);
  if (budget === 0) {
    return {
      achievementPercent: null,
      gapMinor: actual,
      state: actual === 0 ? 'ZERO_BUDGET' : 'NO_BUDGET',
      status: actual === 0 ? 'ON_TRACK' : 'NO_BUDGET',
    };
  }
  const pct = Math.round((actual / budget) * 10000) / 100;
  let status = 'ON_TRACK';
  if (pct >= 100) status = 'ABOVE_TARGET';
  else if (pct >= 90) status = 'NEAR_TARGET';
  else status = 'BELOW_TARGET';
  return {
    achievementPercent: pct,
    gapMinor: actual - budget,
    state: 'OK',
    status,
  };
}
