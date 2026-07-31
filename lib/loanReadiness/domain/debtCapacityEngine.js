/**
 * Debt Capacity Engine — CFADS-based, never revenue-only.
 * Max affordable debt service = CFADS / target DSCR
 * Capacity for new debt = max service − existing service − min cash retention allocation
 */

import { createHash } from 'crypto';
import { DEBT_CAPACITY_FORMULA_VERSION, AffordabilityStatus, ADVISORY_DISCLAIMER } from './enums.js';
import { buildProposedLoanSchedule } from './amortizationEngine.js';
import { parseToMinor, amt, pctOf } from './money.js';

/**
 * Approximate principal supportable by a constant periodic payment (annuity).
 * P = PMT * (1 - (1+r)^-n) / r
 */
function principalFromPayment(paymentMinor, periodRateBps, n) {
  if (paymentMinor <= 0n || n <= 0) return 0n;
  if (periodRateBps <= 0) return paymentMinor * BigInt(n);
  const SCALE = 1000000n;
  const rNum = BigInt(periodRateBps);
  let compound = SCALE;
  for (let i = 0; i < n; i++) {
    compound = (compound * (10000n + rNum)) / 10000n;
  }
  // P = PMT * (compound - SCALE) * 10000 / (r * compound)
  const numer = paymentMinor * (compound - SCALE) * 10000n;
  const denom = rNum * compound;
  if (denom === 0n) return 0n;
  return numer / denom;
}

