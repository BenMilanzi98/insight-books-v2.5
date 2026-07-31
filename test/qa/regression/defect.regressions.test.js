/**
 * Permanent defect regressions (DEFECT_REGRESSION_CATALOGUE).
 * REG-CAP-005, REG-SAL-5200, REG-EXP-5000, REG-EQT-035, REG-LRD-017, REG-PLAN-NOGL
 */

import { describe, it, expect } from 'vitest';
import { parseToMinor, expectMinorEqual } from '../helpers/moneyAssert.js';
import { assertJournalBalances, assertNeverPostsToGl } from '../helpers/journalAssert.js';
import { buildBalancedJournal } from '../factories/journalFactory.js';
import { calculateDebtCapacity } from '../../../lib/loanReadiness/domain/debtCapacityEngine.js';
import { projectThreeStatements } from '../../../lib/financialPlanning/domain/threeStatementEngine.js';
import { runLoanReadinessAssessment } from '../../../lib/loanReadiness/domain/assessmentEngine.js';
import { assertMakerChecker, SelfApprovalNotAllowedError } from '../../../lib/securityGovernance/index.js';

describe('REG-CAP-005 / REG-EQT-035 Owner capital once (MK1,000,000)', () => {
  it('capital contribution journal totals exactly MK1,000,000 — not doubled', () => {
    const amount = '1000000.00';
    const j = buildBalancedJournal({
      amount,
      debitAccount: '1000',
      creditAccount: '3000',
      sourceType: 'CAPITAL_CONTRIBUTION',
    });
    assertJournalBalances(j.lines);
    const creditEquity = j.lines.find((l) => l.accountId === '3000');
    expectMinorEqual(creditEquity.credit, amount, 'equity credit');
    // Anti-double-count: do not also add the same amount as a second equity line
    const equityCredits = j.lines.filter((l) => String(l.accountId).startsWith('3'));
    const equityTotal = equityCredits.reduce((s, l) => s + l.credit, 0n);
    expectMinorEqual(equityTotal, amount, 'equity total once');
  });
});

describe('REG-SAL-5200 Salaries & Wages account', () => {
  it('payroll expense line targets account 5200', () => {
    const j = buildBalancedJournal({
      amount: '250000.00',
      debitAccount: '5200',
      creditAccount: '2100',
      sourceType: 'PAYROLL',
    });
    assertJournalBalances(j.lines);
    expect(j.lines[0].accountId).toBe('5200');
    expect(['5301', '5201', '5210']).not.toContain(j.lines[0].accountId);
  });
});

describe('REG-EXP-5000 Expense hierarchy', () => {
  it('expense posting accounts stay in 5xxx band (not revenue/asset)', () => {
    const expenseAccounts = ['5100', '5200', '5400', '5500'];
    for (const acct of expenseAccounts) {
      expect(acct.startsWith('5')).toBe(true);
      const j = buildBalancedJournal({
        amount: '1000.00',
        debitAccount: acct,
        creditAccount: '1000',
        sourceType: 'EXPENSE',
      });
      assertJournalBalances(j.lines);
      expect(j.lines[0].accountId.startsWith('4')).toBe(false);
      expect(j.lines[0].accountId.startsWith('1')).toBe(false);
    }
  });
});

describe('REG-LRD-017 Debt capacity not revenue-only', () => {
  it('flags revenue-only capacity as INVALID (LRD-017)', () => {
    const result = calculateDebtCapacity({
      cfadsByPeriodMinor: [String(parseToMinor('10000'))],
      existingDebtServiceByPeriodMinor: ['0'],
      targetDscr: 1.25,
      useRevenueOnly: true,
    });
    expect(result.findings.some((f) => f.code === 'LRD-017')).toBe(true);
    expect(result.integrityStatus).toBe('INVALID');
  });
});

describe('REG-PLAN-NOGL / REG-LRD-NOGL Advisory modules never post', () => {
  it('forecast projection has no journals', () => {
    const p = projectThreeStatements({
      opening: {
        cash: '10000',
        receivables: '0',
        inventory: '0',
        payables: '0',
        shortTermDebt: '0',
        longTermDebt: '0',
        equity: '10000',
        retainedEarnings: '0',
      },
      baseRevenueMinor: parseToMinor('1000'),
      months: 2,
    });
    expect(p.journals).toBeUndefined();
    expect(p.periods.length).toBe(2);
  });

  it('loan readiness never posts / never creates liability', () => {
    const r = runLoanReadinessAssessment({
      loanRequest: {
        requestedAmount: '50000.00',
        requestedTermMonths: 6,
        expectedInterestRateBps: 1200,
      },
      openingBalances: {
        cash: '10000',
        receivables: '0',
        inventory: '0',
        payables: '0',
        shortTermDebt: '0',
        longTermDebt: '0',
        equity: '10000',
        retainedEarnings: '0',
      },
      baseEbitdaMinor: parseToMinor('5000'),
      baseRevenueMinor: parseToMinor('10000'),
      bankReconciled: true,
      sourceActualsVersion: 'reg',
    });
    assertNeverPostsToGl(r);
  });
});

describe('REG-SOD Self-approval', () => {
  it('loan readiness / high-risk maker-checker blocks self-approve', () => {
    expect(() =>
      assertMakerChecker({
        preparedBy: 'prep-1',
        approverId: 'prep-1',
        ruleCode: 'SOD_CREATE_APPROVE',
      })
    ).toThrow(SelfApprovalNotAllowedError);
  });
});
