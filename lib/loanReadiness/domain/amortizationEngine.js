/**
 * Proposed loan amortization — exact minor units.
 * Never creates Journal Entries or Liability records.
 */

import { createHash } from 'crypto';
import { AmortizationMethod, RateType } from './enums.js';
import { InvalidLoanTermsError } from './errors.js';
import { parseToMinor, minorToDecimalString, amt, pctOf } from './money.js';

function periodRateBps(annualRateBps, periodsPerYear) {
  return Math.round(Number(annualRateBps) / Number(periodsPerYear));
}

function equalInstalmentPayment(principalMinor, periodRateBpsVal, n) {
  if (n <= 0) return 0n;
  if (periodRateBpsVal <= 0) return principalMinor / BigInt(n);
  const SCALE = 1000000n;
  const rNum = BigInt(periodRateBpsVal);
  let compound = SCALE;
  for (let i = 0; i < n; i++) {
    compound = (compound * (10000n + rNum)) / 10000n;
  }
  const numer = principalMinor * rNum * compound;
  const denom = (compound - SCALE) * 10000n;
  if (denom === 0n) return principalMinor / BigInt(n);
  return numer / denom;
}

export function buildProposedLoanSchedule(input = {}) {
  const principal = parseToMinor(input.principalAmount ?? input.principalMinor ?? 0);
  const termMonths = Math.max(1, Number(input.termMonths) || 12);
  const frequency = (input.repaymentFrequency || 'MONTHLY').toUpperCase();
  const periodsPerYear = frequency === 'QUARTERLY' ? 4 : frequency === 'ANNUAL' ? 1 : 12;
  const nTotal = Math.max(1, Math.round((termMonths * periodsPerYear) / 12));
  const method = input.method || AmortizationMethod.EQUAL_INSTALMENT;
  const annualRateBps = Number(input.annualInterestRateBps ?? 0);
  const rateType = input.rateType || RateType.FIXED;
  const graceMonths = Math.max(0, Number(input.gracePeriodMonths || 0));
  const graceN = Math.min(nTotal - 1, Math.round((graceMonths * periodsPerYear) / 12));
  const balloonMinor = parseToMinor(input.balloonAmount ?? 0);
  const feeMinor = parseToMinor(input.upfrontFeeAmount ?? 0);
  const capitalizeInterestInGrace = Boolean(input.capitalizeInterestInGrace);
  const rateShockBps = Number(input.rateShockBps || 0);

  if (principal <= 0n) throw new InvalidLoanTermsError('Principal must be positive.');
  if (balloonMinor >= principal) {
    throw new InvalidLoanTermsError('Balloon cannot equal or exceed principal.');
  }

  const findings = [];
  if (rateType === RateType.VARIABLE) {
    findings.push({
      code: 'LRD-021',
      severity: 'WARNING',
      message: 'Variable-rate risk disclosed; rate shocks should be stress-tested.',
    });
  }
  if (balloonMinor > 0n || method === AmortizationMethod.BALLOON) {
    findings.push({
      code: 'LRD-019',
      severity: 'WARNING',
      message: 'Balloon payment disclosed — affordability must not be judged on instalments alone.',
    });
  }
  if (graceN > 0) {
    findings.push({
      code: 'LRD-020',
      severity: 'INFO',
      message: 'Grace period: interest during grace is accrued (not forgiven).',
    });
  }

  let balance = principal;
  const lines = [];
  let totalInterest = 0n;
  let totalPrincipal = 0n;
  let totalCashService = feeMinor;

  const amortPeriods = Math.max(1, nTotal - graceN);
  // Principal to amortize before final balloon residual
  const amortizablePrincipal = principal - balloonMinor;

  for (let i = 0; i < nTotal; i++) {
    const effectiveAnnual = annualRateBps + (rateType === RateType.VARIABLE ? rateShockBps : 0);
    const pRate = periodRateBps(effectiveAnnual, periodsPerYear);
    let interest = pctOf(balance, pRate);
    const inGrace = i < graceN;
    const isLast = i === nTotal - 1;
    let principalRepay = 0n;
    let cashInterest = interest;

    if (inGrace) {
      if (capitalizeInterestInGrace) {
        balance += interest;
        cashInterest = 0n;
      }
      principalRepay = 0n;
    } else if (isLast) {
      principalRepay = balance;
    } else if (
      method === AmortizationMethod.BULLET ||
      method === AmortizationMethod.INTEREST_ONLY
    ) {
      principalRepay = 0n;
    } else if (method === AmortizationMethod.EQUAL_PRINCIPAL) {
      principalRepay = amortizablePrincipal / BigInt(amortPeriods);
      if (principalRepay > balance - balloonMinor) principalRepay = balance - balloonMinor;
    } else {
      const pmt = equalInstalmentPayment(amortizablePrincipal, pRate, amortPeriods);
      principalRepay = pmt > interest ? pmt - interest : 0n;
      if (balance - principalRepay < balloonMinor) {
        principalRepay = balance - balloonMinor;
      }
    }

    if (principalRepay < 0n) principalRepay = 0n;
    if (principalRepay > balance) principalRepay = balance;

    const fees = i === 0 ? feeMinor : 0n;
    const debtService = principalRepay + cashInterest + fees;
    balance -= principalRepay;

    totalInterest += interest; // economic interest including capitalized
    totalPrincipal += principalRepay;
    totalCashService += principalRepay + cashInterest;

    lines.push({
      period: i + 1,
      label: `P${i + 1}`,
      inGrace,
      openingPrincipal: amt(balance + principalRepay),
      drawdown: amt(0n),
      principalRepayment: amt(principalRepay),
      interest: amt(interest),
      cashInterest: amt(cashInterest),
      fees: amt(fees),
      totalDebtService: amt(debtService),
      closingPrincipal: amt(balance),
      annualRateBps: effectiveAnnual,
      periodRateBps: pRate,
    });
  }

  const finalClose = balance;
  if (finalClose !== 0n) {
    findings.push({
      code: 'LRD-011',
      severity: 'CRITICAL',
      message: `Schedule closing principal is ${minorToDecimalString(finalClose)}; expected zero.`,
    });
  }

  const payload = {
    method,
    rateType,
    termMonths,
    periods: nTotal,
    periodsPerYear,
    gracePeriods: graceN,
    balloon: amt(balloonMinor),
    principal: amt(principal),
    upfrontFee: amt(feeMinor),
    lines,
    totals: {
      totalInterest: amt(totalInterest),
      totalPrincipalRepaid: amt(totalPrincipal),
      totalFees: amt(feeMinor),
      totalDebtService: amt(totalCashService),
      totalBorrowingCost: amt(totalInterest + feeMinor),
    },
    findings,
    reconciles: finalClose === 0n,
    neverPostsToGl: true,
    disclaimer:
      'Proposed schedule is for internal planning only. It does not create an actual loan liability or Journal Entry.',
    formulaVersion: 'AMORTIZATION_V1',
  };

  payload.checksum = createHash('sha256')
    .update(
      JSON.stringify({
        principal: payload.principal.minor,
        n: nTotal,
        method,
        totalDebtService: payload.totals.totalDebtService.minor,
        finalClose: String(finalClose),
      })
    )
    .digest('hex');

  return payload;
}
