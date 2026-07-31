/**
 * DSCR and Interest Coverage — versioned formulas.
 * DSCR_CFADS_OVER_DEBT_SERVICE_V1:
 *   CFADS = Operating Cash Flow before debt service (or EBITDA − cash tax − maint. capex − ΔNWC)
 *   DSCR = CFADS / Total Debt Service
 */

import {
  DSCR_FORMULA_VERSION,
  ICR_FORMULA_VERSION,
} from './enums.js';
import { parseToMinor, amt, minorToDecimalString } from './money.js';

export function computeDscr({
  cfadsMinor,
  debtServiceMinor,
  formulaVersion = DSCR_FORMULA_VERSION,
} = {}) {
  const cfads = typeof cfadsMinor === 'bigint' ? cfadsMinor : parseToMinor(cfadsMinor);
  const service = typeof debtServiceMinor === 'bigint' ? debtServiceMinor : parseToMinor(debtServiceMinor);

  if (service === 0n) {
    return {
      ratio: null,
      meaningful: false,
      reason: 'Zero debt service — DSCR not meaningful.',
      cfads: amt(cfads),
      debtService: amt(service),
      formulaVersion,
      formula: 'CFADS ÷ Total Debt Service',
    };
  }

  // ratio * 100 for 2dp: (cfads * 100) / service → then /100
  const scaled = Number((cfads * 10000n) / service) / 10000;
  return {
    ratio: scaled,
    meaningful: true,
    cfads: amt(cfads),
    debtService: amt(service),
    formulaVersion,
    formula: 'CFADS ÷ Total Debt Service',
    numeratorDefinition:
      'Cash Flow Available for Debt Service (configured: Operating CF before debt service / EBITDA−tax−maint. capex−ΔNWC)',
    denominatorDefinition: 'Principal + Interest + required loan fees (+ leases if configured)',
  };
}

export function computeInterestCoverage({
  ebitdaMinor,
  interestMinor,
  formulaVersion = ICR_FORMULA_VERSION,
} = {}) {
  const ebitda = typeof ebitdaMinor === 'bigint' ? ebitdaMinor : parseToMinor(ebitdaMinor);
  const interest = typeof interestMinor === 'bigint' ? interestMinor : parseToMinor(interestMinor);

  if (interest === 0n) {
    return {
      ratio: null,
      meaningful: false,
      reason: 'Zero interest — coverage not meaningful.',
      ebitda: amt(ebitda),
      interest: amt(interest),
      formulaVersion,
      formula: 'EBITDA ÷ Interest Expense',
    };
  }
  if (ebitda <= 0n) {
    return {
      ratio: Number((ebitda * 10000n) / interest) / 10000,
      meaningful: true,
      warning: 'Non-positive EBITDA — coverage weak or negative.',
      ebitda: amt(ebitda),
      interest: amt(interest),
      formulaVersion,
      formula: 'EBITDA ÷ Interest Expense',
    };
  }
  return {
    ratio: Number((ebitda * 10000n) / interest) / 10000,
    meaningful: true,
    ebitda: amt(ebitda),
    interest: amt(interest),
    formulaVersion,
    formula: 'EBITDA ÷ Interest Expense',
  };
}

/**
 * Build period DSCR series from forecast periods + existing/proposed debt service.
 */
export function projectDscrSeries({
  periods = [],
  existingDebtServiceByPeriod = [],
  proposedDebtServiceByPeriod = [],
  minimumDscr = 1.25,
} = {}) {
  const results = [];
  let minRatio = null;
  let firstBreach = null;

  for (let i = 0; i < periods.length; i++) {
    const p = periods[i];
    // Prefer operating CF proxy: netProfit + depreciation − ΔAR − ΔInv + ΔAP as CFADS approx
    // Or use pnl.ebitda − tax as simpler CFADS when full CF available
    const ebitda = BigInt(p.pnl?.ebitda?.minor || 0);
    const tax = BigInt(p.pnl?.tax?.minor || 0);
    const dep = BigInt(p.pnl?.depreciation?.minor || 0);
    const netCash = BigInt(p.cashFlow?.netCashMovement?.minor || 0);
    // CFADS approximation: EBITDA - tax + dep add-back already in ebitda path; use ebitda - tax
    const cfads = ebitda - tax;

    const existing = BigInt(existingDebtServiceByPeriod[i] || 0);
    const proposed = BigInt(proposedDebtServiceByPeriod[i] || 0);
    const totalService = existing + proposed;

    const dscr = computeDscr({ cfadsMinor: cfads, debtServiceMinor: totalService });
    const icr = computeInterestCoverage({
      ebitdaMinor: ebitda,
      interestMinor: BigInt(p.pnl?.interest?.minor || 0) + proposedInterestProxy(proposed),
    });

    let status = 'COMPLIANT';
    if (!dscr.meaningful) status = 'NOT_APPLICABLE';
    else if (dscr.ratio < minimumDscr) {
      status = 'BREACH';
      if (firstBreach == null) firstBreach = { period: p.label || `P${i + 1}`, index: i, ratio: dscr.ratio };
    } else if (dscr.ratio < minimumDscr * 1.1) status = 'COMPLIANT_WITH_LOW_HEADROOM';

    if (dscr.meaningful) {
      if (minRatio == null || dscr.ratio < minRatio) minRatio = dscr.ratio;
    }

    results.push({
      index: i,
      label: p.label || `P${i + 1}`,
      cfads: amt(cfads),
      existingDebtService: amt(existing),
      proposedDebtService: amt(proposed),
      totalDebtService: amt(totalService),
      dscr,
      interestCoverage: icr,
      status,
      headroom: dscr.meaningful ? dscr.ratio - minimumDscr : null,
      netCashMovement: amt(netCash),
      depreciation: amt(dep),
    });
  }

  const meaningful = results.filter((r) => r.dscr.meaningful);
  const avg =
    meaningful.length > 0
      ? meaningful.reduce((s, r) => s + r.dscr.ratio, 0) / meaningful.length
      : null;

  return {
    formulaVersion: DSCR_FORMULA_VERSION,
    minimumDscr,
    periods: results,
    summary: {
      minimumDscrObserved: minRatio,
      averageDscr: avg,
      firstBreach,
      breachCount: results.filter((r) => r.status === 'BREACH').length,
      note: 'A strong average DSCR does not hide individual-period breaches.',
    },
  };
}

