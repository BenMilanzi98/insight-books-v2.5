import { describe, expect, it } from 'vitest';
import { productLineValue, sumPhysicalInventoryProductLines } from '../lib/stockValuationAggregate.js';

describe('stockValuationAggregate', () => {
  it('computes line value with decimal qty × cost', () => {
    expect(
      productLineValue({ stockLevel: 3, cost: 10.77, totalStockValue: null })
    ).toBe(32.31);
  });

  it('preserves stored totalStockValue when positive', () => {
    expect(
      productLineValue({ stockLevel: 100, cost: 1, totalStockValue: 10000.73 })
    ).toBe(10000.73);
  });

  it('sums multiple product lines without whole-number rounding', () => {
    const total = sumPhysicalInventoryProductLines([
      { stockLevel: 2, cost: 10000.73, totalStockValue: null },
      { stockLevel: 1, cost: 10.77, totalStockValue: null },
    ]);
    expect(total).toBe(20012.23);
  });
});
