import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateTransactionBalance } from '../lib/accountingValidation.js';
import { buildTwoLineEntry, buildPaymentDebitLines } from '../lib/accountingEngine/buildLinesFromLegacy.js';
import { comparePostedGlMapToTrialBalanceRows } from '../lib/glReconciliation.js';

describe('accounting engine integration helpers', () => {
  it('buildTwoLineEntry produces balanced lines', () => {
    const lines = buildTwoLineEntry('cash', 'rev', 100, 'Dr', 'Cr');
    const v = validateTransactionBalance(lines);
    expect(v.isValid).toBe(true);
    expect(lines[0].debitAmount).toBe(100);
    expect(lines[1].creditAmount).toBe(100);
  });

  it('buildPaymentDebitLines splits payment and credits revenue', () => {
    const lines = buildPaymentDebitLines(
      [{ accountId: 'cash1', amount: 60 }, { accountId: 'cash2', amount: 40 }],
      'rev',
      100,
      'S-1'
    );
    const v = validateTransactionBalance(lines);
    expect(v.isValid).toBe(true);
    expect(lines).toHaveLength(3);
  });

  it('comparePostedGlMapToTrialBalanceRows detects mismatch', () => {
    const rawMap = new Map([['a1', { debitAmount: 100, creditAmount: 0 }]]);
    const tbRows = [{ id: 'a1', debitTotal: 90, creditTotal: 0 }];
    const deltas = comparePostedGlMapToTrialBalanceRows(rawMap, tbRows);
    expect(deltas.some((d) => d.issue === 'total_mismatch')).toBe(true);
  });
});
