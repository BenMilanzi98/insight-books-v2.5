import { describe, it, expect } from 'vitest';
import {
  normalizeExpenseAmountsForGl,
  assertExpenseEligibleForGlPosting
} from '../lib/expenseGlPosting.js';

describe('normalizeExpenseAmountsForGl', () => {
  it('treats full amount as base when tax is zero', () => {
    expect(normalizeExpenseAmountsForGl(1000, 0)).toEqual({ base: 1000, tax: 0 });
    expect(normalizeExpenseAmountsForGl(1000, null)).toEqual({ base: 1000, tax: 0 });
  });

  it('splits gross into base and tax', () => {
    expect(normalizeExpenseAmountsForGl(1100, 100)).toEqual({ base: 1000, tax: 100 });
  });

  it('throws when tax exceeds gross', () => {
    expect(() => normalizeExpenseAmountsForGl(100, 150)).toThrow(/cannot exceed/i);
  });
});

describe('assertExpenseEligibleForGlPosting', () => {
  it('throws for pending payment without supplier', () => {
    expect(() =>
      assertExpenseEligibleForGlPosting({
        paymentStatus: 'Pending',
        supplierId: null,
        expenseAccountId: 'acc1',
        paymentMethod: 'cash'
      })
    ).toThrow(/no supplier/i);
  });

  it('allows pending with supplier', () => {
    expect(() =>
      assertExpenseEligibleForGlPosting({
        paymentStatus: 'Pending',
        supplierId: 'sup1',
        expenseAccountId: 'acc1',
        paymentMethod: null
      })
    ).not.toThrow();
  });

  it('requires payment method when not pending', () => {
    expect(() =>
      assertExpenseEligibleForGlPosting({
        paymentStatus: 'Fully paid',
        supplierId: null,
        expenseAccountId: 'acc1',
        paymentMethod: ''
      })
    ).toThrow(/Payment method is required/i);
  });
});
