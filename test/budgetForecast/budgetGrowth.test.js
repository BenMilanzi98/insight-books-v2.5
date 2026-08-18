import { describe, it, expect } from 'vitest';
import {
  applyGrowthSeries,
  applyGrowthToPeriodMap,
  BUDGET_GROWTH_MODES,
} from '../../lib/budgetForecast/domain/budgetGrowth.js';

describe('applyGrowthSeries', () => {
  it('applies percentage growth each period', () => {
    const amounts = applyGrowthSeries(10_000_000, 3, {
      mode: BUDGET_GROWTH_MODES.GROWTH_PERCENT,
      growthPercent: 10,
    });
    expect(amounts[0]).toBe(10_000_000);
    expect(amounts[1]).toBe(11_000_000);
    expect(amounts[2]).toBe(12_100_000);
  });

  it('applies fixed increment each period', () => {
    const amounts = applyGrowthSeries(10_000_000, 2, {
      mode: BUDGET_GROWTH_MODES.GROWTH_FIXED,
      fixedIncrement: 5_000_000,
    });
    expect(amounts[1]).toBe(15_000_000);
  });
});

describe('applyGrowthToPeriodMap', () => {
  it('writes growth series into period key map', () => {
    const result = applyGrowthToPeriodMap(
      ['2026-01', '2026-02'],
      { '2026-01': '100' },
      { mode: BUDGET_GROWTH_MODES.GROWTH_PERCENT, growthPercent: 10 }
    );
    expect(result['2026-01']).toBe('100');
    expect(Number(result['2026-02'])).toBe(110);
  });
});
