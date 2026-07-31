/**
 * Property-based style tests with seeded PRNG (reproducible on failure).
 */

import { describe, it, expect } from 'vitest';
import { createSeededRandom } from '../helpers/seededRandom.js';
import { parseToMinor, expectMinorEqual, sumMinors } from '../helpers/moneyAssert.js';
import { buildBalancedJournal, buildReversalOf } from '../factories/journalFactory.js';
import { assertJournalBalances, assertReversalOpposite } from '../helpers/journalAssert.js';

describe('Property: journal invariants (seeded)', () => {
  it('any valid generated balanced journal has debit === credit', () => {
    const seed = 20260722;
    const rng = createSeededRandom(seed);
    try {
      for (let i = 0; i < 40; i++) {
        const dollars = (rng.int(1, 5_000_000) / 100).toFixed(2);
        const j = buildBalancedJournal({
          amount: dollars,
          debitAccount: String(1000 + rng.int(0, 99)),
          creditAccount: String(4000 + rng.int(0, 99)),
        });
        assertJournalBalances(j.lines);
        const debits = sumMinors(j.lines.map((l) => l.debit));
        const credits = sumMinors(j.lines.map((l) => l.credit));
        expect(debits).toBe(credits);
        expect(debits).toBe(parseToMinor(dollars));
      }
    } catch (e) {
      e.message = `[seed=${seed}] ${e.message}`;
      throw e;
    }
  });

  it('reversal + original nets zero per account (equal and opposite)', () => {
    const seed = 991122;
    const rng = createSeededRandom(seed);
    try {
      for (let i = 0; i < 20; i++) {
        const amount = (rng.int(100, 999_999) / 100).toFixed(2);
        const original = buildBalancedJournal({ amount });
        const reversal = buildReversalOf(original);
        assertJournalBalances(reversal.lines);
        assertReversalOpposite(original.lines, reversal.lines);
      }
    } catch (e) {
      e.message = `[seed=${seed}] ${e.message}`;
      throw e;
    }
  });

  it('trial-balance style sum of many balanced journals remains balanced', () => {
    const seed = 424242;
    const rng = createSeededRandom(seed);
    try {
      let totalDebit = 0n;
      let totalCredit = 0n;
      for (let i = 0; i < 25; i++) {
        const amount = (rng.int(1, 100000) / 100).toFixed(2);
        const j = buildBalancedJournal({ amount });
        totalDebit += sumMinors(j.lines.map((l) => l.debit));
        totalCredit += sumMinors(j.lines.map((l) => l.credit));
      }
      expectMinorEqual(totalDebit, totalCredit, 'TB property');
    } catch (e) {
      e.message = `[seed=${seed}] ${e.message}`;
      throw e;
    }
  });
});
