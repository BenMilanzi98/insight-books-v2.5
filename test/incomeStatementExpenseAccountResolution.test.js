import { describe, expect, it } from 'vitest';
import {
  expenseLooksLikePayrollOrSalary,
  resolveIncomeStatementExpenseAccountFields,
} from '../lib/incomeStatementExpenseAccountResolution.js';

describe('incomeStatementExpenseAccountResolution', () => {
  it('reclassifies miscoded non-salary rows posted on 5200', () => {
    const refreshment = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'a1', accountCode: '5200', accountName: 'Salaries & Wages' },
      category: 'General',
      description: 'Executive Meeting Refreshment',
      notes: null,
      tenantNameByCode: new Map(),
    });
    expect(refreshment.accountCode).toBe('5340');

    const food = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'a1', accountCode: '5200', accountName: 'Salaries & Wages' },
      category: 'Allowance',
      description: 'Food allowance',
      notes: null,
      tenantNameByCode: new Map(),
    });
    expect(food.accountCode).toBe('5340');
  });

  it('routes payroll and salary rows to 5200', () => {
    const payroll = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'a1', accountCode: '5200', accountName: 'Salaries & Wages' },
      category: 'Salary',
      description: 'March payroll net pay',
      notes: null,
      isPayrollGl: true,
      tenantNameByCode: new Map([['5200', 'Salaries & Wages']]),
    });
    expect(payroll.accountCode).toBe('5200');

    expect(
      expenseLooksLikePayrollOrSalary({
        category: 'Salary',
        description: 'March payroll',
        notes: null,
      })
    ).toBe(true);
    expect(
      expenseLooksLikePayrollOrSalary({
        category: 'General',
        description: 'Facebook Ads',
        notes: null,
      })
    ).toBe(false);
  });
});
