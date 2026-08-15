import { describe, it, expect } from 'vitest';
import { describeVariance, withVarianceMessages } from '@/lib/budgetForecast/domain/varianceCopy';

describe('describeVariance', () => {
  it('explains expense overspend in plain language', () => {
    const msg = describeVariance({
      accountName: 'Marketing',
      kind: 'EXPENSE',
      status: 'OVER_BUDGET',
      favourableVarianceMinor: -75000000,
      variancePercent: -15,
      currency: 'MWK',
    });
    expect(msg).toMatch(/Marketing/i);
    expect(msg).toMatch(/over budget/i);
  });

  it('explains revenue ahead of budget', () => {
    const msg = describeVariance({
      accountName: 'Sales Revenue',
      kind: 'REVENUE',
      status: 'ABOVE_TARGET',
      favourableVarianceMinor: 200000000,
      variancePercent: 8,
    });
    expect(msg).toMatch(/above budget/i);
  });

  it('handles on-track', () => {
    expect(
      describeVariance({
        accountName: 'Rent',
        kind: 'EXPENSE',
        status: 'ON_TRACK',
        favourableVarianceMinor: 0,
      })
    ).toMatch(/on track/i);
  });

  it('attaches messages to lines', () => {
    const rows = withVarianceMessages([
      {
        accountName: 'Utilities',
        kind: 'EXPENSE',
        status: 'UNDER_BUDGET',
        favourableVarianceMinor: 5000000,
        variancePercent: 10,
      },
    ]);
    expect(rows[0].message).toMatch(/under budget/i);
  });
});
