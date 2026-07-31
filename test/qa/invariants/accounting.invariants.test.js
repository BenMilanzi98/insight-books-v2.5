/**
 * ACC-INV-* executable catalogue (core set).
 * REG: CAP-005 / TB-003 / journal balance / BS equation / advisory no-GL.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  assertJournalBalances,
  assertSameBusiness,
  assertReversalOpposite,
  assertBalanceSheetEquation,
  assertNeverPostsToGl,
} from '../helpers/journalAssert.js';
import { expectMinorEqual, parseToMinor, sumMinors } from '../helpers/moneyAssert.js';
import {
  buildBalancedJournal,
  buildUnbalancedJournal,
  buildReversalOf,
} from '../factories/journalFactory.js';
import { resetIdSequence, businessId } from '../factories/ids.js';
import { createSeededRandom } from '../helpers/seededRandom.js';
import { projectThreeStatements } from '../../../lib/financialPlanning/domain/threeStatementEngine.js';
import { runLoanReadinessAssessment } from '../../../lib/loanReadiness/domain/assessmentEngine.js';

beforeEach(() => resetIdSequence(0));

describe('ACC-INV-002 Journal balances', () => {
  it('accepts balanced journals', () => {
    const j = buildBalancedJournal({ amount: '2500.50' });
    assertJournalBalances(j.lines, j.id);
  });

  it('rejects unbalanced journals', () => {
    const j = buildUnbalancedJournal({ amount: '100.00' });
    expect(() => assertJournalBalances(j.lines, j.id)).toThrow();
  });
});

describe('ACC-INV-006/007 Business scope on lines', () => {
  it('requires line business to match journal business when present', () => {
    const j = buildBalancedJournal({ business: businessId(1) });
    assertSameBusiness(j.lines, businessId(1));
    j.lines[0].businessId = businessId(2);
    expect(() => assertSameBusiness(j.lines, businessId(1))).toThrow();
  });
});

describe('ACC-INV-019 Reversal opposite', () => {
  it('reversal swaps debits and credits with equal totals', () => {
    const j = buildBalancedJournal({ amount: '999.99' });
    const rev = buildReversalOf(j);
    assertJournalBalances(rev.lines, rev.id);
    assertReversalOpposite(j.lines, rev.lines);
  });
});

describe('ACC-INV-022/023 Trial Balance and Balance Sheet', () => {
  it('TB debits equal credits for a set of balanced journals', () => {
    const journals = [
      buildBalancedJournal({ amount: '100.00' }),
      buildBalancedJournal({ amount: '50.25', debitAccount: '1100', creditAccount: '2000' }),
    ];
    const debits = [];
    const credits = [];
    for (const j of journals) {
      for (const l of j.lines) {
        debits.push(l.debit);
        credits.push(l.credit);
      }
    }
    expectMinorEqual(sumMinors(debits), sumMinors(credits), 'TB');
  });

  it('Balance Sheet equation holds for balanced opening', () => {
    assertBalanceSheetEquation({
      assets: '180000.00',
      liabilities: '65000.00',
      equity: '115000.00',
    });
  });
});

describe('ACC-INV-031/032/033 Capital and loan classification', () => {
  it('capital contribution is not revenue (account role assertion)', () => {
    // Contribution: Dr Cash / Cr Equity — credit account must be equity, not income
    const j = buildBalancedJournal({
      amount: '1000000.00',
      debitAccount: '1000',
      creditAccount: '3000', // equity capital
      sourceType: 'CAPITAL_CONTRIBUTION',
    });
    assertJournalBalances(j.lines);
    expect(j.lines[1].accountId).toBe('3000');
    expect(j.lines[1].accountId.startsWith('4')).toBe(false); // not revenue band
  });

  it('loan drawdown is liability not revenue', () => {
    const j = buildBalancedJournal({
      amount: '500000.00',
      debitAccount: '1000',
      creditAccount: '2500', // loan liability
      sourceType: 'LOAN_DRAWDOWN',
    });
    assertJournalBalances(j.lines);
    expect(j.lines[1].accountId.startsWith('4')).toBe(false);
  });
});

describe('ACC-INV-047 Forecast never posts journals', () => {
  it('three-statement projection never posts to GL', () => {
    const projection = projectThreeStatements({
      opening: {
        cash: '50000',
        receivables: '30000',
        inventory: '20000',
        payables: '15000',
        shortTermDebt: '10000',
        longTermDebt: '40000',
        equity: '20000',
        retainedEarnings: '15000',
      },
      baseRevenueMinor: parseToMinor('40000'),
      months: 3,
      assumptions: {},
    });
    expect(projection.neverPostsToGl !== false).toBe(true);
    expect(projection.periods?.length).toBe(3);
    // No journal lines produced
    expect(projection.journals).toBeUndefined();
  });
});

describe('ACC-INV-048 Proposed loan readiness never posts', () => {
  it('assessment payload marks neverPostsToGl / neverCreatesLiability', () => {
    const result = runLoanReadinessAssessment({
      loanRequest: {
        purpose: 'WORKING_CAPITAL',
        requestedAmount: '100000.00',
        requestedTermMonths: 12,
        expectedInterestRateBps: 1800,
      },
      openingBalances: {
        cash: '50000',
        receivables: '30000',
        inventory: '20000',
        payables: '15000',
        shortTermDebt: '10000',
        longTermDebt: '40000',
        equity: '20000',
        retainedEarnings: '15000',
      },
      bankReconciled: true,
      closedPeriodsAvailable: true,
      sourceActualsVersion: 'qa',
      baseEbitdaMinor: parseToMinor('15000'),
      baseRevenueMinor: parseToMinor('40000'),
    });
    assertNeverPostsToGl(result, 'loanReadiness');
  });
});

describe('Property: randomized balanced journals (seeded)', () => {
  it('ACC-INV-002 holds for seeded amounts', () => {
    const rnd = createSeededRandom(42);
    for (let i = 0; i < 25; i++) {
      const whole = rnd.int(1, 500000);
      const frac = rnd.int(0, 99);
      const amount = `${whole}.${String(frac).padStart(2, '0')}`;
      const j = buildBalancedJournal({ amount });
      try {
        assertJournalBalances(j.lines, `seed=${rnd.seed} i=${i}`);
      } catch (e) {
        e.message = `${e.message} (seed=${rnd.seed})`;
        throw e;
      }
    }
  });
});
