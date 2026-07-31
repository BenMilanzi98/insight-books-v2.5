import { describe, it, expect } from 'vitest';
import { buildProposedLoanSchedule } from '../lib/loanReadiness/domain/amortizationEngine.js';
import { computeDscr, computeInterestCoverage } from '../lib/loanReadiness/domain/dscrEngine.js';
import { calculateDebtCapacity } from '../lib/loanReadiness/domain/debtCapacityEngine.js';
import {
  calculateReadinessScore,
  assertNoProhibitedInputs,
  DEFAULT_SCORE_WEIGHTS,
} from '../lib/loanReadiness/domain/scoringEngine.js';
import { runLoanReadinessAssessment } from '../lib/loanReadiness/domain/assessmentEngine.js';
import { projectWithProposedFacility } from '../lib/loanReadiness/domain/proposedFacilityProjection.js';
import { assessDocumentReadiness } from '../lib/loanReadiness/domain/documentChecklist.js';
import {
  assertAssessmentApprovalSod,
  assertAssessmentReviewSod,
} from '../lib/loanReadiness/domain/separationOfDuties.js';
import {
  ProtectedAttributeInputError,
  SeparationOfDutiesError,
} from '../lib/loanReadiness/domain/errors.js';
import { parseToMinor } from '../lib/loanReadiness/domain/money.js';

describe('amortization', () => {
  it('reconciles equal instalment schedule to zero balance', () => {
    const schedule = buildProposedLoanSchedule({
      principalAmount: '100000.00',
      termMonths: 12,
      annualInterestRateBps: 1800,
      method: 'EQUAL_INSTALMENT',
    });
    expect(schedule.reconciles).toBe(true);
    expect(schedule.neverPostsToGl).toBe(true);
    expect(schedule.lines).toHaveLength(12);
    expect(schedule.disclaimer).toMatch(/does not create an actual loan/i);
  });

  it('discloses balloon and grace risks', () => {
    const schedule = buildProposedLoanSchedule({
      principalAmount: '100000.00',
      termMonths: 24,
      annualInterestRateBps: 1500,
      method: 'BALLOON',
      balloonAmount: '20000.00',
      gracePeriodMonths: 3,
    });
    expect(schedule.findings.some((f) => f.code === 'LRD-019')).toBe(true);
    expect(schedule.findings.some((f) => f.code === 'LRD-020')).toBe(true);
    expect(schedule.reconciles).toBe(true);
  });
});

describe('DSCR / ICR', () => {
  it('computes DSCR from CFADS and debt service', () => {
    const d = computeDscr({
      cfadsMinor: parseToMinor('25000.00'),
      debtServiceMinor: parseToMinor('10000.00'),
    });
    expect(d.meaningful).toBe(true);
    expect(d.ratio).toBeCloseTo(2.5, 2);
    expect(d.formulaVersion).toMatch(/DSCR/);
  });

  it('handles zero debt service as not meaningful', () => {
    const d = computeDscr({ cfadsMinor: 10000n, debtServiceMinor: 0n });
    expect(d.meaningful).toBe(false);
  });

  it('computes interest coverage', () => {
    const i = computeInterestCoverage({
      ebitdaMinor: parseToMinor('50000'),
      interestMinor: parseToMinor('10000'),
    });
    expect(i.ratio).toBeCloseTo(5, 2);
  });
});

