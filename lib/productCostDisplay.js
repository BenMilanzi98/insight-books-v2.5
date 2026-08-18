/**
 * Cost shown on product master / stock list ("Order Price").
 * When FIFO valuation exists, use weighted-average cost (totalStockValue ÷ qty)
 * so Order Price matches Stock Value ÷ Quantity on /stock.
 */
import { parseMoney, roundMoney } from './money.js';

/**
 * @param {object|null|undefined} product
 * @returns {number}
 */
export function weightedAverageUnitCost(product) {
  if (!product) return 0;
  const qty = parseMoney(product.stockLevel ?? product.quantityInStock ?? 0);
  if (!(qty > 0)) {
    const fallback = product.cost ?? product.averageCost ?? product.lastPurchaseCost ?? 0;
    return roundMoney(parseMoney(fallback));
  }
  const tsv =
    product.totalStockValue != null && product.totalStockValue !== ''
      ? parseMoney(product.totalStockValue)
      : NaN;
  if (Number.isFinite(tsv) && tsv > 0) {
    return roundMoney(tsv / qty);
  }
  if (product.cost != null && Number.isFinite(Number(product.cost))) {
    return roundMoney(Number(product.cost));
  }
  const lpc = product.lastPurchaseCost != null ? Number(product.lastPurchaseCost) : NaN;
  if (Number.isFinite(lpc) && lpc > 0) return roundMoney(lpc);
  const ac = product.averageCost != null ? Number(product.averageCost) : NaN;
  if (Number.isFinite(ac) && ac > 0) return roundMoney(ac);
  return 0;
}

export function resolveProductCostPriceForDisplay(product) {
  return weightedAverageUnitCost(product);
}
