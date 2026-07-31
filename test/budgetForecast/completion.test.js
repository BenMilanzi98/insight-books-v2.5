import { describe, it, expect } from 'vitest';
import {
  computeBudgetCompletion,
  summarizeLinesForCompletion,
} from '../../lib/budgetForecast/domain/completion.js';

describe('computeBudgetCompletion', () => {
  it('returns an explainable checklist score', () => {
    const result = computeBudgetCompletion({
      requiredGroupsSelected: true,
      lineCount: 5,
      monthsWithValues: 12,
      totalMonths: 12,
      hasRevenue: true,
      hasExpense: true,
      hasNotes: true,
      validationErrorCount: 0,
    });
    expect(result.percent).toBe(100);
    expect(result.label).toMatch(/100% complete/);
    expect(result.checks.every((c) => c.passed)).toBe(true);
    expect(result.remaining).toEqual([]);
  });

  it('partially scores incomplete months', () => {
    const result = computeBudgetCompletion({
      lineCount: 2,
      monthsWithValues: 6,
      totalMonths: 12,
      hasRevenue: false,
      hasExpense: true,
      hasNotes: false,
      validationErrorCount: 1,
    });
    expect(result.percent).toBeLessThan(100);
    expect(result.remaining.length).toBeGreaterThan(0);
    const months = result.checks.find((c) => c.id === 'months');
    expect(months.score).toBe(13); // round(25 * 0.5)
    expect(months.passed).toBe(false);
  });
});

describe('summarizeLinesForCompletion', () => {
  it('detects revenue/expense and filled months', () => {
    const summary = summarizeLinesForCompletion([
      {
        accountTypeSnapshot: 'Income',
        notes: 'growth',
        periodAmounts: [
          { periodStart: '2026-01-01', plannedAmountMinor: 100 },
          { periodStart: '2026-02-01', plannedAmountMinor: 0 },
        ],
      },
      {
        accountTypeSnapshot: 'Expense',
        periodAmounts: [{ periodStart: '2026-01-01', plannedAmountMinor: 50 }],
      },
    ]);
    expect(summary.lineCount).toBe(2);
    expect(summary.hasRevenue).toBe(true);
    expect(summary.hasExpense).toBe(true);
    expect(summary.hasNotes).toBe(true);
    expect(summary.monthsWithValues).toBe(1);
  });
});
