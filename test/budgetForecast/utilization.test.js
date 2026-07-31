import { describe, it, expect } from 'vitest';
import {
  expenseUtilization,
  revenueAchievement,
} from '../../lib/budgetForecast/domain/utilization.js';

describe('expenseUtilization', () => {
  it('computes percent and remaining', () => {
    const u = expenseUtilization(200_000, 100_000);
    expect(u.utilizationPercent).toBe(50);
    expect(u.remainingMinor).toBe(100_000);
    expect(u.status).toBe('UNDER_UTILIZED');
  });

  it('flags over budget', () => {
    const u = expenseUtilization(100_000, 150_000);
    expect(u.utilizationPercent).toBe(150);
    expect(u.status).toBe('OVER_BUDGET');
    expect(u.remainingMinor).toBe(-50_000);
  });

  it('handles zero budget without dividing', () => {
    const u = expenseUtilization(0, 10_000);
    expect(u.utilizationPercent).toBeNull();
    expect(u.state).toBe('NO_BUDGET');
    expect(u.status).toBe('NO_BUDGET');
  });
});

describe('revenueAchievement', () => {
  it('computes achievement percent', () => {
    const a = revenueAchievement(100_000, 90_000);
    expect(a.achievementPercent).toBe(90);
    expect(a.status).toBe('NEAR_TARGET');
  });

  it('marks above target at 100%+', () => {
    const a = revenueAchievement(100_000, 110_000);
    expect(a.achievementPercent).toBe(110);
    expect(a.status).toBe('ABOVE_TARGET');
  });
});
