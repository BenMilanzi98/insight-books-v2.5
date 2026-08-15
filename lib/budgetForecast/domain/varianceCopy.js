import { fromMinor } from './money.js';

/**
 * Owner-friendly variance sentence (guide §8 / §24).
 * @param {object} opts
 * @param {string} opts.accountName
 * @param {string} [opts.kind]
 * @param {string} opts.status
 * @param {number|bigint} [opts.favourableVarianceMinor]
 * @param {number|null} [opts.variancePercent]
 * @param {string} [opts.currency]
 */
export function describeVariance({
  accountName,
  kind,
  status,
  favourableVarianceMinor = 0,
  variancePercent = null,
  currency = 'MWK',
}) {
  const name = String(accountName || 'This account').trim() || 'This account';
  const absMajor = Math.abs(fromMinor(favourableVarianceMinor));
  const money = formatMoney(absMajor, currency);
  const pct =
    variancePercent == null || Number.isNaN(Number(variancePercent))
      ? null
      : Math.abs(Number(variancePercent)).toFixed(Math.abs(variancePercent) >= 10 ? 0 : 1);
  const isRevenue =
    String(kind || '').toUpperCase() === 'REVENUE' ||
    String(kind || '').toUpperCase() === 'OTHER_INCOME' ||
    String(kind || '').toUpperCase() === 'PROFIT';

  switch (String(status || '').toUpperCase()) {
    case 'ON_TRACK':
      return `${name} is on track with the budget.`;
    case 'ABOVE_TARGET':
      return pct != null
        ? `${name} is ${pct}% above budget (${money}).`
        : `${name} is above budget by ${money}.`;
    case 'BELOW_TARGET':
      return pct != null
        ? `${name} is currently ${pct}% below budget (${money}).`
        : `${name} is currently below budget by ${money}.`;
    case 'UNDER_BUDGET':
      return pct != null
        ? `${name} is ${money} under budget (${pct}% favourable).`
        : `${name} is ${money} under budget.`;
    case 'OVER_BUDGET':
      return pct != null
        ? `${name} is ${money} over budget (${pct}% above plan).`
        : `${name} is ${money} over budget.`;
    case 'NEW_UNPLANNED_ACTIVITY':
      return `${name} has ${money} of activity with no budget line.`;
    case 'NO_ACTUAL':
      return isRevenue
        ? `${name} has a budget of ${money} but no actuals yet.`
        : `${name} is budgeted at ${money} with no spend recorded yet.`;
    case 'NO_BUDGET':
      return `${name} has actuals but no matching budget.`;
    default: {
      if (Number(favourableVarianceMinor) === 0) return `${name} matches the budget.`;
      if (Number(favourableVarianceMinor) > 0) {
        return isRevenue
          ? `${name} is ${money} ahead of budget.`
          : `${name} is ${money} under budget.`;
      }
      return isRevenue
        ? `${name} is ${money} behind budget.`
        : `${name} is ${money} over budget.`;
    }
  }
}

function formatMoney(amount, currency) {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat('en-MW', {
      style: 'currency',
      currency: currency || 'MWK',
      maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    }).format(n);
  } catch {
    return `${currency || 'MWK'} ${n.toLocaleString()}`;
  }
}

/**
 * Attach `message` to BvA-style report lines.
 */
export function withVarianceMessages(lines, { currency = 'MWK' } = {}) {
  return (lines || []).map((line) => ({
    ...line,
    message: describeVariance({
      accountName: line.accountName || line.accountCode,
      kind: line.kind,
      status: line.status,
      favourableVarianceMinor: line.favourableVarianceMinor,
      variancePercent: line.variancePercent,
      currency,
    }),
  }));
}
