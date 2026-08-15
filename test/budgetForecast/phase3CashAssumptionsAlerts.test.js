import { describe, it, expect } from 'vitest';
import { rollForwardCash, buildCashMonthsFromLines } from '@/lib/budgetForecast/domain/cashRollForward.js';
import { scheduleOpenBalancesByMonth, totalScheduled } from '@/lib/budgetForecast/domain/arApSchedule.js';
import {
  applyAssumptionsToAmount,
  growthPercentFromAssumptions,
} from '@/lib/budgetForecast/domain/assumptionApply.js';
import { buildForecastAlerts } from '@/lib/budgetForecast/domain/forecastAlerts.js';

describe('rollForwardCash', () => {
  it('rolls opening through receipts and payments', () => {
    const months = rollForwardCash({
      openingCash: 1000,
      months: [
        { key: '2026-01', expectedReceipts: 500, expectedPayments: 200 },
        { key: '2026-02', expectedReceipts: 100, expectedPayments: 800 },
      ],
    });
    expect(months[0].openingCash).toBe(1000);
    expect(months[0].closingCash).toBe(1300);
    expect(months[1].openingCash).toBe(1300);
    expect(months[1].closingCash).toBe(600);
    expect(months[1].warning).toBeNull();
  });

  it('flags cash dip', () => {
    const months = rollForwardCash({
      openingCash: 100,
      months: [{ key: '2026-01', expectedReceipts: 0, expectedPayments: 250 }],
    });
    expect(months[0].closingCash).toBe(-150);
    expect(months[0].warning).toBe('CASH_DIP');
  });

  it('builds months from line period amounts', () => {
    const months = buildCashMonthsFromLines(
      [
        {
          accountTypeSnapshot: 'Revenue',
          periodAmounts: [{ key: '2026-01', forecastAmountMinor: 400 }],
        },
        {
          accountTypeSnapshot: 'Expense',
          periodAmounts: [{ key: '2026-01', forecastAmountMinor: 100 }],
        },
      ],
      [{ key: '2026-01', periodStart: '2026-01-01' }],
      (type) => (String(type).toLowerCase().includes('revenue') ? 'REVENUE' : 'EXPENSE')
    );
    expect(months[0].expectedReceipts).toBe(400);
    expect(months[0].expectedPayments).toBe(100);
  });
});

describe('scheduleOpenBalancesByMonth', () => {
  it('maps aging buckets into early months', () => {
    const months = scheduleOpenBalancesByMonth(
      [
        { bucket: 'current', minor: 100 },
        { bucket: 'd31_60', minor: 50 },
        { bucket: 'd120_plus', minor: 20 },
      ],
      4
    );
    expect(months[0]).toBe(100);
    expect(months[1]).toBe(50);
    expect(months[3]).toBe(20);
    expect(totalScheduled(months)).toBe(170);
  });
});

describe('assumptionApply', () => {
  it('applies account percent overlays only (global via growthPercentFromAssumptions)', () => {
    expect(
      applyAssumptionsToAmount(1000, [{ scopeType: 'GLOBAL', unit: 'PERCENT', value: 10 }])
    ).toBe(1000);
    expect(
      applyAssumptionsToAmount(
        1000,
        [{ scopeType: 'ACCOUNT', accountId: 'a1', unit: 'PERCENT', value: 5 }],
        { accountId: 'a1' }
      )
    ).toBe(1050);
    expect(
      applyAssumptionsToAmount(
        1000,
        [{ scopeType: 'ACCOUNT', accountId: 'a1', unit: 'PERCENT', value: 5 }],
        { accountId: 'a2' }
      )
    ).toBe(1000);
  });

  it('sums growth assumptions', () => {
    expect(
      growthPercentFromAssumptions([
        { assumptionType: 'GROWTH', scopeType: 'GLOBAL', unit: 'PERCENT', value: 5 },
        { assumptionType: 'INFLATION', scopeType: 'GLOBAL', unit: 'PERCENT', value: 2 },
      ])
    ).toBe(7);
  });
});

describe('buildForecastAlerts', () => {
  it('emits cash dip and variance alerts', () => {
    const alerts = buildForecastAlerts({
      cashMonths: [{ key: '2026-03', closingCash: -10, warning: 'CASH_DIP' }],
      forecastRevenueMinor: 700,
      budgetRevenueMinor: 1000,
      forecastExpenseMinor: 1200,
      budgetExpenseMinor: 1000,
      method: 'BUDGET_REMAINDER',
      sourceBudgetId: null,
    });
    expect(alerts.map((a) => a.key)).toEqual(
      expect.arrayContaining(['cash_dip', 'revenue_shortfall', 'expense_over', 'missing_source_budget'])
    );
  });
});
