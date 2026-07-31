/**
 * Scoring catalogue — Phase 11 Wave 3.
 * Deterministic 0–100. Never label as probability / conversion chance / expected revenue.
 */

export {
  CRM_SCORE_CONFIDENCE,
  CRM_SCORE_CONFIDENCES,
  CRM_SCORE_BAND,
  CRM_SCORE_BANDS,
  CRM_DEFAULT_SCORE_VERSION_ID,
  CRM_SCORE_FORBIDDEN_LABELS,
} from '../catalogue.js';

/**
 * Default ACTIVE score definition with explicit weights.
 * Historical evaluations pin this versionId and stay immutable when definition changes.
 */
export function getDefaultScoreDefinition() {
  return Object.freeze({
    key: 'LEAD_FIT_STANDARD',
    name: 'Lead fit score (deterministic)',
    versionId: 'score-lead-fit-v1',
    status: 'ACTIVE',
    /** API/UI label — never probability */
    displayLabel: 'Lead fit score',
    dimensions: Object.freeze([
      Object.freeze({
        key: 'ENGAGEMENT',
        label: 'Engagement signals',
        weight: 30,
        maxPoints: 30,
      }),
      Object.freeze({
        key: 'FIT',
        label: 'Segment / need fit',
        weight: 30,
        maxPoints: 30,
      }),
      Object.freeze({
        key: 'AUTHORITY',
        label: 'Authority proximity',
        weight: 20,
        maxPoints: 20,
      }),
      Object.freeze({
        key: 'TIMELINE',
        label: 'Timeline urgency',
        weight: 20,
        maxPoints: 20,
      }),
    ]),
    bands: Object.freeze([
      Object.freeze({ band: 'COLD', min: 0, max: 39 }),
      Object.freeze({ band: 'WARM', min: 40, max: 69 }),
      Object.freeze({ band: 'HOT', min: 70, max: 100 }),
    ]),
    criticalCaps: Object.freeze([
      Object.freeze({ key: 'DO_NOT_CONTACT', capScore: 0, band: 'BLOCKED' }),
      Object.freeze({ key: 'SPAM', capScore: 0, band: 'BLOCKED' }),
      Object.freeze({ key: 'COMPLIANCE_BLOCK', capScore: 0, band: 'BLOCKED' }),
    ]),
  });
}
