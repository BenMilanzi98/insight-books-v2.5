/**
 * Health confidence — independent of score band.
 */

import {
  DIMENSION_STATUS,
  HEALTH_CONFIDENCE,
  MIN_SCORED_DIMENSIONS,
} from './catalogue.js';

/**
 * @param {Array<{ status: string, code?: string, facts?: object }>} dimensions
 * @param {{ minScored?: number }} [opts]
 * @returns {{ confidence: string, reasons: string[] }}
 */
export function resolveHealthConfidence(dimensions, opts = {}) {
  const minScored = opts.minScored ?? MIN_SCORED_DIMENSIONS;
  const reasons = [];
  const list = Array.isArray(dimensions) ? dimensions : [];

  const scored = list.filter((d) => d.status === DIMENSION_STATUS.SCORED);
  const failed = list.filter((d) => d.status === DIMENSION_STATUS.FAILED);
  const unavailable = list.filter((d) => d.status === DIMENSION_STATUS.UNAVAILABLE);
  const na = list.filter((d) => d.status === DIMENSION_STATUS.NOT_APPLICABLE);

  if (scored.length < minScored) {
    reasons.push(`Fewer than ${minScored} SCORED dimensions (${scored.length})`);
    return { confidence: HEALTH_CONFIDENCE.INSUFFICIENT, reasons };
  }

  if (failed.length > 0) {
    reasons.push(`${failed.length} dimension(s) FAILED`);
    return { confidence: HEALTH_CONFIDENCE.LOW, reasons };
  }

  if (unavailable.length > 0) {
    reasons.push(`${unavailable.length} dimension(s) UNAVAILABLE`);
    return { confidence: HEALTH_CONFIDENCE.LOW, reasons };
  }

  const signalsEphemeral = scored.some((d) => d.facts?.signalsEphemeral);
  if (signalsEphemeral) {
    reasons.push('Relationship scored with ephemeral/unavailable signals');
  }

  if (na.filter((d) => ['commercial', 'engagement', 'mraEis', 'relationship'].includes(d.code)).length) {
    reasons.push('One or more v1 base dimensions NOT_APPLICABLE (renormalised)');
  }

  if (signalsEphemeral || na.some((d) => d.code === 'mraEis')) {
    reasons.push('MEDIUM — partial evidence / limitations');
    return { confidence: HEALTH_CONFIDENCE.MEDIUM, reasons };
  }

  reasons.push('All applicable v1 base dimensions SCORED');
  return { confidence: HEALTH_CONFIDENCE.HIGH, reasons };
}
