/**
 * Product demand velocity helpers (unit-agnostic qty / money).
 */

/**
 * @param {number} qtySold
 * @param {number} lookbackMonths
 * @returns {number} average monthly qty
 */
export function monthlyVelocity(qtySold, lookbackMonths = 1) {
  const months = Math.max(1, Number(lookbackMonths) || 1);
  return (Number(qtySold) || 0) / months;
}

/**
 * Suggested demand qty over horizon.
 */
export function suggestedDemandQty(avgMonthlyQty, horizonMonths = 1) {
  return Math.max(0, Math.round((Number(avgMonthlyQty) || 0) * Math.max(1, Number(horizonMonths) || 1) * 100) / 100);
}

/**
 * Units to reorder: demand − on-hand, floored at 0. If reorderPoint set, ensure stock+order >= reorderPoint+demand buffer.
 */
export function reorderGapQty({ stockLevel = 0, reorderPoint = 0, demandQty = 0 } = {}) {
  const stock = Number(stockLevel) || 0;
  const reorder = Number(reorderPoint) || 0;
  const demand = Number(demandQty) || 0;
  const coverDemand = Math.max(0, demand - stock);
  const coverReorder = Math.max(0, reorder - stock);
  return Math.max(coverDemand, coverReorder);
}

/**
 * Purchase cost minor/major in same unit as unitCost.
 */
export function suggestedPurchaseAmount(gapQty, unitCost = 0) {
  return Math.round((Number(gapQty) || 0) * (Number(unitCost) || 0) * 100) / 100;
}

/**
 * Spread purchase amount across months (front-load first month for urgency).
 */
export function schedulePurchaseByMonth(totalAmount, periodsCount = 1) {
  const n = Math.max(1, Number(periodsCount) || 1);
  const total = Math.round(Number(totalAmount) || 0);
  if (n === 1) return [total];
  const first = Math.round(total * 0.5);
  const rest = total - first;
  const base = Math.floor(rest / (n - 1));
  const rem = rest - base * (n - 1);
  return [first, ...Array.from({ length: n - 1 }, (_, i) => base + (i === n - 2 ? rem : 0))];
}