describe('debt capacity', () => {
  it('uses CFADS and existing debt — not revenue alone', () => {
    const cfads = Array(12).fill(String(parseToMinor('20000.00')));
    const existing = Array(12).fill(String(parseToMinor('5000.00')));
    const result = calculateDebtCapacity({
      cfadsByPeriodMinor: cfads,
      existingDebtServiceByPeriodMinor: existing,
      targetDscr: 1.25,
      termMonths: 36,
      annualInterestRateBps: 1800,
      requestedAmount: '500000.00',
    });
    expect(result.formulaVersion).toMatch(/DEBT_CAPACITY/);
    expect(result.disclaimer).toMatch(/not a lender/i);
    expect(result.neverCreatesLiability).toBe(true);
    expect(BigInt(result.indicativeMaximumPrincipal.minor) > 0n).toBe(true);
  });

  it('flags revenue-only attempts', () => {
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

describe('scoring', () => {
  it('weights sum to 100 and produces transparent dimensions', () => {
    const sum = Object.values(DEFAULT_SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
    const score = calculateReadinessScore({
      metrics: Object.fromEntries(
        Object.keys(DEFAULT_SCORE_WEIGHTS).map((k) => [k, { score: 70, evidence: 't' }])
      ),
    });
    expect(score.totalReadinessScore).toBe(70);
    expect(score.notALenderDecision).toBe(true);
    expect(score.disclaimer).toMatch(/not a lender decision/i);
  });

  it('rejects protected personal attributes', () => {
    expect(() => assertNoProhibitedInputs({ applicant: { race: 'x' } })).toThrow(
      ProtectedAttributeInputError
    );
  });
});

describe('full assessment', () => {
  it('runs end-to-end without posting and with disclaimer', () => {
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
      existingDebt: [{ currentBalance: '40000', interestRate: 15 }],
      bankReconciled: true,
      closedPeriodsAvailable: true,
      sourceActualsVersion: 'test',
      baseEbitdaMinor: parseToMinor('15000'),
      baseRevenueMinor: parseToMinor('40000'),
    });
    expect(result.neverPostsToGl).toBe(true);
    expect(result.neverCreatesLiability).toBe(true);
    expect(result.score.totalReadinessScore).toBeGreaterThan(0);
    expect(result.proposedSchedule.reconciles).toBe(true);
    expect(result.disclaimer).toMatch(/not a lender/i);
    expect(result.proposedFacilityProjection?.integration?.loanProceedsClassifiedAsRevenue).toBe(
      false
    );
    expect(result.proposedFacilityProjection?.integration?.neverPostsToGl).toBe(true);
    expect(result.documentReadiness?.completionPercent).toBeDefined();
  });
});

describe('separation of duties', () => {
  it('blocks preparer from reviewing or sole-approving', () => {
    expect(() =>
      assertAssessmentReviewSod({ preparedBy: 'u1', reviewerUserId: 'u1' })
    ).toThrow(SeparationOfDutiesError);
    expect(() =>
      assertAssessmentApprovalSod({
        preparedBy: 'u1',
        reviewedBy: null,
        approverUserId: 'u2',
      })
    ).toThrow(SeparationOfDutiesError);
    expect(() =>
      assertAssessmentApprovalSod({
        preparedBy: 'u1',
        reviewedBy: 'u2',
        approverUserId: 'u1',
      })
    ).toThrow(SeparationOfDutiesError);
    expect(() =>
      assertAssessmentApprovalSod({
        preparedBy: 'u1',
        reviewedBy: 'u2',
        approverUserId: 'u3',
      })
    ).not.toThrow();
  });
});

describe('proposed facility three-statement', () => {
  it('treats proceeds as financing and keeps interest on P&L', () => {
    const { projection, integration, schedule } = projectWithProposedFacility({
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
      months: 12,
      loanRequest: {
        requestedAmount: '100000',
        requestedTermMonths: 12,
        expectedInterestRateBps: 1800,
      },
    });
    expect(integration.loanProceedsClassifiedAsRevenue).toBe(false);
    expect(integration.principalClassifiedAsExpense).toBe(false);
    expect(integration.interestInPnl).toBe(true);
    expect(schedule.reconciles).toBe(true);
    expect(projection.integrityStatus === 'VALID' || projection.integrityStatus === 'VALID_WITH_WARNINGS').toBe(
      true
    );
    const m0 = projection.periods[0];
    expect(BigInt(m0.pnl.interest.minor) > 0n).toBe(true);
    expect(BigInt(m0.balanceSheet.longTermDebt.minor) > 0n).toBe(true);
    expect(BigInt(integration.openingDebtAfterDraw.minor)).toBe(
      parseToMinor('40000') + parseToMinor('10000') + parseToMinor('100000')
    );
  });
});

describe('document checklist', () => {
  it('scores required documents and flags missing/expired', () => {
    const r = assessDocumentReadiness([
      { key: 'BUSINESS_REGISTRATION', status: 'VALID' },
      { key: 'TAX_REGISTRATION', status: 'VALID' },
      { key: 'TAX_CLEARANCE', status: 'EXPIRED', expiryDate: '2020-01-01' },
      { key: 'BANK_STATEMENTS_3M', status: 'VALID' },
      { key: 'MANAGEMENT_ACCOUNTS', status: 'VALID' },
      { key: 'CASH_FLOW_FORECAST', status: 'VALID' },
      { key: 'USE_OF_FUNDS', status: 'MISSING' },
    ]);
    expect(r.missing.length).toBeGreaterThan(0);
    expect(r.completionPercent).toBeLessThan(100);
    expect(r.note).toMatch(/does not change financial/i);
  });
});
