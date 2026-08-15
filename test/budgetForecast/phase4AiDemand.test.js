import { describe, it, expect } from 'vitest';
import {
  monthlyVelocity,
  suggestedDemandQty,
  reorderGapQty,
  suggestedPurchaseAmount,
  schedulePurchaseByMonth,
} from '@/lib/budgetForecast/domain/demandVelocity.js';
import { buildHeuristicSuggestions } from '@/lib/budgetForecast/domain/aiHeuristic.js';

describe('demandVelocity', () => {
  it('computes velocity, demand, gap and purchase', () => {
    expect(monthlyVelocity(120, 6)).toBe(20);
    expect(suggestedDemandQty(20, 3)).toBe(60);
    expect(reorderGapQty({ stockLevel: 10, reorderPoint: 25, demandQty: 60 })).toBe(50);
    expect(suggestedPurchaseAmount(10, 15.5)).toBe(155);
  });

  it('front-loads purchase schedule', () => {
    const s = schedulePurchaseByMonth(100, 4);
    expect(s[0]).toBe(50);
    expect(s.reduce((a, b) => a + b, 0)).toBe(100);
  });
});

describe('buildHeuristicSuggestions', () => {
  it('suggests growth from revenue series and cash dip action', () => {
    const suggestions = buildHeuristicSuggestions({
      revenueByPeriodMinor: [1000, 1100, 1210],
      expenseByPeriodMinor: [500, 520, 540],
      hasCashDip: true,
    });
    expect(suggestions.some((s) => s.suggestionKey === 'revenueGrowthPercent')).toBe(true);
    expect(suggestions.some((s) => s.suggestionKey === 'cashDipAction')).toBe(true);
    expect(suggestions.every((s) => s.reason)).toBe(true);
  });
});
