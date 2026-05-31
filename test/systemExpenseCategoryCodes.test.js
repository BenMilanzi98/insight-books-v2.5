import { describe, it, expect } from 'vitest';
import {
  isTenantExpenseCategoryAccount,
  isSystemExpenseStructureCode,
  isSystemExpenseStructurePickerAccount,
} from '../lib/systemExpenseCategoryCodes.js';

describe('isTenantExpenseCategoryAccount', () => {
  it('accepts blueprint expense code with Expense type', () => {
    expect(isTenantExpenseCategoryAccount({ accountCode: '5100', accountType: 'Expense' })).toBe(true);
    expect(isSystemExpenseStructureCode('5100')).toBe(true);
  });

  it('accepts custom CoA expense code in 5000–5999', () => {
    expect(isTenantExpenseCategoryAccount({ accountCode: '5355', accountType: 'Expense' })).toBe(true);
    expect(isSystemExpenseStructureCode('5355')).toBe(false);
  });

  it('rejects expense-range code with wrong account type', () => {
    expect(isTenantExpenseCategoryAccount({ accountCode: '5100', accountType: 'Asset' })).toBe(false);
  });

  it('rejects equity 500000 even if mislabeled', () => {
    expect(isTenantExpenseCategoryAccount({ accountCode: '500000', accountType: 'Expense' })).toBe(false);
  });

  it('rejects merge-source rows when requireNotMerged', () => {
    expect(
      isTenantExpenseCategoryAccount({
        accountCode: '5320',
        accountType: 'Expense',
        mergedIntoAccountId: 'survivor-id',
      })
    ).toBe(false);
    expect(
      isTenantExpenseCategoryAccount(
        {
          accountCode: '5320',
          accountType: 'Expense',
          mergedIntoAccountId: 'survivor-id',
        },
        { requireNotMerged: false }
      )
    ).toBe(true);
  });

  it('returns false for null or non-object', () => {
    expect(isTenantExpenseCategoryAccount(null)).toBe(false);
    expect(isTenantExpenseCategoryAccount(undefined)).toBe(false);
  });
});

describe('isSystemExpenseStructurePickerAccount', () => {
  it('matches tenant expense check for all expense-range CoA accounts', () => {
    expect(isSystemExpenseStructurePickerAccount({ accountCode: '5320', accountType: 'Expense' })).toBe(true);
    expect(isSystemExpenseStructurePickerAccount({ accountCode: '5355', accountType: 'Expense' })).toBe(true);
  });

  it('rejects non-expense same as tenant helper', () => {
    expect(isSystemExpenseStructurePickerAccount({ accountCode: '5320', accountType: 'Asset' })).toBe(false);
  });
});
