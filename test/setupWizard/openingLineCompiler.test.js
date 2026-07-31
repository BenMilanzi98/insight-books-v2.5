import { describe, it, expect } from 'vitest';
import {
  extractLinesFromPayload,
  computeBalanceSheetEquation,
} from '../../lib/setupWizard/openingLineCompiler.js';
import { sumDebitCredit } from '../../lib/setupWizard/money.js';

describe('extractLinesFromPayload', () => {
  it('reads debit/credit lines', () => {
    const lines = extractLinesFromPayload(
      {
        lines: [
          { accountId: 'a1', debit: '100.00', description: 'Cash' },
          { accountId: 'a2', credit: '100.00', description: 'Capital' },
        ],
      },
      'paymentAccounts'
    );
    expect(lines).toHaveLength(2);
    expect(lines[0].debitMinor).toBe(10000n);
    expect(lines[1].creditMinor).toBe(10000n);
    expect(sumDebitCredit(lines).balanced).toBe(true);
  });

  it('supports amount + side', () => {
    const lines = extractLinesFromPayload(
      {
        lines: [{ accountId: 'ar', amount: '50', side: 'debit', customerId: 'c1' }],
      },
      'openingReceivables'
    );
    expect(lines[0].debit).toBe('50.00');
    expect(lines[0].dimensions.customerId).toBe('c1');
  });
});

describe('computeBalanceSheetEquation', () => {
  it('balances assets = liabilities + equity', () => {
    const lines = [
      {
        accountType: 'Asset',
        debitMinor: 10000n,
        creditMinor: 0n,
      },
      {
        accountType: 'Liability',
        debitMinor: 0n,
        creditMinor: 4000n,
      },
      {
        accountType: 'Equity',
        debitMinor: 0n,
        creditMinor: 6000n,
      },
    ];
    const eq = computeBalanceSheetEquation(lines);
    expect(eq.balanced).toBe(true);
    expect(eq.totalAssets).toBe('100.00');
    expect(eq.totalLiabilities).toBe('40.00');
    expect(eq.totalEquity).toBe('60.00');
  });
});
