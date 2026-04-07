/**
 * Cost shown on product master / stock list.
 * Prefer explicit `cost` (what the user edits on the product form); otherwise last purchase / average.
 */
export function resolveProductCostPriceForDisplay(product) {
  if (!product) return 0;
  if (product.cost != null && Number.isFinite(Number(product.cost))) {
    return Number(product.cost);
  }
  const lpc = product.lastPurchaseCost != null ? Number(product.lastPurchaseCost) : NaN;
  if (Number.isFinite(lpc)) return lpc;
  const ac = product.averageCost != null ? Number(product.averageCost) : NaN;
  if (Number.isFinite(ac)) return ac;
  return 0;
}
