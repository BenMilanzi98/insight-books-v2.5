/**
 * Apply ForecastAssumption rows as growth overlays (PERCENT unit).
 */

/**
 * @param {number} baseAmount
 * @param {Array<{ assumptionType?: string, scopeType?: string, scopeId?: string, accountId?: string, value?: number, unit?: string }>} assumptions
 * @param {{ accountId?: string }} [ctx]
 * @returns {number}
 */
export function applyAssumptionsToAmount(baseAmount, assumptions = [], ctx = {}) {
  let amount = Number(baseAmount) || 0;
  const accountId = ctx.accountId || null;

  for (const a of assumptions || []) {
    const unit = String(a.unit || 'PERCENT').toUpperCase();
    if (unit !== 'PERCENT') continue;
    const scope = String(a.scopeType || 'GLOBAL').toUpperCase();
    // GLOBAL growth is applied via growthPercentFromAssumptions + projectForecastAmount.
    if (scope !== 'ACCOUNT') continue;
    const target = a.accountId || a.scopeId;
    if (!accountId || target !== accountId) continue;
    const pct = Number(a.value) || 0;
    amount = Math.round(amount * (1 + pct / 100));
  }
  return amount;
}

/**
 * Extra growth percent from GLOBAL GROWTH / INFLATION assumptions (summed).
 */
export function growthPercentFromAssumptions(assumptions = []) {
  let growth = 0;
  for (const a of assumptions || []) {
    const type = String(a.assumptionType || '').toUpperCase();
    const scope = String(a.scopeType || 'GLOBAL').toUpperCase();
    const unit = String(a.unit || 'PERCENT').toUpperCase();
    if (scope !== 'GLOBAL' || unit !== 'PERCENT') continue;
    if (type === 'GROWTH' || type === 'INFLATION' || type === 'REVENUE_GROWTH' || type === 'COST_INFLATION') {
      growth += Number(a.value) || 0;
    }
  }
  return growth;
}
