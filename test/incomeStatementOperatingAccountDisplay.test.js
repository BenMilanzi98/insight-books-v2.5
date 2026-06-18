import { describe, expect, it } from 'vitest';
import {
  buildOperatingExpenseAccountLines,
  resolveOperatingExpenseStatementLine,
} from '../lib/incomeStatementOperatingAccountDisplay.js';

describe('incomeStatementOperatingAccountDisplay', () => {
  it('keeps drill-down details on the actual account, not a rollup target', () => {
    const amountsByAccountId = {
      'acc-5330': {
        accountId: 'acc-5330',
        accountCode: '5330',
        accountName: 'Marketing',
        amount: 350_000,
        details: [{ id: 'fb-1', description: 'Facebook Ads', amount: 350_000 }],
      },
      'acc-5301': {
        accountId: 'acc-5301',
        accountCode: '5301',
        accountName: 'Salaries & Wages',
        amount: 500_000,
        details: [{ id: 'sal-1', description: 'January payroll', amount: 500_000 }],
      },
      'acc-5200': {
        accountId: 'acc-5200',
        accountCode: '5200',
        accountName: 'Salaries & Wages',
        amount: 1_000_000,
        details: [{ id: 'payroll-gl', description: 'Payroll expense', amount: 1_000_000 }],
      },
    };

    const lines = buildOperatingExpenseAccountLines(amountsByAccountId);
    const salary5200 = lines.find((line) => line.accountCode === '5200');
    const marketing5330 = lines.find((line) => line.accountCode === '5330');

    expect(marketing5330?.details).toHaveLength(1);
    expect(marketing5330?.details[0].description).toBe('Facebook Ads');
    expect(salary5200?.details).toHaveLength(2);
    expect(salary5200?.amount).toBe(1_500_000);
    expect(salary5200?.details.some((d) => d.description === 'January payroll')).toBe(true);
    expect(salary5200?.details.some((d) => d.description === 'Payroll expense')).toBe(true);
    expect(salary5200?.details.some((d) => d.description === 'Facebook Ads')).toBe(false);
    expect(lines.find((line) => line.accountCode === '5301')).toBeUndefined();
  });

  it('omits operating expense rows with MWK 0.00 after merge', () => {
    const lines = buildOperatingExpenseAccountLines({
      'acc-a': {
        accountId: 'acc-a',
        accountCode: '5330',
        accountName: 'Marketing',
        amount: 100_000,
        details: [{ id: '1', amount: 100_000 }],
      },
      'acc-b': {
        accountId: 'acc-b',
        accountCode: '5201',
        accountName: 'Admin Salaries',
        amount: 0,
        details: [],
      },
      'acc-c': {
        accountId: 'acc-c',
        accountCode: '5019',
        accountName: 'Software',
        amount: 0.004,
        details: [],
      },
    });

    expect(lines).toHaveLength(1);
    expect(lines[0].accountCode).toBe('5330');
  });

  it('maps legacy Salary category to 5200 without pulling other accounts', () => {
    const line = resolveOperatingExpenseStatementLine(
      {
        accountCode: 'cat:Salary',
        accountName: 'Salary',
        amount: 100_000,
        details: [{ description: 'Net pay mirror' }],
      },
      'cat:Salary'
    );
    expect(line).toMatchObject({
      accountCode: '5200',
      accountName: 'Salaries & Wages',
    });
  });
});
