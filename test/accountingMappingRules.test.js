import { describe, expect, it } from 'vitest';
import {
  CANONICAL_SALARY_ACCOUNT_CODE,
  getExpenseAccountValidationError,
  isCanonicalSalaryExpenseAccount,
  isPostableExpenseAccount,
  isSalaryLikeExpenseAccount,
  toExpenseAccountOption,
  assertNoDuplicatePostedSource,
} from '../lib/accountingMappingRules.js';

const baseExpense = {
  id: 'acc-1',
  tenantId: 'tenant-1',
  accountCode: '5355',
  accountName: 'Repairs',
  accountType: 'Expense',
  isActive: true,
  mergedIntoAccountId: null,
  acceptsNewTransactions: true,
  visibleInChart: true,
  _count: { childAccounts: 0 },
};

describe('accounting mapping rules', () => {
  it('allows active leaf CoA expense accounts in 5000-5999', () => {
    expect(isPostableExpenseAccount(baseExpense, { tenantId: 'tenant-1' })).toBe(true);
    expect(getExpenseAccountValidationError(baseExpense, { tenantId: 'tenant-1' })).toBe(null);
  });

  it('rejects non-expense, inactive, parent, and out-of-range accounts with specific messages', () => {
    expect(getExpenseAccountValidationError({ ...baseExpense, accountType: 'Asset' })).toMatch(/not an Expense account/);
    expect(getExpenseAccountValidationError({ ...baseExpense, isActive: false })).toMatch(/inactive/);
    expect(getExpenseAccountValidationError({ ...baseExpense, _count: { childAccounts: 1 } })).toMatch(/consolidation parent/);
    expect(getExpenseAccountValidationError({ ...baseExpense, accountCode: '6999' })).toMatch(/outside the 5000-5999/);
  });

  it('pins salary and payroll-like accounts to canonical 5200 only', () => {
    const canonical = {
      ...baseExpense,
      id: 'salary',
      accountCode: CANONICAL_SALARY_ACCOUNT_CODE,
      accountName: 'Salaries & Wages',
    };
    const duplicate = {
      ...baseExpense,
      id: 'salary-dup',
      accountCode: '5201',
      accountName: 'Admin & Management Salaries',
    };

    expect(isCanonicalSalaryExpenseAccount(canonical)).toBe(true);
    expect(isSalaryLikeExpenseAccount(duplicate)).toBe(true);
    expect(getExpenseAccountValidationError(duplicate)).toMatch(/must use 5200 - Salaries & Wages/);
  });

  it('projects expense picker options as account-backed rows', () => {
    expect(toExpenseAccountOption(baseExpense)).toMatchObject({
      id: 'acc-1',
      accountId: 'acc-1',
      code: '5355',
      accountCode: '5355',
      name: 'Repairs',
      accountName: 'Repairs',
      expenseCategoryId: null,
    });
  });

  it('detects duplicate posted sources through the supplied db client', async () => {
    const db = { transaction: { count: async () => 1 } };
    await expect(
      assertNoDuplicatePostedSource({
        tenantId: 'tenant-1',
        sourceType: 'Expense',
        sourceId: 'exp-1',
        db,
      })
    ).rejects.toThrow(/Duplicate posted GL source/);
  });
});
