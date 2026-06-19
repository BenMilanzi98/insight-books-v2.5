import { describe, expect, it } from 'vitest';
import { resolveOperatingExpenseRollup } from '../lib/incomeStatementOperatingExpenseRollup.js';

describe('resolveOperatingExpenseRollup salary accounts', () => {
  it('rolls salary child accounts and retired 5301 into 5200', () => {
    for (const accountCode of ['5201', '5202', '5203', '5230', '5301']) {
      expect(
        resolveOperatingExpenseRollup({
          key: `acct:${accountCode}`,
          accountCode,
          accountName: 'Salary payroll',
        })
      ).toMatchObject({ rollupCode: '5200', exclude: false });
    }
    expect(
      resolveOperatingExpenseRollup({
        key: 'acct:5200',
        accountCode: '5200',
        accountName: 'Salaries & Wages',
      })
    ).toMatchObject({ rollupCode: '5200', exclude: false });
  });

  it('rolls IT and hosting text to 5350', () => {
    expect(
      resolveOperatingExpenseRollup({
        key: 'cat:Software',
        accountCode: 'cat:Software',
        accountName: 'Cloud hosting subscription',
      })
    ).toMatchObject({ rollupCode: '5350', exclude: false });
  });
});