function proposedInterestProxy(proposedServiceMinor) {
  // Conservative: assume ~40% of early debt service is interest when unknown
  return (proposedServiceMinor * 40n) / 100n;
}

export function computeLiquidityRatios({
  currentAssetsMinor,
  currentLiabilitiesMinor,
  cashMinor,
  receivablesMinor,
  inventoryMinor,
} = {}) {
  const ca = parseToMinor(currentAssetsMinor);
  const cl = parseToMinor(currentLiabilitiesMinor);
  const cash = parseToMinor(cashMinor);
  const ar = parseToMinor(receivablesMinor);
  const inv = parseToMinor(inventoryMinor);

  const currentRatio =
    cl === 0n ? null : Number((ca * 10000n) / cl) / 10000;
  const quickRatio =
    cl === 0n ? null : Number(((cash + ar) * 10000n) / cl) / 10000;
  const workingCapital = ca - cl;

  return {
    currentRatio: {
      ratio: currentRatio,
      formula: 'Current Assets ÷ Current Liabilities',
      numerator: amt(ca),
      denominator: amt(cl),
      meaningful: cl !== 0n,
    },
    quickRatio: {
      ratio: quickRatio,
      formula: '(Cash + Receivables) ÷ Current Liabilities',
      numerator: amt(cash + ar),
      denominator: amt(cl),
      note: 'Inventory excluded; slow/obsolete inventory not treated as liquid.',
      meaningful: cl !== 0n,
    },
    workingCapital: amt(workingCapital),
    inventoryDisclosed: amt(inv),
  };
}

export function computeLeverageRatios({
  totalDebtMinor,
  equityMinor,
  ebitdaMinor,
  cashMinor,
} = {}) {
  const debt = parseToMinor(totalDebtMinor);
  const equity = parseToMinor(equityMinor);
  const ebitda = parseToMinor(ebitdaMinor);
  const cash = parseToMinor(cashMinor);
  const netDebt = debt - cash;

  const debtToEquity =
    equity <= 0n
      ? { ratio: null, meaningful: false, reason: 'Non-positive equity — ratio not meaningful.' }
      : {
          ratio: Number((debt * 10000n) / equity) / 10000,
          meaningful: true,
          formula: 'Interest-Bearing Debt ÷ Equity',
        };

  const debtToEbitda =
    ebitda <= 0n
      ? { ratio: null, meaningful: false, reason: 'Non-positive EBITDA — ratio not meaningful.' }
      : {
          ratio: Number((debt * 10000n) / ebitda) / 10000,
          meaningful: true,
          formula: 'Interest-Bearing Debt ÷ EBITDA',
        };

  const netDebtToEbitda =
    ebitda <= 0n
      ? { ratio: null, meaningful: false, reason: 'Non-positive EBITDA — ratio not meaningful.' }
      : {
          ratio: Number((netDebt * 10000n) / ebitda) / 10000,
          meaningful: true,
          formula: 'Net Debt ÷ EBITDA',
          netDebt: amt(netDebt),
        };

  return {
    totalDebt: amt(debt),
    equity: amt(equity),
    ebitda: amt(ebitda),
    netDebt: amt(netDebt),
    debtToEquity,
    debtToEbitda,
    netDebtToEbitda,
  };
}

export { minorToDecimalString };
