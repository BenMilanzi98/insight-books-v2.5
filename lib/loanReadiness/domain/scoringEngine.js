/**
 * Transparent internal readiness scoring — weights must sum to 100.
 * Never a lender decision. Protected attributes rejected.
 */

import { createHash } from 'crypto';
import {
  SCORE_MODEL_VERSION,
  ReadinessBand,
  ADVISORY_DISCLAIMER,
  PROHIBITED_SCORE_ATTRIBUTES,
} from './enums.js';
import { ProtectedAttributeInputError, ScoreWeightsInvalidError } from './errors.js';

/** Default model weights (percent). */
export const DEFAULT_SCORE_WEIGHTS = Object.freeze({
  financialDataQuality: 15,
  profitability: 10,
  cashFlowGeneration: 12,
  debtServiceCapacity: 15,
  liquidity: 10,
  leverage: 10,
  workingCapitalEfficiency: 5,
  forecastStrength: 8,
  existingDebtPerformance: 5,
  bankingAndCashControls: 5,
  documentReadiness: 3,
  collateralReadiness: 2,
});

export function assertNoProhibitedInputs(payload = {}) {
  const found = [];
  const walk = (obj, path = '') => {
    if (!obj || typeof obj !== 'object') return;
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase();
      if (PROHIBITED_SCORE_ATTRIBUTES.some((p) => key.includes(p.toLowerCase()))) {
        found.push(path ? `${path}.${k}` : k);
      }
      if (v && typeof v === 'object') walk(v, path ? `${path}.${k}` : k);
    }
  };
  walk(payload);
  if (found.length) throw new ProtectedAttributeInputError(found);
}

