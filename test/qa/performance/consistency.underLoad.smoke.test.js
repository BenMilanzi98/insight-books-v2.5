/**
 * Accounting consistency smoke after synthetic concurrent balanced journals.
 * Does not replace full load certification — validates invariant helpers under parallel builders.
 */

import { describe, it, expect } from 'vitest';
import { buildBalancedJournal, buildReversalOf } from '../factories/journalFactory.js';
import {
  assertJournalBalances,
  assertReversalOpposite,
  assertBalanceSheetEquation,
} from '../helpers/journalAssert.js';
import { sumMinors, expectMinorEqual } from '../helpers/moneyAssert.js';

describe('Data consistency under concurrent synthetic journals', () => {
  it('parallel builders produce only balanced journals and TB property holds', async () => {
    const jobs = Array.from({ length: 40 }, (_, i) =>
      Promise.resolve(
        buildBalancedJournal({
          amount: ((i + 1) * 100.25).toFixed(2),
          business: `biz_LOAD_${i % 3}`,
        })
      )
    );
    const journals = await Promise.all(jobs);
    let debit = 0n;
    let credit = 0n;
    for (const j of journals) {
      assertJournalBalances(j.lines);
      debit += sumMinors(j.lines.map((l) => l.debit));
      credit += sumMinors(j.lines.map((l) => l.credit));
    }
    expectMinorEqual(debit, credit, 'aggregate TB');
  });

  it('reversals under load remain equal-and-opposite', async () => {
    const originals = await Promise.all(
      Array.from({ length: 20 }, () => Promise.resolve(buildBalancedJournal({ amount: '1234.56' })))
    );
    await Promise.all(
      originals.map(async (o) => {
        const r = buildReversalOf(o);
        assertJournalBalances(r.lines);
        assertReversalOpposite(o.lines, r.lines);
      })
    );
  });

  it('balance sheet equation helper rejects imbalance', () => {
    expect(() =>
      assertBalanceSheetEquation({ assets: '100', liabilities: '40', equity: '50' })
    ).toThrow();
    assertBalanceSheetEquation({ assets: '100.00', liabilities: '40.00', equity: '60.00' });
  });
});
