import { describe, expect, it } from 'vitest';
import {
  getExpenseGrossAmount,
  getExpenseOutstandingAmount,
} from '../lib/expenseAmounts.js';

describe('expenseAmounts', () => {
  it('treats amount as gross total due (not amount + tax)', () => {
    const expense = { amount: 116, taxAmount: 16, paidAmount: 0 };
    expect(getExpenseGrossAmount(expense)).toBe(116);
    expect(getExpenseOutstandingAmount(expense)).toBe(116);
  });

  it('computes outstanding after partial pay', () => {
    const expense = { amount: 1000, taxAmount: 150, paidAmount: 400 };
    expect(getExpenseOutstandingAmount(expense)).toBe(600);
  });
});
