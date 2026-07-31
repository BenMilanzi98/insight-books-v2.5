/**
 * GOLDEN DATASET A — Basic service business (structural golden).
 * Expected: balanced capital + sale + expense journals; BS equation; TB balances.
 */

import { describe, it, beforeEach } from 'vitest';
import { resetIdSequence } from '../factories/ids.js';
import { buildBalancedJournal } from '../factories/journalFactory.js';
import {
  assertJournalBalances,
  assertBalanceSheetEquation,
} from '../helpers/journalAssert.js';
import { expectMinorEqual, parseToMinor, sumMinors } from '../helpers/moneyAssert.js';
import golden from './datasetA.expected.json';

beforeEach(() => resetIdSequence(100));

describe('Golden Dataset A — basic service', () => {
  it('capital, sale, and expense journals balance and match expected minors', () => {
    const capital = buildBalancedJournal({
      amount: golden.capital.amount,
      debitAccount: golden.capital.debitAccount,
      creditAccount: golden.capital.creditAccount,
      sourceType: 'CAPITAL_CONTRIBUTION',
    });
    const sale = buildBalancedJournal({
      amount: golden.cashSale.amount,
      debitAccount: golden.cashSale.debitAccount,
      creditAccount: golden.cashSale.creditAccount,
      sourceType: 'CASH_SALE',
    });
    const expense = buildBalancedJournal({
      amount: golden.expense.amount,
      debitAccount: golden.expense.debitAccount,
      creditAccount: golden.expense.creditAccount,
      sourceType: 'EXPENSE',
    });

    for (const j of [capital, sale, expense]) assertJournalBalances(j.lines, j.sourceType);

    expectMinorEqual(capital.lines[1].credit, golden.capital.amount);
    expectMinorEqual(sale.lines[1].credit, golden.cashSale.amount);
    expectMinorEqual(expense.lines[0].debit, golden.expense.amount);

    const debits = [];
    const credits = [];
    for (const j of [capital, sale, expense]) {
      for (const l of j.lines) {
        debits.push(l.debit);
        credits.push(l.credit);
      }
    }
    expectMinorEqual(sumMinors(debits), sumMinors(credits), 'golden TB');

    assertBalanceSheetEquation(golden.expectedBalanceSheet, 'golden BS');
  });

  it('expected balance sheet uses exact decimals from fixture', () => {
    const a = parseToMinor(golden.expectedBalanceSheet.assets);
    const l = parseToMinor(golden.expectedBalanceSheet.liabilities);
    const e = parseToMinor(golden.expectedBalanceSheet.equity);
    expectMinorEqual(a, l + e);
  });
});
