import { describe, it, expect } from 'vitest';
import { comparePostedGlMapToTrialBalanceRows } from '../lib/glReconciliation.js';

describe('comparePostedGlMapToTrialBalanceRows', () => {
  it('returns no deltas when raw map matches TB rows', () => {
    const raw = new Map([
      ['a1', { debitAmount: 100, creditAmount: 40 }],
      ['a2', { debitAmount: 0, creditAmount: 200 }],
    ]);
    const tb = [
      { id: 'a1', debitTotal: 100, creditTotal: 40 },
      { id: 'a2', debitTotal: 0, creditTotal: 200 },
    ];
    expect(comparePostedGlMapToTrialBalanceRows(raw, tb)).toEqual([]);
  });

  it('flags total mismatch', () => {
    const raw = new Map([['a1', { debitAmount: 100, creditAmount: 0 }]]);
    const tb = [{ id: 'a1', debitTotal: 99, creditTotal: 0 }];
    const d = comparePostedGlMapToTrialBalanceRows(raw, tb);
    expect(d.length).toBe(1);
    expect(d[0].issue).toBe('total_mismatch');
  });

  it('flags missing TB row', () => {
    const raw = new Map([['orphan', { debitAmount: 5, creditAmount: 0 }]]);
    const tb = [];
    const d = comparePostedGlMapToTrialBalanceRows(raw, tb);
    expect(d.some((x) => x.issue === 'missing_tb_row')).toBe(true);
  });
});