export function validateWeights(weights) {
  const vals = Object.values(weights);
  const sum = vals.reduce((s, n) => s + Number(n), 0);
  if (Math.round(sum) !== 100) {
    throw new ScoreWeightsInvalidError(`Weights sum to ${sum}, expected 100.`);
  }
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

function bandFor(score) {
  if (score >= 85) return ReadinessBand.STRONG_INTERNAL_READINESS;
  if (score >= 70) return ReadinessBand.GENERALLY_READY_WITH_ITEMS_TO_CONFIRM;
  if (score >= 55) return ReadinessBand.MODERATE_READINESS_WITH_MATERIAL_GAPS;
  if (score >= 40) return ReadinessBand.WEAK_READINESS;
  return ReadinessBand.NOT_READY_UNDER_CURRENT_ASSUMPTIONS;
}

/**
 * metrics: object of dimensionKey → { score0to100, evidence, formula }
 */
export function calculateReadinessScore({
  metrics = {},
  weights = DEFAULT_SCORE_WEIGHTS,
  overrides = {},
  confidence = 'MODERATE',
} = {}) {
  assertNoProhibitedInputs({ metrics, overrides });
  validateWeights(weights);

  const dimensions = [];
  let weighted = 0;

  for (const [key, weight] of Object.entries(weights)) {
    const m = metrics[key] || { score: 50, evidence: 'Default mid-score — metric not supplied.' };
    const calculated = clampScore(m.score);
    const override = overrides[key];
    const applied = override != null ? clampScore(override.score) : calculated;
    const contribution = (applied * Number(weight)) / 100;
    weighted += contribution;
    dimensions.push({
      key,
      weightPercent: Number(weight),
      calculatedScore: calculated,
      appliedScore: applied,
      override: override
        ? {
            score: clampScore(override.score),
            reason: override.reason || null,
            requiresApproval: true,
          }
        : null,
      contribution,
      formula: m.formula || null,
      evidence: m.evidence || null,
      lineage: {
        metric: key,
        weight: Number(weight),
        calculated,
        applied,
        modelVersion: SCORE_MODEL_VERSION,
      },
    });
  }

  const total = clampScore(weighted);
  return {
    modelVersion: SCORE_MODEL_VERSION,
    totalReadinessScore: total,
    band: bandFor(total),
    confidence,
    dimensions,
    weights,
    disclaimer: ADVISORY_DISCLAIMER,
    notALenderDecision: true,
    notAGuarantee: true,
    checksum: createHash('sha256')
      .update(JSON.stringify({ total, weights, dimensions: dimensions.map((d) => d.appliedScore) }))
      .digest('hex'),
  };
}

/**
 * Map analysis outputs into dimension scores (0–100).
 */
export function metricsFromAnalysis(analysis = {}) {
  const dq = analysis.dataQuality?.status;
  const dqScore =
    dq === 'VERIFIED'
      ? 95
      : dq === 'SUBSTANTIALLY_VERIFIED'
        ? 80
        : dq === 'PARTIALLY_VERIFIED'
          ? 60
          : dq === 'LIMITED'
            ? 40
            : dq === 'MATERIAL_EXCEPTIONS'
              ? 20
              : 10;

  const minDscr = analysis.dscr?.summary?.minimumDscrObserved;
  const target = analysis.targetDscr || 1.25;
  const dscrScore =
    minDscr == null
      ? 40
      : minDscr >= target * 1.5
        ? 95
        : minDscr >= target
          ? 80
          : minDscr >= target * 0.8
            ? 50
            : 20;

  const current = analysis.liquidity?.currentRatio?.ratio;
  const liqScore =
    current == null ? 40 : current >= 2 ? 90 : current >= 1.2 ? 75 : current >= 1 ? 55 : 25;

  const dte = analysis.leverage?.debtToEquity?.ratio;
  const levScore =
    dte == null ? 50 : dte <= 0.5 ? 90 : dte <= 1 ? 75 : dte <= 2 ? 55 : 25;

  const capacity = analysis.debtCapacity;
  const capScore =
    capacity?.affordabilityStatus === 'COMFORTABLE'
      ? 90
      : capacity?.affordabilityStatus === 'MANAGEABLE_WITH_CUSHION'
        ? 75
        : capacity?.affordabilityStatus === 'TIGHT'
          ? 55
          : capacity?.affordabilityStatus === 'HIGH_RISK'
            ? 35
            : 15;

  const docs = analysis.documentReadiness?.completionPercent ?? 50;
  const coll = analysis.collateralReadiness?.completionPercent ?? 50;

  return {
    financialDataQuality: {
      score: dqScore,
      formula: 'Mapped from data-quality status',
      evidence: dq || 'UNKNOWN',
    },
    profitability: {
      score: analysis.profitabilityScore ?? 60,
      formula: 'Margin / growth heuristics',
      evidence: analysis.profitabilityNote || null,
    },
    cashFlowGeneration: {
      score: analysis.cashFlowScore ?? 60,
      formula: 'Operating CF / EBITDA conversion',
      evidence: analysis.cashFlowNote || null,
    },
    debtServiceCapacity: {
      score: Math.round((dscrScore + capScore) / 2),
      formula: 'Blend of min DSCR vs target and affordability status',
      evidence: { minDscr, affordability: capacity?.affordabilityStatus },
    },
    liquidity: {
      score: liqScore,
      formula: 'Current ratio thresholds',
      evidence: { currentRatio: current },
    },
    leverage: {
      score: levScore,
      formula: 'Debt-to-Equity thresholds',
      evidence: { debtToEquity: dte },
    },
    workingCapitalEfficiency: {
      score: analysis.workingCapitalScore ?? 55,
      formula: 'CCC / DSO heuristics',
      evidence: analysis.workingCapitalNote || null,
    },
    forecastStrength: {
      score: analysis.forecastScore ?? 60,
      formula: 'Forecast integrity + confidence',
      evidence: analysis.forecastNote || null,
    },
    existingDebtPerformance: {
      score: analysis.existingDebtScore ?? 70,
      formula: 'Arrears / reconciliation status',
      evidence: analysis.existingDebtNote || null,
    },
    bankingAndCashControls: {
      score: analysis.bankControlScore ?? 60,
      formula: 'Bank reconciliation completion',
      evidence: analysis.bankControlNote || null,
    },
    documentReadiness: {
      score: clampScore(docs),
      formula: 'Required documents complete %',
      evidence: { completionPercent: docs },
    },
    collateralReadiness: {
      score: clampScore(coll),
      formula: 'Collateral evidence complete %',
      evidence: { completionPercent: coll },
    },
  };
}
