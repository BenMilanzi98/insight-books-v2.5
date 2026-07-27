/**
 * Phase 18 — Documented operational health scorecards.
 * Critical restrictions override a high numeric score.
 */

export const HEALTH_DOMAIN = Object.freeze({
  PLATFORM_EIS_HEALTH: 'PLATFORM_EIS_HEALTH',
  TENANT_EIS_HEALTH: 'TENANT_EIS_HEALTH',
  BUSINESS_EIS_HEALTH: 'BUSINESS_EIS_HEALTH',
  TERMINAL_HEALTH: 'TERMINAL_HEALTH',
  CONFIGURATION_HEALTH: 'CONFIGURATION_HEALTH',
  MAPPING_HEALTH: 'MAPPING_HEALTH',
  TRANSMISSION_HEALTH: 'TRANSMISSION_HEALTH',
  RECONCILIATION_HEALTH: 'RECONCILIATION_HEALTH',
  OFFLINE_HEALTH: 'OFFLINE_HEALTH',
  RECEIPT_HEALTH: 'RECEIPT_HEALTH',
  COMPLIANCE_HEALTH: 'COMPLIANCE_HEALTH',
  CERTIFICATION_HEALTH: 'CERTIFICATION_HEALTH',
});

/**
 * Calculate a transparent health score (0–100).
 * Inputs are documented booleans/ratios — not opaque ML.
 */
export function calculateHealthScorecard({
  domain = HEALTH_DOMAIN.BUSINESS_EIS_HEALTH,
  inputs = {},
  calculationVersion = 'health-scorecard-v1',
} = {}) {
  const weights = {
    entitlementOk: 15,
    participationOk: 10,
    certificationOk: 15,
    configurationFresh: 10,
    mappingComplete: 10,
    transmissionHealthy: 15,
    reconciliationHealthy: 10,
    offlineHealthy: 5,
    noCriticalRestriction: 10,
  };

  let score = 0;
  const breakdown = [];
  for (const [key, weight] of Object.entries(weights)) {
    const ok = Boolean(inputs[key]);
    if (ok) score += weight;
    breakdown.push({ input: key, weight, passed: ok });
  }

  const blocking = [];
  if (inputs.criticalRestrictionActive) {
    blocking.push('CRITICAL_RESTRICTION_OVERRIDES_SCORE');
  }
  if (inputs.mraTerminalBlocked) {
    blocking.push('MRA_TERMINAL_BLOCKED');
  }
  if (inputs.sequenceConflict) {
    blocking.push('FISCAL_SEQUENCE_CONFLICT');
  }

  const effectiveScore = blocking.length ? Math.min(score, 25) : score;
  let band = 'HEALTHY';
  if (blocking.length) band = 'BLOCKED';
  else if (effectiveScore < 50) band = 'CRITICAL';
  else if (effectiveScore < 75) band = 'DEGRADED';

  return {
    domain,
    score: effectiveScore,
    rawScore: score,
    band,
    blocking,
    warnings: inputs.warnings || [],
    breakdown,
    calculationVersion,
    interpretation:
      band === 'BLOCKED'
        ? 'Critical restrictions override numeric health. Terminal is not fully operational.'
        : band === 'HEALTHY'
          ? 'No blocking conditions; weighted inputs are largely healthy.'
          : 'One or more weighted inputs failed; drill down required.',
    financialSourceOfTruth: false,
    evaluatedAt: new Date().toISOString(),
  };
}
