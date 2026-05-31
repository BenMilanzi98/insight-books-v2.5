import { describe, expect, it } from 'vitest';
import { resolveOperatingExpenseRollup } from '../lib/incomeStatementOperatingExpenseRollup.js';

describe('resolveOperatingExpenseRollup salary accounts', () => {
  it('rolls canonical and legacy salary accounts into 5200 only', () => {
    for (const accountCode of ['5200', '5201', '5202', '5203', '5230', '5301']) {
      expect(
        resolveOperatingExpenseRollup({
          key: `acct:${accountCode}`,
          accountCode,
          accountName: accountCode === '5301' ? 'Salaries & Wages' : 'Salary payroll',
        })
      ).toMatchObject({ rollupCode: '5200', exclude: false });
    }
  });
});