export function calculateDebtCapacity(input = {}) {
  const findings = [];
  const targetDscr = Number(input.targetDscr ?? 1.25);
  if (!(targetDscr > 0)) {
    findings.push({ code: 'LRD-007', severity: 'CRITICAL', message: 'Target DSCR missing or invalid.' });
  }

  // Reject revenue-only capacity
  if (input.useRevenueOnly === true) {
    findings.push({
      code: 'LRD-017',
      severity: 'CRITICAL',
      message: 'Debt capacity based on Revenue alone is not permitted.',
    });
  }

  const periods = input.cfadsByPeriodMinor || [];
  const existingService = input.existingDebtServiceByPeriodMinor || [];
  const minCashRetentionPerPeriod = parseToMinor(input.minCashRetentionPerPeriod ?? 0);

  if (!periods.length) {
    return {
      formulaVersion: DEBT_CAPACITY_FORMULA_VERSION,
      integrityStatus: 'INVALID',
      findings: [
        ...findings,
        { code: 'LRD-001', severity: 'CRITICAL', message: 'CFADS periods missing — insufficient data.' },
      ],
      disclaimer: ADVISORY_DISCLAIMER,
      affordabilityStatus: AffordabilityStatus.INSUFFICIENT_DATA,
    };
  }

  const periodCapacity = [];
  let minAvailableForProposed = null;

  for (let i = 0; i < periods.length; i++) {
    const cfads = BigInt(periods[i] || 0);
    const existing = BigInt(existingService[i] || 0);
    const maxTotalService =
      targetDscr > 0 ? (cfads * 10000n) / BigInt(Math.round(targetDscr * 10000)) : 0n;
    let availableForProposed = maxTotalService - existing - minCashRetentionPerPeriod;
    if (availableForProposed < 0n) availableForProposed = 0n;

    if (minAvailableForProposed == null || availableForProposed < minAvailableForProposed) {
      minAvailableForProposed = availableForProposed;
    }

    periodCapacity.push({
      index: i,
      label: input.labels?.[i] || `P${i + 1}`,
      cfads: amt(cfads),
      existingDebtService: amt(existing),
      maxTotalDebtService: amt(maxTotalService),
      minCashRetention: amt(minCashRetentionPerPeriod),
      availableForProposedDebtService: amt(availableForProposed),
    });
  }

  const bindingPayment = minAvailableForProposed ?? 0n;
  const termMonths = Number(input.termMonths || 36);
  const annualRateBps = Number(input.annualInterestRateBps || 0);
  const periodsPerYear = 12;
  const n = Math.max(1, termMonths);
  const periodRateBps = Math.round(annualRateBps / periodsPerYear);

  const indicativePrincipal = principalFromPayment(bindingPayment, periodRateBps, n);

  let schedule = null;
  if (indicativePrincipal > 0n) {
    schedule = buildProposedLoanSchedule({
      principalAmount: indicativePrincipal,
      termMonths,
      annualInterestRateBps: annualRateBps,
      method: input.method || 'EQUAL_INSTALMENT',
      gracePeriodMonths: input.gracePeriodMonths || 0,
      balloonAmount: input.balloonAmount || 0,
      upfrontFeeAmount: input.upfrontFeeAmount || 0,
      rateType: input.rateType || 'FIXED',
    });
  }

  // Affordability vs requested amount
  const requested = parseToMinor(input.requestedAmount ?? 0);
  let affordabilityStatus = AffordabilityStatus.INSUFFICIENT_DATA;
  if (requested > 0n && indicativePrincipal > 0n) {
    const pct = Number((indicativePrincipal * 10000n) / requested) / 100;
    if (pct >= 120) affordabilityStatus = AffordabilityStatus.COMFORTABLE;
    else if (pct >= 100) affordabilityStatus = AffordabilityStatus.MANAGEABLE_WITH_CUSHION;
    else if (pct >= 80) affordabilityStatus = AffordabilityStatus.TIGHT;
    else if (pct >= 50) affordabilityStatus = AffordabilityStatus.HIGH_RISK;
    else affordabilityStatus = AffordabilityStatus.UNAFFORDABLE_UNDER_ASSUMPTIONS;
  } else if (indicativePrincipal === 0n) {
    affordabilityStatus = AffordabilityStatus.UNAFFORDABLE_UNDER_ASSUMPTIONS;
  }

  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  const result = {
    formulaVersion: DEBT_CAPACITY_FORMULA_VERSION,
    formula:
      'Max Affordable Debt Service = CFADS ÷ Target DSCR; Available for Proposed = Max − Existing − Min Cash Retention; Indicative Principal from annuity inversion',
    targetDscr,
    periodCapacity,
    bindingMaximumPeriodicDebtService: amt(bindingPayment),
    indicativeMaximumPrincipal: amt(indicativePrincipal),
    requestedAmount: amt(requested),
    terms: {
      termMonths,
      annualInterestRateBps: annualRateBps,
      periodsPerYear,
    },
    scheduleSummary: schedule
      ? {
          checksum: schedule.checksum,
          totalInterest: schedule.totals.totalInterest,
          totalDebtService: schedule.totals.totalDebtService,
          reconciles: schedule.reconciles,
        }
      : null,
    affordabilityStatus,
    findings,
    integrityStatus: critical.length ? 'INVALID' : 'VALID',
    disclaimer: ADVISORY_DISCLAIMER,
    label:
      'Indicative internal debt-capacity estimate — not a lender approval or offer.',
    neverPostsToGl: true,
    neverCreatesLiability: true,
  };

  result.checksum = createHash('sha256')
    .update(
      JSON.stringify({
        targetDscr,
        binding: result.bindingMaximumPeriodicDebtService.minor,
        principal: result.indicativeMaximumPrincipal.minor,
        formulaVersion: DEBT_CAPACITY_FORMULA_VERSION,
      })
    )
    .digest('hex');

  return result;
}

/**
 * Simple stress: scale CFADS and optionally add rate shock on proposed schedule.
 */
export function runStressCapacity(baseInput, stress = {}) {
  const revenueFactorBps = Number(stress.cfadsFactorBps ?? 10000); // 9000 = -10%
  const scaled = (baseInput.cfadsByPeriodMinor || []).map((v) =>
    String(pctOf(BigInt(v), revenueFactorBps))
  );
  return calculateDebtCapacity({
    ...baseInput,
    cfadsByPeriodMinor: scaled,
    annualInterestRateBps:
      Number(baseInput.annualInterestRateBps || 0) + Number(stress.rateShockBps || 0),
    labels: baseInput.labels,
  });
}
