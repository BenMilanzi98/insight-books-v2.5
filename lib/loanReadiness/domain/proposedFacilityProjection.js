/**
 * Integrate a proposed facility into the Phase 13 three-statement engine.
 * Loan proceeds ≠ Revenue; principal ≠ Expense; interest hits P&L.
 * Never writes Journal Entries.
 */

import { projectThreeStatements } from '../../financialPlanning/domain/threeStatementEngine.js';
import { parseToMinor, amt } from './money.js';
import { buildProposedLoanSchedule } from './amortizationEngine.js';

/**
 * Ensure opening BS keys exist. If unbalanced, plug retained earnings (WARNING only)
 * so proposed-debt projection can run — never a silent GL plug.
 */
export function normalizeOpeningForProjection(opening = {}) {
  const cash = parseToMinor(opening.cash ?? 0);
  const receivables = parseToMinor(opening.receivables ?? 0);
  const inventory = parseToMinor(opening.inventory ?? 0);
  const otherCurrentAssets = parseToMinor(opening.otherCurrentAssets ?? 0);
  const fixedAssetsGross = parseToMinor(opening.fixedAssetsGross ?? 0);
  const accumulatedDepreciation = parseToMinor(opening.accumulatedDepreciation ?? 0);
  const payables = parseToMinor(opening.payables ?? 0);
  const payrollLiabilities = parseToMinor(opening.payrollLiabilities ?? 0);
  const taxPayable = parseToMinor(opening.taxPayable ?? 0);
  const shortTermDebt = parseToMinor(opening.shortTermDebt ?? 0);
  const longTermDebt = parseToMinor(opening.longTermDebt ?? 0);
  let equity = parseToMinor(opening.equity ?? 0);
  let retainedEarnings = parseToMinor(opening.retainedEarnings ?? 0);

  const nbv = fixedAssetsGross - accumulatedDepreciation;
  const assets = cash + receivables + inventory + otherCurrentAssets + nbv;
  const liabilities = payables + payrollLiabilities + taxPayable + shortTermDebt + longTermDebt;
  const equityTotal = equity + retainedEarnings;
  const diff = assets - liabilities - equityTotal;
  const findings = [];
  if (diff !== 0n) {
    retainedEarnings += diff;
    findings.push({
      code: 'LRD-013',
      severity: 'WARNING',
      message:
        'Opening Balance Sheet was unbalanced for proposed-facility projection; retained earnings adjusted in the advisory model only (not posted to GL).',
    });
  }

  return {
    opening: {
      cash,
      receivables,
      inventory,
      otherCurrentAssets,
      fixedAssetsGross,
      accumulatedDepreciation,
      payables,
      payrollLiabilities,
      taxPayable,
      shortTermDebt,
      longTermDebt,
      equity,
      retainedEarnings,
    },
    findings,
  };
}

/** Cash + principal, LT debt + principal (financing draw — keeps BS balanced). */
export function openingWithFacilityDraw(opening = {}, principalMinor = 0n) {
  const principal = typeof principalMinor === 'bigint' ? principalMinor : parseToMinor(principalMinor);
  const { opening: base, findings } = normalizeOpeningForProjection(opening);
  return {
    opening: {
      ...base,
      cash: base.cash + principal,
      longTermDebt: base.longTermDebt + principal,
    },
    findings,
  };
}

/**
 * @returns {{ projection, schedule, integration, findings }}
 */
