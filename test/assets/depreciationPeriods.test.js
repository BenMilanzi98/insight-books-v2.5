import { describe, expect, it } from 'vitest';
import {
  calcDepreciationAmount,
  yearFractionForFrequency,
  yearFractionFromDates,
} from '../../lib/assets/depreciationPeriods.js';

describe('depreciationPeriods', () => {
  it('maps presets to year fractions', () => {
    expect(yearFractionForFrequency('year', 1)).toBe(1);
    expect(yearFractionForFrequency('month', 1)).toBeCloseTo(1 / 12);
    expect(yearFractionForFrequency('quarter', 1)).toBeCloseTo(1 / 4);
    expect(yearFractionForFrequency('week', 1)).toBeCloseTo(1 / 52);
    expect(yearFractionForFrequency('day', 1)).toBeCloseTo(1 / 365.25);
    expect(yearFractionForFrequency('hour', 1)).toBeCloseTo(1 / (365.25 * 24));
    expect(yearFractionForFrequency('month', 3)).toBeCloseTo(3 / 12);
  });

  it('calculates straight-line month as 1/12 of annual', () => {
    const asset = {
      originalCost: 12000,
      usefulLifeYears: 10,
      depreciationMethod: 'straight_line',
      accumulatedDepreciation: 0,
    };
    const annual = 12000 / 10;
    const amount = calcDepreciationAmount(asset, {
      frequency: 'month',
      periodCount: 1,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
    });
    expect(amount).toBeCloseTo(annual / 12, 5);
  });

  it('does not exceed remaining book value', () => {
    const asset = {
      originalCost: 1000,
      usefulLifeYears: 1,
      depreciationMethod: 'straight_line',
      accumulatedDepreciation: 999,
    };
    const amount = calcDepreciationAmount(asset, {
      frequency: 'year',
      periodCount: 1,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
    });
    expect(amount).toBeCloseTo(1, 5);
  });

  it('custom range uses date span', () => {
    const frac = yearFractionFromDates(new Date('2026-01-01T00:00:00Z'), new Date('2026-01-02T00:00:00Z'));
    expect(frac).toBeCloseTo(1 / 365.25, 5);
  });
});
