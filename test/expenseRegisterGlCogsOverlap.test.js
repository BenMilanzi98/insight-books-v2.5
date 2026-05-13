import { describe, expect, it } from 'vitest';
import {
  expenseCategoryLabelLooksLikeCogs,
  expenseOverlapsGlCogsForDedup,
  isGlCogsWindowActive,
} from '../lib/expenseRegisterGlCogsOverlap.js';

describe('expenseRegisterGlCogsOverlap', () => {
  it('detects common COGS labels', () => {
    expect(expenseCategoryLabelLooksLikeCogs('Cost of Goods Sold')).toBe(true);
    expect(expenseCategoryLabelLooksLikeCogs('cost of goods sold')).toBe(true);
    expect(expenseCategoryLabelLooksLikeCogs('COGS')).toBe(true);
    expect(expenseCategoryLabelLooksLikeCogs('Cost of Sales')).toBe(true);
    expect(expenseCategoryLabelLooksLikeCogs('Rent')).toBe(false);
  });

  it('isGlCogsWindowActive is false when no GL activity', () => {
    expect(isGlCogsWindowActive(0, 0)).toBe(false);
  });

  it('isGlCogsWindowActive is true when there are lines even if net is 0', () => {
    expect(isGlCogsWindowActive(0, 3)).toBe(true);
  });

  it('isGlCogsWindowActive is true when net COGS is non-zero', () => {
    expect(isGlCogsWindowActive(120.5, 0)).toBe(true);
  });

  it('does not dedupe legacy label when GL window is inactive', () => {
    const cogs = new Set(['acc1']);
    const exp = {
      expenseAccountId: null,
      categoryId: null,
      category: 'Cost of Goods Sold',
      expenseCategory: null,
    };
    expect(expenseOverlapsGlCogsForDedup(exp, cogs, false)).toBe(false);
  });

  it('dedupes legacy label when GL window is active', () => {
    const cogs = new Set(['acc1']);
    const exp = {
      expenseAccountId: null,
      categoryId: null,
      category: 'Cost of Goods Sold',
      expenseCategory: null,
    };
    expect(expenseOverlapsGlCogsForDedup(exp, cogs, true)).toBe(true);
  });

  it('dedupes when expense account is a COGS id', () => {
    const cogs = new Set(['acc1']);
    const exp = {
      expenseAccountId: 'acc1',
      categoryId: 'cat1',
      category: 'Whatever',
      expenseCategory: { accountId: 'other' },
    };
    expect(expenseOverlapsGlCogsForDedup(exp, cogs, true)).toBe(true);
  });

  it('does not use legacy label when categoryId is set', () => {
    const cogs = new Set(['acc1']);
    const exp = {
      expenseAccountId: null,
      categoryId: 'someCategoryRow',
      category: 'Cost of Goods Sold',
      expenseCategory: { accountId: 'rent-acc' },
    };
    expect(expenseOverlapsGlCogsForDedup(exp, cogs, true)).toBe(false);
  });
});
