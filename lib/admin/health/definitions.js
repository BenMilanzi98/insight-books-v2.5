/**
 * Active health definition loader — code default + optional DB row.
 */

import {
  BAND_RANGES,
  HEALTH_DEFINITION_VERSION,
  MISSING_POLICY,
  OVERRIDE_CODES,
  V1_BASE_WEIGHTS,
  MIN_SCORED_DIMENSIONS,
} from './catalogue.js';

/**
 * Built-in v1 definition (HEALTH_DEFINITION_MATRIX.md).
 */
export function builtInHealthDefinition() {
  return {
    version: HEALTH_DEFINITION_VERSION,
    weights: { ...V1_BASE_WEIGHTS },
    bands: {
      HEALTHY: { ...BAND_RANGES.HEALTHY },
      STABLE: { ...BAND_RANGES.STABLE },
      NEEDS_ATTENTION: { ...BAND_RANGES.NEEDS_ATTENTION },
      AT_RISK: { ...BAND_RANGES.AT_RISK },
      CRITICAL: { ...BAND_RANGES.CRITICAL },
    },
    overrides: {
      [OVERRIDE_CODES.SUSPENDED_OR_CANCELLED]: { forceBand: 'CRITICAL' },
      [OVERRIDE_CODES.SEVERE_OUTSTANDING]: { capBand: 'AT_RISK' },
      [OVERRIDE_CODES.SEVERE_OUTSTANDING_CRITICAL]: {
        forceBand: 'CRITICAL',
        /** Outstanding ≥ this multiple of MRR (or absolute floor) → CRITICAL */
        mrrMultiple: 3,
        absoluteFloor: 50000,
      },
      [OVERRIDE_CODES.EIS_REVOKED]: { forceBand: 'CRITICAL' },
    },
    missingPolicy: MISSING_POLICY.EXCLUDE_AND_RENORMALISE,
    minScoredDimensions: MIN_SCORED_DIMENSIONS,
    source: 'builtin',
  };
}

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ definitionVersion?: string }} [opts]
 */
export async function getActiveHealthDefinition(prisma, opts = {}) {
  const builtin = builtInHealthDefinition();
  const wantVersion = opts.definitionVersion || null;

  if (typeof prisma?.customerHealthDefinition?.findFirst !== 'function') {
    if (wantVersion && wantVersion !== builtin.version) {
      return { ...builtin, requestedVersion: wantVersion, source: 'builtin_fallback' };
    }
    return builtin;
  }

  try {
    let row = null;
    if (wantVersion) {
      row = await prisma.customerHealthDefinition.findFirst({
        where: { version: wantVersion },
      });
    } else {
      row = await prisma.customerHealthDefinition.findFirst({
        where: { isActive: true },
        orderBy: { activatedAt: 'desc' },
      });
    }

    if (!row) {
      if (wantVersion && wantVersion !== builtin.version) {
        return { ...builtin, requestedVersion: wantVersion, source: 'builtin_fallback' };
      }
      return builtin;
    }

    const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload || {};
    return {
      version: row.version || builtin.version,
      weights: payload.weights || builtin.weights,
      bands: payload.bands || builtin.bands,
      overrides: payload.overrides || builtin.overrides,
      missingPolicy: payload.missingPolicy || builtin.missingPolicy,
      minScoredDimensions: payload.minScoredDimensions ?? builtin.minScoredDimensions,
      source: 'CustomerHealthDefinition',
      definitionId: row.id,
    };
  } catch {
    return builtin;
  }
}

/**
 * Map numeric score → band (inclusive ranges). null → UNKNOWN.
 * @param {number|null|undefined} score
 * @param {object} [bands] — from definition
 */
export function bandForScore(score, bands = BAND_RANGES) {
  if (score == null || !Number.isFinite(Number(score))) return 'UNKNOWN';
  const s = Number(score);
  const order = ['HEALTHY', 'STABLE', 'NEEDS_ATTENTION', 'AT_RISK', 'CRITICAL'];
  for (const key of order) {
    const r = bands[key] || BAND_RANGES[key];
    if (!r) continue;
    if (s >= r.min && s <= r.max) return key;
  }
  if (s > 100) return 'HEALTHY';
  if (s < 0) return 'CRITICAL';
  return 'UNKNOWN';
}
