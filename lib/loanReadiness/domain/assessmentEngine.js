/**
 * Full assessment calculation orchestrator (pure — no DB, no GL writes).
 */

import { createHash } from 'crypto';
import { IntegrityStatus, DataQualityStatus, ADVISORY_DISCLAIMER } from './enums.js';
import { buildProposedLoanSchedule } from './amortizationEngine.js';
import {
  projectDscrSeries,
  computeLiquidityRatios,
  computeLeverageRatios,
} from './dscrEngine.js';
import { calculateDebtCapacity, runStressCapacity } from './debtCapacityEngine.js';
import { calculateReadinessScore, metricsFromAnalysis } from './scoringEngine.js';
import { projectWithProposedFacility } from './proposedFacilityProjection.js';
import { assessDocumentReadiness, DEFAULT_DOCUMENT_CHECKLIST } from './documentChecklist.js';
import { parseToMinor, amt } from './money.js';

export function runLoanReadinessAssessment(input = {}) {
  const findings = [];
  const requested = parseToMinor(input.loanRequest?.requestedAmount ?? 0);
  const termMonths = Number(input.loanRequest?.requestedTermMonths || 36);
  const rateBps = Number(
    input.loanRequest?.expectedInterestRateBps ?? input.product?.baseRateBps ?? 1800
  );
  const targetDscr = Number(input.lenderCriteria?.minimumDSCR ?? 1.25);

  // Existing debt service (monthly minor units)
  const existingLiabilities = input.existingDebt || [];
  const monthlyExistingService = existingLiabilities.reduce((s, l) => {
    const bal = parseToMinor(l.currentBalance ?? l.principalAmount ?? 0);
    const rate = Number(l.interestRate || 0); // percent
    const monthlyInterest = pctApprox(bal, rate);
    const principalPortion = bal > 0n ? bal / 36n : 0n; // rough if no schedule
    return s + monthlyInterest + principalPortion;
  }, 0n);

  const forecastPeriods = input.forecast?.periods || [];
  const months = Math.max(forecastPeriods.length, termMonths, 12);

  // Build proposed schedule for requested amount
  let proposedSchedule = null;
  if (requested > 0n) {
    proposedSchedule = buildProposedLoanSchedule({
      principalAmount: requested,
      termMonths,
      annualInterestRateBps: rateBps,
      method: input.loanRequest?.amortizationMethod || 'EQUAL_INSTALMENT',
      gracePeriodMonths: input.loanRequest?.gracePeriodMonths || 0,
      balloonAmount: input.loanRequest?.balloonAmount || 0,
      upfrontFeeAmount: input.loanRequest?.upfrontFeeAmount || 0,
      rateType: input.loanRequest?.rateType || 'FIXED',
      capitalizeInterestInGrace: input.loanRequest?.capitalizeInterestInGrace,
    });
    if (!proposedSchedule.reconciles) {
      findings.push(...(proposedSchedule.findings || []));
    }
  }

  const proposedServiceByPeriod = [];
  const existingServiceByPeriod = [];
  const cfadsByPeriod = [];
  const labels = [];

  for (let i = 0; i < months; i++) {
    const fp = forecastPeriods[i];
    labels.push(fp?.label || `M${i + 1}`);
    const ebitda = BigInt(fp?.pnl?.ebitda?.minor || input.baseEbitdaMinor || 0);
    const tax = BigInt(fp?.pnl?.tax?.minor || 0);
    cfadsByPeriod.push(String(ebitda - tax));
    existingServiceByPeriod.push(String(existingMonthlyServiceFor(existingLiabilities, i, monthlyExistingService)));
    const line = proposedSchedule?.lines?.[i];
    proposedServiceByPeriod.push(line ? line.totalDebtService.minor : '0');
  }

  const dscr = projectDscrSeries({
    periods:
      forecastPeriods.length > 0
        ? forecastPeriods
        : cfadsByPeriod.map((c, i) => ({
            label: labels[i],
            pnl: {
              ebitda: amt(BigInt(c)),
              tax: amt(0n),
              interest: amt(0n),
              depreciation: amt(0n),
            },
            cashFlow: { netCashMovement: amt(0n) },
          })),
    existingDebtServiceByPeriod: existingServiceByPeriod,
    proposedDebtServiceByPeriod: proposedServiceByPeriod,
    minimumDscr: targetDscr,
  });

  const opening = input.openingBalances || {};
  const last = forecastPeriods[forecastPeriods.length - 1];
  const liquidity = computeLiquidityRatios({
    currentAssetsMinor:
      opening.currentAssets ??
      sumMinor(opening.cash, opening.receivables, opening.inventory),
    currentLiabilitiesMinor:
      opening.currentLiabilities ??
      sumMinor(opening.payables, opening.shortTermDebt, opening.taxPayable),
    cashMinor: last?.balanceSheet?.cash?.minor ?? opening.cash ?? 0,
    receivablesMinor: last?.balanceSheet?.receivables?.minor ?? opening.receivables ?? 0,
    inventoryMinor: last?.balanceSheet?.inventory?.minor ?? opening.inventory ?? 0,
  });

  const totalDebt =
    BigInt(last?.balanceSheet?.shortTermDebt?.minor || opening.shortTermDebt || 0) +
    BigInt(last?.balanceSheet?.longTermDebt?.minor || opening.longTermDebt || 0) +
    requested;
  const equity =
    BigInt(last?.balanceSheet?.totalEquity?.minor || 0) ||
    parseToMinor(opening.equity) + parseToMinor(opening.retainedEarnings);
  const ebitdaAnnual = cfadsByPeriod
    .slice(0, 12)
    .reduce((s, v) => s + BigInt(v), 0n);

  const leverage = computeLeverageRatios({
    totalDebtMinor: totalDebt,
    equityMinor: equity,
    ebitdaMinor: ebitdaAnnual,
    cashMinor: last?.balanceSheet?.cash?.minor ?? opening.cash ?? 0,
  });

  const debtCapacity = calculateDebtCapacity({
    cfadsByPeriodMinor: cfadsByPeriod,
    existingDebtServiceByPeriodMinor: existingServiceByPeriod,
    minCashRetentionPerPeriod: input.minCashRetentionPerPeriod || 0,
    targetDscr,
    termMonths,
    annualInterestRateBps: rateBps,
    requestedAmount: requested,
    gracePeriodMonths: input.loanRequest?.gracePeriodMonths || 0,
    balloonAmount: input.loanRequest?.balloonAmount || 0,
    labels,
  });

  const mildStress = runStressCapacity(
    {
      cfadsByPeriodMinor: cfadsByPeriod,
      existingDebtServiceByPeriodMinor: existingServiceByPeriod,
      targetDscr,
      termMonths,
      annualInterestRateBps: rateBps,
      requestedAmount: requested,
      labels,
    },
    { cfadsFactorBps: 9500, rateShockBps: 100 }
  );
  const severeStress = runStressCapacity(
    {
      cfadsByPeriodMinor: cfadsByPeriod,
      existingDebtServiceByPeriodMinor: existingServiceByPeriod,
      targetDscr,
      termMonths,
      annualInterestRateBps: rateBps,
      requestedAmount: requested,
      labels,
    },
    { cfadsFactorBps: 8000, rateShockBps: 500 }
  );

  const covenants = evaluateCovenants({
    dscr,
    liquidity,
    leverage,
    criteria: input.lenderCriteria || {},
  });

  const dataQuality = assessDataQuality(input);
  if (dataQuality.status === DataQualityStatus.UNSUITABLE_FOR_ASSESSMENT) {
    findings.push({
      code: 'LRD-034',
      severity: 'CRITICAL',
      message: 'Material data-quality exceptions make assessment unsuitable.',
    });
  }

  const documentReadiness =
    input.documentReadiness ||
    assessDocumentReadiness(input.documentChecklistSubmitted || [], DEFAULT_DOCUMENT_CHECKLIST);
  const collateralReadiness = input.collateralReadiness || {
    completionPercent: input.loanRequest?.proposedSecurityType ? 40 : 20,
    note: 'Collateral values require evidence — system does not estimate market values.',
  };

  const risks = buildRiskFindings({ dscr, debtCapacity, dataQuality, covenants, leverage, liquidity });
  const recommendations = buildRecommendations(risks);

  // Inject proposed debt into Phase 13 three-statement engine (advisory; never posts)
  const baseRevenue =
    input.baseRevenueMinor ??
    forecastPeriods[0]?.pnl?.revenue?.minor ??
    (input.baseEbitdaMinor
      ? String((parseToMinor(input.baseEbitdaMinor) * 100n) / 40n) // ~40% EBITDA margin inverse
      : 0);
  const proposedFacilityProjection =
    requested > 0n
      ? projectWithProposedFacility({
          opening: opening,
          baseRevenueMinor: baseRevenue,
          months: Math.min(months, 36),
          baseAssumptions: input.planningAssumptions || {},
          loanRequest: {
            requestedAmount: requested,
            requestedTermMonths: termMonths,
            expectedInterestRateBps: rateBps,
            amortizationMethod: input.loanRequest?.amortizationMethod,
            gracePeriodMonths: input.loanRequest?.gracePeriodMonths,
            balloonAmount: input.loanRequest?.balloonAmount,
            upfrontFeeAmount: input.loanRequest?.upfrontFeeAmount,
            rateType: input.loanRequest?.rateType,
            capitalizeInterestInGrace: input.loanRequest?.capitalizeInterestInGrace,
          },
        })
      : null;
  if (proposedFacilityProjection?.findings?.length) {
    findings.push(...proposedFacilityProjection.findings);
  }

  const score = calculateReadinessScore({
    metrics: metricsFromAnalysis({
      dataQuality,
      dscr,
      targetDscr,
      liquidity,
      leverage,
      debtCapacity,
      documentReadiness,
      collateralReadiness,
      profitabilityScore: input.profitabilityScore,
      cashFlowScore: input.cashFlowScore,
      forecastScore: input.forecast?.integrityStatus === 'VALID' ? 80 : 50,
      forecastNote: input.forecast?.integrityStatus || null,
      bankControlScore: input.bankControlScore,
      existingDebtScore: existingLiabilities.length ? 70 : 60,
    }),
    confidence: dataQuality.confidence || 'MODERATE',
  });

  // Validation
  if (requested > 0n && proposedSchedule && !proposedSchedule.reconciles) {
    findings.push({ code: 'LRD-011', severity: 'CRITICAL', message: 'Proposed schedule does not reconcile.' });
  }
  findings.push({
    code: 'DISCLAIMER',
    severity: 'INFO',
    message: ADVISORY_DISCLAIMER,
  });

  const critical = findings.filter((f) => f.severity === 'CRITICAL');
  let integrityStatus = IntegrityStatus.VALID;
  if (critical.length) integrityStatus = IntegrityStatus.INVALID;
  else if (findings.some((f) => f.severity === 'WARNING')) {
    integrityStatus = IntegrityStatus.VALID_WITH_WARNINGS;
  }
  if (dataQuality.status === DataQualityStatus.UNSUITABLE_FOR_ASSESSMENT) {
    integrityStatus = IntegrityStatus.BLOCKED;
  }

  const payload = {
    loanRequest: input.loanRequest || null,
    proposedSchedule,
    proposedFacilityProjection: proposedFacilityProjection
      ? {
          integration: proposedFacilityProjection.integration,
          integrityStatus: proposedFacilityProjection.projection?.integrityStatus,
          checksum: proposedFacilityProjection.projection?.checksum,
          periods: proposedFacilityProjection.projection?.periods || [],
          scheduleReconciles: proposedFacilityProjection.schedule?.reconciles ?? null,
        }
      : null,
    dscr,
    liquidity,
    leverage,
    debtCapacity,
    stress: { mild: mildStress, severe: severeStress },
    covenants,
    dataQuality,
    documentReadiness,
    collateralReadiness,
    score,
    risks,
    recommendations,
    findings,
    integrityStatus,
    neverPostsToGl: true,
    neverCreatesLiability: true,
    disclaimer: ADVISORY_DISCLAIMER,
    modelVersions: {
      score: score.modelVersion,
      dscr: dscr.formulaVersion,
      debtCapacity: debtCapacity.formulaVersion,
      amortization: proposedSchedule?.formulaVersion || null,
      threeStatement: 'PLAN_V2_THREE_STATEMENT_WITH_PROPOSED_DEBT_V1',
    },
    sourceVersions: {
      forecastVersionId: input.forecastVersionId || null,
      sourceActualsVersion: input.sourceActualsVersion || null,
    },
  };

  payload.checksum = createHash('sha256')
    .update(
      JSON.stringify({
        integrityStatus,
        score: score.totalReadinessScore,
        indicative: debtCapacity.indicativeMaximumPrincipal?.minor,
        minDscr: dscr.summary?.minimumDscrObserved,
      })
    )
    .digest('hex');

  return payload;
}

