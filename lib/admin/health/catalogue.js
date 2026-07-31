/**
 * Customer Health catalogue — versioned constants (Phase 8 Wave 1).
 * Health is explainable 0–100 + band + separate confidence — never churn probability.
 */

/** Verbatim definition id from HEALTH_DEFINITION_MATRIX.md */
export const HEALTH_DEFINITION_VERSION = 'customer-health-2026-07-28';

export const MISSING_POLICY = Object.freeze({
  EXCLUDE_AND_RENORMALISE: 'EXCLUDE_AND_RENORMALISE',
});

export const DIMENSION_STATUS = Object.freeze({
  SCORED: 'SCORED',
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  UNAVAILABLE: 'UNAVAILABLE',
  FAILED: 'FAILED',
});

export const DIMENSION_CODES = Object.freeze({
  COMMERCIAL: 'commercial',
  ENGAGEMENT: 'engagement',
  MRA_EIS: 'mraEis',
  RELATIONSHIP: 'relationship',
  ADOPTION: 'adoption',
  SUPPORT: 'support',
  ONBOARDING: 'onboarding',
  TRAINING: 'training',
  NPS: 'nps',
});

/** v1 base weights (before renormalise). Only these enter the score set. */
export const V1_BASE_WEIGHTS = Object.freeze({
  [DIMENSION_CODES.COMMERCIAL]: 0.35,
  [DIMENSION_CODES.ENGAGEMENT]: 0.25,
  [DIMENSION_CODES.MRA_EIS]: 0.2,
  [DIMENSION_CODES.RELATIONSHIP]: 0.2,
});

/** Future / not-instrumented dims — never scored as 0. */
export const V1_NA_DIMENSIONS = Object.freeze([
  DIMENSION_CODES.ADOPTION,
  DIMENSION_CODES.SUPPORT,
  DIMENSION_CODES.ONBOARDING,
  DIMENSION_CODES.TRAINING,
  DIMENSION_CODES.NPS,
]);

export const HEALTH_BANDS = Object.freeze({
  HEALTHY: 'HEALTHY',
  STABLE: 'STABLE',
  NEEDS_ATTENTION: 'NEEDS_ATTENTION',
  AT_RISK: 'AT_RISK',
  CRITICAL: 'CRITICAL',
  UNKNOWN: 'UNKNOWN',
});

/** Inclusive ranges; UNKNOWN when score is null. */
export const BAND_RANGES = Object.freeze({
  [HEALTH_BANDS.HEALTHY]: { min: 80, max: 100 },
  [HEALTH_BANDS.STABLE]: { min: 65, max: 79 },
  [HEALTH_BANDS.NEEDS_ATTENTION]: { min: 50, max: 64 },
  [HEALTH_BANDS.AT_RISK]: { min: 35, max: 49 },
  [HEALTH_BANDS.CRITICAL]: { min: 0, max: 34 },
});

export const HEALTH_CONFIDENCE = Object.freeze({
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
  INSUFFICIENT: 'INSUFFICIENT',
});

/** Minimum SCORED dimensions required for a non-null overall score. */
export const MIN_SCORED_DIMENSIONS = 2;

export const OVERRIDE_CODES = Object.freeze({
  SUSPENDED_OR_CANCELLED: 'SUSPENDED_OR_CANCELLED',
  SEVERE_OUTSTANDING: 'SEVERE_OUTSTANDING',
  SEVERE_OUTSTANDING_CRITICAL: 'SEVERE_OUTSTANDING_CRITICAL',
  EIS_REVOKED: 'EIS_REVOKED',
});

export const HEALTH_CATALOGUE_NOTES = Object.freeze([
  'Explainable health score 0–100 with separate confidence — not churn or renewal probability.',
  'Missing dimensions use EXCLUDE_AND_RENORMALISE; never score missing as 0.',
  'Adoption / support / onboarding / training / NPS are NOT_APPLICABLE until instrumented.',
  'Platform billing only — never Tenant Sale / Tenant GL.',
]);
