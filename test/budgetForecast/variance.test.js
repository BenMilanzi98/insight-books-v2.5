import { describe, it, expect } from 'vitest';
import {
  computeVariance,
  classifyAccountKind,
  VARIANCE_STATUS,
} from '../../lib/budgetForecast/domain/variance.js';

describe('computeVariance', () => {
  it('computes raw and favourable variance for expenses', () => {
    const v = computeVariance('EXPENSE', 100_000, 80_000);
    expect(v.rawVarianceMinor).toBe(-20_000);
    expect(v.favourableVarianceMinor).toBe(20_000);
    expect(v.isFavourable).toBe(true);
    expect(v.status).toBe(VARIANCE_STATUS.UNDER_BUDGET);
    expect(v.variancePercent).toBeCloseTo(20);
  });

  it('marks overspending as unfavourable for expenses', () => {
    const v = computeVariance('EXPENSE', 100_000, 120_000);
    expect(v.rawVarianceMinor).toBe(20_000);
    expect(v.favourableVarianceMinor).toBe(-20_000);
    expect(v.isFavourable).toBe(false);
    expect(v.status).toBe(VARIANCE_STATUS.OVER_BUDGET);
  });

  it('treats revenue above budget as favourable', () => {
    const v = computeVariance('REVENUE', 100_000, 120_000);
    expect(v.rawVarianceMinor).toBe(20_000);
    expect(v.favourableVarianceMinor).toBe(20_000);
    expect(v.status).toBe(VARIANCE_STATUS.ABOVE_TARGET);
  });

  it('uses NEW_UNPLANNED_ACTIVITY when budget is zero with actual', () => {
    const v = computeVariance('EXPENSE', 0, 5_000);
    expect(v.variancePercent).toBeNull();
    expect(v.percentState).toBe('NEW_UNPLANNED_ACTIVITY');
    expect(v.status).toBe(VARIANCE_STATUS.NEW_UNPLANNED_ACTIVITY);
    expect(v.actualMinor).toBe(5_000);
  });

  it('returns ON_TRACK when variance is essentially zero', () => {
    const v = computeVariance('EXPENSE', 50_000, 50_000);
    expect(v.status).toBe(VARIANCE_STATUS.ON_TRACK);
    expect(v.favourableVarianceMinor).toBe(0);
  });
});

describe('classifyAccountKind', () => {
  it('prefers CoA category', () => {
    expect(classifyAccountKind('Expense', 'REVENUE')).toBe('REVENUE');
    expect(classifyAccountKind('Expense', 'COST_OF_SALES')).toBe('COST_OF_SALES');
  });

  it('falls back to account type', () => {
    expect(classifyAccountKind('Income', null)).toBe('REVENUE');
    expect(classifyAccountKind('Expense', null)).toBe('EXPENSE');
  });
});