function pctApprox(principalMinor, annualPercent) {
  // monthly interest ≈ principal * annual% / 12 / 100
  const bps = Math.round(Number(annualPercent) * 100);
  return (principalMinor * BigInt(bps)) / (10000n * 12n);
}

function existingMonthlyServiceFor(liabilities, index, fallback) {
  if (!liabilities.length) return 0n;
  return fallback;
}

function sumMinor(...vals) {
  return vals.reduce((s, v) => s + parseToMinor(v ?? 0), 0n);
}

function assessDataQuality(input) {
  const checks = [];
  let score = 0;
  if (input.forecast?.integrityStatus === 'VALID') {
    checks.push({ key: 'FORECAST', ok: true });
    score += 25;
  } else {
    checks.push({ key: 'FORECAST', ok: false, detail: input.forecast?.integrityStatus || 'missing' });
  }
  if (input.sourceActualsVersion) {
    checks.push({ key: 'ACTUALS_VERSION', ok: true });
    score += 25;
  } else {
    checks.push({ key: 'ACTUALS_VERSION', ok: false });
  }
  if ((input.existingDebt || []).length >= 0) {
    checks.push({ key: 'EXISTING_DEBT_REGISTER', ok: true });
    score += 15;
  }
  if (input.bankReconciled) {
    checks.push({ key: 'BANK_RECON', ok: true });
    score += 20;
  } else {
    checks.push({ key: 'BANK_RECON', ok: false, detail: 'Not confirmed' });
  }
  if (input.closedPeriodsAvailable) {
    checks.push({ key: 'CLOSED_PERIODS', ok: true });
    score += 15;
  } else {
    checks.push({ key: 'CLOSED_PERIODS', ok: false });
  }

  let status = DataQualityStatus.LIMITED;
  if (score >= 85) status = DataQualityStatus.VERIFIED;
  else if (score >= 70) status = DataQualityStatus.SUBSTANTIALLY_VERIFIED;
  else if (score >= 50) status = DataQualityStatus.PARTIALLY_VERIFIED;
  else if (input.materialExceptions) status = DataQualityStatus.MATERIAL_EXCEPTIONS;
  if (input.materialExceptions && score < 40) status = DataQualityStatus.UNSUITABLE_FOR_ASSESSMENT;

  return {
    status,
    score,
    checks,
    confidence: score >= 70 ? 'HIGH' : score >= 45 ? 'MODERATE' : 'LOW',
  };
}

