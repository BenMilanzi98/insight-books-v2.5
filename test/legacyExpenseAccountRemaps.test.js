import { describe, expect, it } from 'vitest';
import {
  applyLegacyExpenseAccountCodeRemap,
  CANONICAL_IT_HOSTING_CODE,
  CANONICAL_OVERTIME_ALLOWANCE_CODE,
  expenseLooksLikeItHostingOrSoftware,
} from '../lib/legacyExpenseAccountRemaps.js';
import { resolveIncomeStatementExpenseAccountFields } from '../lib/incomeStatementExpenseAccountResolution.js';

describe('legacyExpenseAccountRemaps', () => {
  it('merges duplicate overtime allowance 5017 into 5018', () => {
    expect(
      applyLegacyExpenseAccountCodeRemap('5017', {
        category: 'Overtime allowance',
        description: 'December OT',
      })
    ).toMatchObject({
      accountCode: CANONICAL_OVERTIME_ALLOWANCE_CODE,
      remapped: true,
    });
  });

  it('reclassifies software subscriptions off overtime accounts to 5350', () => {
    expect(
      applyLegacyExpenseAccountCodeRemap('5017', {
        description: 'Henry software subscription',
      })
    ).toMatchObject({
      accountCode: CANONICAL_IT_HOSTING_CODE,
      reason: 'software-on-overtime-account',
    });
    expect(
      applyLegacyExpenseAccountCodeRemap('5018', {
        description: 'Ben software subscription',
      })
    ).toMatchObject({
      accountCode: CANONICAL_IT_HOSTING_CODE,
      reason: 'software-on-overtime-account',
    });
  });

  it('maps legacy 5019 Software account to 5350 IT and Hosting', () => {
    expect(
      applyLegacyExpenseAccountCodeRemap('5019', {
        description: 'Cursor AI subscription',
      })
    ).toMatchObject({
      accountCode: CANONICAL_IT_HOSTING_CODE,
      remapped: true,
    });
  });

  it('integrates remaps in income statement expense resolution', () => {
    const hosting = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'sw', accountCode: '5019', accountName: 'Software' },
      category: 'Software',
      description: 'InMotion subscription',
      tenantNameByCode: new Map([['5350', 'IT and Hosting']]),
    });
    expect(hosting.accountCode).toBe('5350');

    expect(
      expenseLooksLikeItHostingOrSoftware({ description: 'Cursor AI subscription' })
    ).toBe(true);
  });

  it('reclassifies miscoded rows off 5360 Legal & Professional Fees', () => {
    const rent = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'lp', accountCode: '5360', accountName: 'Legal & Professional Fees' },
      description: 'Rent',
      tenantNameByCode: new Map([['5300', 'Rent & Lease']]),
    });
    expect(rent.accountCode).toBe('5300');

    const dev = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'lp', accountCode: '5360', accountName: 'Legal & Professional Fees' },
      description: 'System Development Cost',
      tenantNameByCode: new Map([['5350', 'IT and Hosting']]),
    });
    expect(dev.accountCode).toBe('5350');

    const voice = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'lp', accountCode: '5360', accountName: 'Legal & Professional Fees' },
      description: 'Studio Voice over',
      tenantNameByCode: new Map([['5330', 'Marketing & Advertising']]),
    });
    expect(voice.accountCode).toBe('5330');

    const legal = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 'lp', accountCode: '5360', accountName: 'Legal & Professional Fees' },
      description: 'Legal consulting fee',
      tenantNameByCode: new Map(),
    });
    expect(legal.accountCode).toBe('5360');
  });

  it('reclassifies miscoded rows off 5201 Admin & Management Salaries', () => {
    const facebook = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 's1', accountCode: '5201', accountName: 'Admin & Management Salaries' },
      description: 'Facebook Ads (USD)',
      tenantNameByCode: new Map([['5330', 'Marketing & Advertising']]),
    });
    expect(facebook.accountCode).toBe('5330');

    const bank = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 's1', accountCode: '5201', accountName: 'Admin & Management Salaries' },
      description: 'Bank Service Fee',
      tenantNameByCode: new Map([['5500', 'Bank Charges & Interest']]),
    });
    expect(bank.accountCode).toBe('5500');

    const snack = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 's1', accountCode: '5201', accountName: 'Admin & Management Salaries' },
      description: 'Snack for Launch',
      tenantNameByCode: new Map([['5340', 'Travel & Transport']]),
    });
    expect(snack.accountCode).toBe('5340');

    const payroll = resolveIncomeStatementExpenseAccountFields({
      expenseAccount: { id: 's1', accountCode: '5201', accountName: 'Admin & Management Salaries' },
      description: 'March admin payroll net pay',
      isPayrollGl: true,
      tenantNameByCode: new Map([['5200', 'Salaries & Wages']]),
    });
    expect(payroll.accountCode).toBe('5200');
  });
});
