/**
 * Phase 19 Wave 1–3 — Customer Adoption catalogue.
 * Training COMPLETED → Request; handover attach ≠ invent COMPLETED.
 * Wave 2: milestones / value / Phase 9 evidence / Plan completion.
 * Wave 3: champions / dormancy / Phase 8 intervention links / expansion handoffs.
 * Wave 4: UI hubs / metrics / DQ / recon / lineage / Phase 8 Success Plan link / Phase 20 pack.
 */

import { CRM_NUMBER_PREFIX } from '../../crm/catalogue.js';

export const ADOPTION_REQUEST_NUMBER_RE = /^ADR-\d{4}-\d{6}$/;
export const ADOPTION_PLAN_NUMBER_RE = /^ADP-\d{4}-\d{6}$/;

export const ADOPTION_REQUEST_SOURCE = Object.freeze({
  PHASE_18_TRAINING_COMPLETED: 'PHASE_18_TRAINING_COMPLETED',
  PHASE_17_ONBOARDING_HANDOVER: 'PHASE_17_ONBOARDING_HANDOVER',
  CUSTOMER_SUCCESS_MANUAL: 'CUSTOMER_SUCCESS_MANUAL',
  SUPPORT_RECOMMENDATION: 'SUPPORT_RECOMMENDATION',
  PRODUCT_SIGNAL: 'PRODUCT_SIGNAL',
  DORMANCY_RECOVERY: 'DORMANCY_RECOVERY',
  EXPANSION_SIGNAL: 'EXPANSION_SIGNAL',
  PLAN_UPGRADE: 'PLAN_UPGRADE',
  ADD_ON_ACTIVATION: 'ADD_ON_ACTIVATION',
  LEGACY_MIGRATION: 'LEGACY_MIGRATION',
  API: 'API',
  OTHER: 'OTHER',
});

export const ADOPTION_REQUEST_STATUS = Object.freeze({
  NEW: 'NEW',
  VALIDATING: 'VALIDATING',
  INFORMATION_REQUIRED: 'INFORMATION_REQUIRED',
  DUPLICATE_REVIEW_REQUIRED: 'DUPLICATE_REVIEW_REQUIRED',
  READY: 'READY',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  CONVERTED_TO_PLAN: 'CONVERTED_TO_PLAN',
  CUSTOMER_DEFERRED: 'CUSTOMER_DEFERRED',
  CANCELLED: 'CANCELLED',
  SUPERSEDED: 'SUPERSEDED',
  ARCHIVED: 'ARCHIVED',
});

export const ADOPTION_REQUEST_STATUSES = Object.freeze(
  Object.values(ADOPTION_REQUEST_STATUS)
);

export const ADOPTION_PLAN_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  VALUE_REVIEW: 'VALUE_REVIEW',
  COMPLETED: 'COMPLETED',
  CHURN_RISK: 'CHURN_RISK',
  HANDED_TO_RENEWALS: 'HANDED_TO_RENEWALS',
  CANCELLED: 'CANCELLED',
  ARCHIVED: 'ARCHIVED',
});

export const ADOPTION_PLAN_STATUSES = Object.freeze(Object.values(ADOPTION_PLAN_STATUS));

export const ADOPTION_TEMPLATE_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  RETIRED: 'RETIRED',
});

export const WAVE1_DEFAULT_PLAN_TEMPLATE_CODE = 'CUSTOMER_ADOPTION_DEFAULT_WAVE1';

export const ADOPTION_COMPLETION_POLICY_REQUIRED = 'COMPLETION_POLICY_REQUIRED';
export const ADOPTION_HANDOFF_POLICY_REQUIRED = 'HANDOFF_POLICY_REQUIRED';

export const ADOPTION_MILESTONE_STATUS = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_PROGRESS: 'IN_PROGRESS',
  MET: 'MET',
  MISSED: 'MISSED',
  WAIVED: 'WAIVED',
  UNKNOWN: 'UNKNOWN',
});

export const ADOPTION_MILESTONE_STATUSES = Object.freeze(
  Object.values(ADOPTION_MILESTONE_STATUS)
);

export const ADOPTION_EVIDENCE_MODE = Object.freeze({
  PRODUCT_ANALYTICS: 'PRODUCT_ANALYTICS',
  TRAINING_CERT: 'TRAINING_CERT',
  CS_ATTESTATION: 'CS_ATTESTATION',
  MIXED: 'MIXED',
});

export const ADOPTION_EVIDENCE_STATUS = Object.freeze({
  READY: 'READY',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
  MET: 'MET',
});

export const ADOPTION_VALUE_OUTCOME_STATUS = Object.freeze({
  READY: 'READY',
  UNAVAILABLE: 'UNAVAILABLE',
  UNKNOWN: 'UNKNOWN',
});