function evaluateCovenants({ dscr, liquidity, leverage, criteria }) {
  const minDscr = Number(criteria.minimumDSCR ?? 1.25);
  const minCurrent = Number(criteria.minimumCurrentRatio ?? 1.1);
  const maxDte = Number(criteria.maximumDebtToEquity ?? 2.5);

  const items = [];
  const minObs = dscr.summary?.minimumDscrObserved;
  items.push({
    name: 'Minimum DSCR',
    formula: dscr.formulaVersion,
    actual: minObs,
    threshold: minDscr,
    operator: '>=',
    headroom: minObs != null ? minObs - minDscr : null,
    status:
      minObs == null
        ? 'INSUFFICIENT_DATA'
        : minObs >= minDscr
          ? minObs < minDscr * 1.1
            ? 'COMPLIANT_WITH_LOW_HEADROOM'
            : 'COMPLIANT'
          : 'BREACH',
  });

  const cr = liquidity.currentRatio?.ratio;
  items.push({
    name: 'Minimum Current Ratio',
    formula: liquidity.currentRatio?.formula,
    actual: cr,
    threshold: minCurrent,
    operator: '>=',
    headroom: cr != null ? cr - minCurrent : null,
    status:
      cr == null
        ? 'INSUFFICIENT_DATA'
        : cr >= minCurrent
          ? 'COMPLIANT'
          : 'BREACH',
  });

  const dte = leverage.debtToEquity?.ratio;
  items.push({
    name: 'Maximum Debt-to-Equity',
    formula: leverage.debtToEquity?.formula,
    actual: dte,
    threshold: maxDte,
    operator: '<=',
    headroom: dte != null ? maxDte - dte : null,
    status:
      dte == null
        ? 'INSUFFICIENT_DATA'
        : dte <= maxDte
          ? 'COMPLIANT'
          : 'BREACH',
  });

  return { items, formulaNote: 'Covenant thresholds from lender/internal criteria profile (source-labelled).' };
}

