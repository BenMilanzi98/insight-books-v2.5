import { describe, expect, it } from 'vitest';
import {
  computeWeightedAverageAfterReceipt,
  resolveOrderPriceForExport,
} from '../../lib/stock/weightedAverageCost.js';

describe('computeWeightedAverageAfterReceipt', () => {
  it('matches workflow 2: 10@100 + 5@160 → 15 qty, 1800 value, 120 WAC', () => {
    const r = computeWeightedAverageAfterReceipt(
      { quantity: 10, unitCost: 100 },
      { quantity: 5, unitCost: 160 }
    );
    expect(r.newQuantity).toBe(15);
    expect(r.newValue).toBe(1800);
    expect(r.newWeightedAverageCost).toBe(120);
    expect(r.importedValue).toBe(800);
    expect(r.existingValue).toBe(1000);
  });

  it('rejects non-positive imported quantity and negative costs', () => {
    expect(() =>
      computeWeightedAverageAfterReceipt({ quantity: 1, unitCost: 10 }, { quantity: 0, unitCost: 10 })
    ).toThrow(/Imported quantity/);
    expect(() =>
      computeWeightedAverageAfterReceipt({ quantity: 1, unitCost: -1 }, { quantity: 1, unitCost: 10 })
    ).toThrow(/Unit cost/);
  });
});

describe('resolveOrderPriceForExport', () => {
  it('exports WAC from total value / quantity', () => {
    expect(resolveOrderPriceForExport({ quantity: 15, totalValue: 1800, averageCost: 999 })).toBe(120);
  });
});