export const ADOPTION_VALUE_OUTCOME_TYPE = Object.freeze({
  TIME_TO_FIRST_VALUE: 'TIME_TO_FIRST_VALUE',
  FEATURE_ACTIVATION_SET: 'FEATURE_ACTIVATION_SET',
  REPEAT_VALUE_SIGNAL: 'REPEAT_VALUE_SIGNAL',
});

export const ADOPTION_VALUE_REVIEW_STATE = Object.freeze({
  NOT_STARTED: 'NOT_STARTED',
  IN_REVIEW: 'IN_REVIEW',
  SIGNED_OFF: 'SIGNED_OFF',
});

export const ADOPTION_HEALTH_STATUS = Object.freeze({
  NOT_ENOUGH_DATA: 'NOT_ENOUGH_DATA',
  ON_TRACK: 'ON_TRACK',
  AT_RISK: 'AT_RISK',
  WATCH: 'WATCH',
  UNKNOWN: 'UNKNOWN',
});

export const ADOPTION_HEALTH_RULES_VERSION = 'adoption-health-2026-07-31';

export const ADOPTION_CHAMPION_ENABLEMENT_STATUS = Object.freeze({
  IDENTIFIED: 'IDENTIFIED',
  ENABLED: 'ENABLED',
  ACTIVE: 'ACTIVE',
  NEEDS_ENABLEMENT: 'NEEDS_ENABLEMENT',
  INACTIVE: 'INACTIVE',
});

export const ADOPTION_DORMANCY_STATUS = Object.freeze({
  OPEN: 'OPEN',
  INTERVENTION_LINKED: 'INTERVENTION_LINKED',
  MONITORING: 'MONITORING',
  RECOVERED: 'RECOVERED',
  ESCALATED: 'ESCALATED',
  CLOSED_UNRESOLVED: 'CLOSED_UNRESOLVED',
});

export const ADOPTION_DORMANCY_STATUSES = Object.freeze(
  Object.values(ADOPTION_DORMANCY_STATUS)
);

export const ADOPTION_DORMANCY_RECOVERED_EVIDENCE_REQUIRED =
  'RECOVERED_EVIDENCE_REQUIRED';

export const ADOPTION_EXPANSION_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  HANDED_OFF: 'HANDED_OFF',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
});

export const ADOPTION_EXPANSION_STATUSES = Object.freeze(
  Object.values(ADOPTION_EXPANSION_STATUS)
);

export const ADOPTION_EXPANSION_TARGET_QUEUE = Object.freeze({
  RENEWALS: 'RENEWALS',
  SALES: 'SALES',
  CS_LEADERSHIP: 'CS_LEADERSHIP',
});

/** Default Wave 2 milestone defs seeded into pinned template contentJson. */
export const WAVE2_DEFAULT_MILESTONE_DEFS = Object.freeze([
  {
    key: 'first_value_analytics',
    roleTarget: 'OWNER',
    evidenceMode: 'PRODUCT_ANALYTICS',
    critical: true,
    featureCode: 'invoices.post',
    metricCode: 'product.feature.invoices.post.count',
  },
  {
    key: 'training_cert_complete',
    roleTarget: 'ADMIN',
    evidenceMode: 'TRAINING_CERT',
    critical: true,
    requireProgramCompleted: true,
  },
  {
    key: 'cs_attestation_champion',
    roleTarget: 'CHAMPION',
    evidenceMode: 'CS_ATTESTATION',
    critical: true,
  },
  {
    key: 'mixed_activation',
    roleTarget: 'ACCOUNTANT',
    evidenceMode: 'MIXED',
    critical: false,
    requiredModes: ['PRODUCT_ANALYTICS', 'CS_ATTESTATION'],
    featureCode: 'invoices.post',
    metricCode: 'product.feature.invoices.post.count',
  },
]);

export const ADOPTION_DOMAIN_CONTRACT = Object.freeze({
  surface: '/insightbooks/customer-success/adoption',
  phase: 19,
  wave: 4,
  autoRequestRequiresTrainingCompleted: true,
  completedWithGapsCreatesRequestForbidden: true,
  handoverAttachInventTrainingCompletedForbidden: true,
  fabricateMilestoneMetForbidden: true,
  fabricatePlanCompletedForbidden: true,
  fabricateEngagementScoreForbidden: true,
  dormancyRecoveredWithoutEvidenceForbidden: true,
  expansionMutatesBillingForbidden: true,
  tenantGlForbidden: true,
  milestonesDeferred: false,
  valueOutcomesDeferred: false,
  championsDeferred: false,
  dormancyDeferred: false,
  expansionHandoffsDeferred: false,
  phase9EvidenceReadOnly: true,
  phase9SignalsReadOnly: true,
  phase8InterventionLinkOnly: true,
  planCompletedRequiresCriticalMilestonesAndValueReview: true,
});

export function getAdoptionDomainContract() {
  return { ...ADOPTION_DOMAIN_CONTRACT };
}

export { CRM_NUMBER_PREFIX };