function buildRiskFindings({ dscr, debtCapacity, dataQuality, covenants, leverage, liquidity }) {
  const risks = [];
  if (dscr.summary?.firstBreach) {
    risks.push({
      category: 'DEBT_SERVICE',
      severity: 'HIGH',
      title: 'Projected DSCR breach',
      description: `First breach in ${dscr.summary.firstBreach.period} (ratio ${dscr.summary.firstBreach.ratio}).`,
      evidence: dscr.summary,
    });
  }
  if (debtCapacity.affordabilityStatus === 'UNAFFORDABLE_UNDER_ASSUMPTIONS') {
    risks.push({
      category: 'DEBT_SERVICE',
      severity: 'CRITICAL',
      title: 'Requested facility unaffordable under assumptions',
      description: 'Indicative capacity is below requested amount.',
      evidence: { affordability: debtCapacity.affordabilityStatus },
    });
  }
  if (dataQuality.status === DataQualityStatus.MATERIAL_EXCEPTIONS) {
    risks.push({
      category: 'DATA_QUALITY',
      severity: 'HIGH',
      title: 'Material financial data exceptions',
      description: 'Resolve accounting/reconciliation exceptions before financing outreach.',
    });
  }
  for (const c of covenants.items || []) {
    if (c.status === 'BREACH') {
      risks.push({
        category: 'COVENANT',
        severity: 'HIGH',
        title: `Covenant breach: ${c.name}`,
        description: `Actual ${c.actual} vs threshold ${c.threshold}.`,
      });
    }
  }
  if (liquidity.currentRatio?.ratio != null && liquidity.currentRatio.ratio < 1) {
    risks.push({
      category: 'LIQUIDITY',
      severity: 'HIGH',
      title: 'Current ratio below 1',
      description: 'Working capital may be insufficient for short-term obligations.',
    });
  }
  if (leverage.debtToEquity?.ratio != null && leverage.debtToEquity.ratio > 2.5) {
    risks.push({
      category: 'LEVERAGE',
      severity: 'MODERATE',
      title: 'Elevated leverage',
      description: 'Debt-to-Equity exceeds common internal thresholds.',
    });
  }
  return risks;
}

function buildRecommendations(risks = []) {
  const map = {
    DEBT_SERVICE: 'Reduce requested amount, extend term, or improve CFADS before approaching lenders.',
    DATA_QUALITY: 'Complete bank reconciliations and resolve Trial Balance / close exceptions.',
    COVENANT: 'Adjust facility terms or improve forecast drivers to restore covenant headroom.',
    LIQUIDITY: 'Accelerate Receivables collections and review short-term debt concentration.',
    LEVERAGE: 'Consider equity contribution or refinance expensive short-term debt.',
  };
  return risks.map((r) => ({
    finding: r.title,
    action: map[r.category] || 'Review evidence and assign a management owner.',
    category: r.category,
    priority: r.severity,
  }));
}