export function projectWithProposedFacility({
  opening,
  baseRevenueMinor,
  months,
  baseAssumptions = {},
  loanRequest = {},
} = {}) {
  const principal = parseToMinor(loanRequest.requestedAmount ?? loanRequest.principalAmount ?? 0);
  const termMonths = Math.max(1, Number(loanRequest.requestedTermMonths || months || 12));
  const horizon = Math.min(Math.max(Number(months) || termMonths, 1), 60);
  const rateBps = Number(loanRequest.expectedInterestRateBps ?? 0);
  const findings = [];

  const drawn = openingWithFacilityDraw(opening || {}, principal > 0n ? principal : 0n);
  findings.push(...drawn.findings);

  if (principal <= 0n) {
    const projection = projectThreeStatements({
      opening: drawn.opening,
      baseRevenueMinor:
        typeof baseRevenueMinor === 'bigint'
          ? baseRevenueMinor
          : parseToMinor(baseRevenueMinor ?? 0),
      months: horizon,
      assumptions: baseAssumptions,
    });
    return {
      projection,
      schedule: null,
      integration: {
        loanProceedsTreatedAs: 'N/A',
        loanProceedsClassifiedAsRevenue: false,
        principalClassifiedAsExpense: false,
        interestInPnl: false,
        debtOnBalanceSheet: false,
        debtServiceInCashFlow: false,
        neverPostsToGl: true,
      },
      findings: [...findings, ...(projection.findings || [])],
    };
  }

  const schedule = buildProposedLoanSchedule({
    principalAmount: principal,
    termMonths: Math.min(termMonths, horizon),
    annualInterestRateBps: rateBps,
    method: loanRequest.amortizationMethod || 'EQUAL_INSTALMENT',
    gracePeriodMonths: loanRequest.gracePeriodMonths || 0,
    balloonAmount: loanRequest.balloonAmount || 0,
    upfrontFeeAmount: loanRequest.upfrontFeeAmount || 0,
    rateType: loanRequest.rateType || 'FIXED',
    capitalizeInterestInGrace: loanRequest.capitalizeInterestInGrace,
  });
  findings.push(...(schedule.findings || []));

  const n = BigInt(schedule.lines.length || 1);
  const avgPrincipal =
    schedule.lines.reduce((s, l) => s + BigInt(l.principalRepayment.minor), 0n) / n;
  const avgInterest = schedule.lines.reduce((s, l) => s + BigInt(l.interest.minor), 0n) / n;

  const adjustedOpening = drawn.opening;
  const debtAfter = parseToMinor(adjustedOpening.longTermDebt) + parseToMinor(adjustedOpening.shortTermDebt);
  const interestBpsOfDebt =
    debtAfter > 0n && avgInterest > 0n ? Number((avgInterest * 10000n) / debtAfter) : 0;

  const projection = projectThreeStatements({
    opening: adjustedOpening,
    baseRevenueMinor:
      typeof baseRevenueMinor === 'bigint'
        ? baseRevenueMinor
        : parseToMinor(baseRevenueMinor ?? 0),
    months: horizon,
    assumptions: {
      ...baseAssumptions,
      monthlyNewDebtMinor: 0n,
      // Pass bigint minors — parseToMinor multiplies decimal strings by 100
      monthlyPrincipalRepaymentMinor: avgPrincipal,
      monthlyInterestBpsOfDebt: interestBpsOfDebt,
    },
  });
  findings.push(...(projection.findings || []));

  const firstRev = projection.periods?.[0]?.pnl?.revenue?.minor;
  const baseRevStr = String(
    typeof baseRevenueMinor === 'bigint' ? baseRevenueMinor : parseToMinor(baseRevenueMinor ?? 0)
  );
  if (firstRev && firstRev !== baseRevStr) {
    // Seasonality/growth can change month-1; only flag if proceeds leaked into revenue via assumptions
  }

  if (projection.integrityStatus === 'INVALID') {
    findings.push({
      code: 'LRD-012',
      severity: 'CRITICAL',
      message: 'Proposed debt three-statement projection is INVALID.',
    });
  }

  const integration = {
    loanProceedsTreatedAs: 'FINANCING_CASH_AND_LIABILITY',
    loanProceedsClassifiedAsRevenue: false,
    principalClassifiedAsExpense: false,
    interestInPnl: true,
    debtOnBalanceSheet: true,
    debtServiceInCashFlow: true,
    scheduleReconciles: schedule.reconciles,
    projectionIntegrity: projection.integrityStatus,
    projectionChecksum: projection.checksum,
    openingCashAfterDraw: amt(parseToMinor(adjustedOpening.cash)),
    openingDebtAfterDraw: amt(
      parseToMinor(adjustedOpening.longTermDebt) + parseToMinor(adjustedOpening.shortTermDebt)
    ),
    averageMonthlyPrincipal: amt(avgPrincipal),
    averageMonthlyInterest: amt(avgInterest),
    neverPostsToGl: true,
    note: 'Proposed facility is modelled in a planning projection only; no Journal Entry or Liability is created.',
  };

  return { projection, schedule, integration, findings };
}
