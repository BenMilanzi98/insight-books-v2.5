import { describe, expect, it } from 'vitest';
import {
  resolveProductCostPriceForDisplay,
  weightedAverageUnitCost,
} from '../lib/productCostDisplay.js';

describe('productCostDisplay', () => {
  it('returns WAC from totalStockValue ÷ stockLevel when both are set', () => {
    expect(
      resolveProductCostPriceForDisplay({
        stockLevel: 10,
        cost: 300,
        totalStockValue: 2000,
      })
    ).toBe(200);
  });

  it('returns cost when no stock on hand', () => {
    expect(
      resolveProductCostPriceForDisplay({
        stockLevel: 0,
        cost: 100,
        totalStockValue: 500,
      })
    ).toBe(100);
  });

  it('keeps Order Price aligned with stock value for qty 1', () => {
    const product = { stockLevel: 1, cost: 100, totalStockValue: 100 };
    expect(weightedAverageUnitCost(product)).toBe(100);
    expect(weightedAverageUnitCost(product) * product.stockLevel).toBe(100);
  });
});
