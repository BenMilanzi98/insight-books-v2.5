/**
 * Deterministic heuristic suggestions for Budget & Forecast (review-only).
 */

/**
 * @param {object} input
 * @param {number[]} [input.revenueByPeriodMinor]
 * @param {number[]} [input.expenseByPeriodMinor]
 * @param {boolean} [input.hasCashDip]
 * @returns {Array<{ category: string, suggestionKey: string, proposedValue: object, reason: string, confidence: string }>}
 */
export function buildHeuristicSuggestions({
  revenueByPeriodMinor = [],
  expenseByPeriodMinor = [],
  hasCashDip = false,
} = {}) {
  const out = [];
  const rev = (revenueByPeriodMinor || []).map((n) => Number(n) || 0);
  const exp = (expenseByPeriodMinor || []).map((n) => Number(n) || 0);

  if (rev.length >= 3) {
    const first = rev[0];
    const last = rev[rev.length - 1];
    let growthPercent = 0.5;
    let confidence = 'LOW';
    if (first > 0) {
      const months = rev.length - 1;
      growthPercent = Math.round(((last - first) / first / months) * 10000) / 100;
      growthPercent = Math.max(-50, Math.min(50, growthPercent));
      confidence = rev.length >= 12 ? 'MODERATE' : 'LOW';
    }
    out.push({
      category: 'REVENUE',
      suggestionKey: 'revenueGrowthPercent',
      proposedValue: { growthPercent, unit: 'PERCENT' },
      reason: `Derived from ${rev.length} revenue observations (deterministic heuristic). Review only — not approved.`,
      confidence,
    });
  } else {
    out.push({
      category: 'REVENUE',
      suggestionKey: 'revenueGrowthPercent',
      proposedValue: { growthPercent: 0.5, unit: 'PERCENT' },
      reason: 'Insufficient revenue history; modest default growth for review only.',
      confidence: 'LOW',
    });
  }

  if (exp.length >= 3) {
    const first = exp[0];
    const last = exp[exp.length - 1];
    let inflationPercent = 0.3;
    if (first > 0) {
      const months = exp.length - 1;
      inflationPercent = Math.round(((last - first) / first / months) * 10000) / 100;
      inflationPercent = Math.max(-20, Math.min(40, inflationPercent));
    }
    out.push({
      category: 'EXPENSE',
      suggestionKey: 'expenseInflationPercent',
      proposedValue: { growthPercent: inflationPercent, unit: 'PERCENT' },
      reason: `Expense trend across ${exp.length} observations. Review only.`,
      confidence: exp.length >= 12 ? 'MODERATE' : 'LOW',
    });
  }

  if (hasCashDip) {
    out.push({
      category: 'CASH',
      suggestionKey: 'cashDipAction',
      proposedValue: { action: 'REVIEW_RECEIPTS_AND_PAYABLES', unit: 'ACTION' },
      reason: 'Cash outlook shows a month below zero. Consider collection push or payment timing — review only.',
      confidence: 'MODERATE',
    });
  }

  return out;
}
