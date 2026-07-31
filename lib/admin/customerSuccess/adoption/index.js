/**
 * Phase 19 Wave 1–4 — Customer Adoption public surface.
 */

export {
  ADOPTION_REQUEST_NUMBER_RE,
  ADOPTION_PLAN_NUMBER_RE,
  ADOPTION_REQUEST_SOURCE,
  ADOPTION_REQUEST_STATUS,
  ADOPTION_REQUEST_STATUSES,
  ADOPTION_PLAN_STATUS,
  ADOPTION_PLAN_STATUSES,
  ADOPTION_TEMPLATE_STATUS,
  WAVE1_DEFAULT_PLAN_TEMPLATE_CODE,
  WAVE2_DEFAULT_MILESTONE_DEFS,
  ADOPTION_COMPLETION_POLICY_REQUIRED,
  ADOPTION_HANDOFF_POLICY_REQUIRED,
  ADOPTION_MILESTONE_STATUS,
  ADOPTION_MILESTONE_STATUSES,
  ADOPTION_EVIDENCE_MODE,
  ADOPTION_EVIDENCE_STATUS,
  ADOPTION_VALUE_OUTCOME_STATUS,
  ADOPTION_VALUE_OUTCOME_TYPE,
  ADOPTION_VALUE_REVIEW_STATE,
  ADOPTION_HEALTH_STATUS,
  ADOPTION_HEALTH_RULES_VERSION,
  ADOPTION_CHAMPION_ENABLEMENT_STATUS,
  ADOPTION_DORMANCY_STATUS,
  ADOPTION_DORMANCY_STATUSES,
  ADOPTION_DORMANCY_RECOVERED_EVIDENCE_REQUIRED,
  ADOPTION_EXPANSION_STATUS,
  ADOPTION_EXPANSION_STATUSES,
  ADOPTION_EXPANSION_TARGET_QUEUE,
  ADOPTION_DOMAIN_CONTRACT,
  getAdoptionDomainContract,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';

export {
  allocateAdoptionRequestNumber,
  allocateAdoptionPlanNumber,
  formatCrmNumber,
  utcYearOf,
} from './numbering.js';

export {
  hasCustomerAdoptionRequestModel,
  hasCustomerAdoptionRequestStatusHistoryModel,
  hasCustomerAdoptionPlanModel,
  hasCustomerAdoptionPlanStatusHistoryModel,
  hasCustomerAdoptionPlanTemplateModel,
  hasCustomerAdoptionPlanTemplateVersionModel,
  hasCustomerAdoptionMilestoneModel,
  hasCustomerAdoptionEvidenceSnapshotModel,
  hasCustomerAdoptionValueOutcomeModel,
  hasCustomerAdoptionChampionModel,
  hasCustomerAdoptionDormancyCaseModel,
  hasCustomerAdoptionInterventionLinkModel,
  hasCustomerAdoptionExpansionHandoffModel,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingCertificateModel,
  hasCsInterventionModel,
  hasCrmContactModel,
  resolveAdoptionActor,
  canManageAdoption,
  canViewAdoption,
  serializeAdoptionRequest,
  serializeAdoptionPlan,
  serializeAdoptionPlanTemplateVersion,
  serializeAdoptionMilestone,
  serializeAdoptionEvidenceSnapshot,
  serializeAdoptionValueOutcome,
  serializeAdoptionChampion,
  serializeAdoptionDormancyCase,
  serializeAdoptionInterventionLink,
  serializeAdoptionExpansionHandoff,
} from './model.js';

export {
  ADOPTION_PERMISSION_NOTES,
  assertCanManageAdoption,
  assertCanViewAdoption,
} from './permissions.js';

export {
  canTransitionAdoptionRequestStatus,
  canTransitionAdoptionPlanStatus,
  assertCanTransitionAdoptionRequestStatus,
  assertCanTransitionAdoptionPlanStatus,
  transitionAdoptionRequestStatus,
  transitionAdoptionPlanStatus,
} from './status.js';

export { evaluateAdoptionPlanCompletion } from './completion.js';

export {
  requestMissingPins,
  createAdoptionRequest,
  createManualAdoptionRequest,
  validateAdoptionRequest,
  acceptAdoptionRequest,
  rejectAdoptionRequest,
  listAdoptionRequests,
  loadAdoptionRequest,
} from './requests.js';

export {
  ensureWave1DefaultPlanTemplateVersion,
  createCustomerAdoptionPlan,
  listAdoptionPlans,
} from './plans.js';

export { consumeTrainingCompletionForAdoption } from './trainingConsume.js';

export { attachOnboardingHandoverToAdoption } from './handoverAttach.js';

export {
  resolveAdoptionListScope,
  tenantWhereFromScope,
  assertAdoptionTenantInScope,
} from './listScope.js';

export {
  loadAdoptionPlanForActor,
  loadAdoptionRequestForActor,
  resolveActorTenantId,
} from './planAccess.js';

export {
  materialiseAdoptionMilestones,
  evaluateAdoptionMilestone,
  attestAdoptionMilestone,
  waiveAdoptionMilestone,
  listAdoptionMilestones,
} from './milestones.js';

export {
  resolveProductAnalyticsEvidence,
  resolveTrainingCertEvidence,
  readPhase9ProductEvidence,
  captureAdoptionEvidenceSnapshot,
  persistEvidenceSnapshot,
} from './evidence.js';

export {
  recordAdoptionValueOutcome,
  signOffAdoptionValueReview,
  listAdoptionValueOutcomes,
} from './valueOutcomes.js';

export { calculateAdoptionHealth } from './health.js';

export { upsertAdoptionChampion, listAdoptionChampions } from './champions.js';

export {
  listDormancyRiskQueue,
  openDormancyRecoveryCase,
  attestDormancyOutcome,
} from './dormancy.js';

export { linkPhase8Intervention } from './interventions.js';

export {
  createExpansionHandoff,
  acknowledgeExpansionHandoff,
  listExpansionHandoffs,
} from './expansion.js';

/* Wave 4 */

export {
  applyAdoptionReportHonesty,
  safeAdoptionCount,
  gatedMetricCard,
  ADOPTION_REPORT_STATUS,
} from './reliabilityGate.js';

export {
  getAdoptionMetric,
  getAdoptionOverviewCards,
  ADOPTION_METRIC_VERSION,
} from './metrics.js';

export { getAdoptionMyWork } from './myWork.js';

export {
  listAdoptionReports,
  getAdoptionReport,
  ADOPTION_REPORT_CATALOGUE,
  ADOPTION_REPORT_VERSION,
} from './reports.js';

export { exportAdoptionReport } from './exports.js';

export { runAdoptionDataQuality, ADOPTION_DQ_VERSION } from './dataQuality.js';

export {
  runAdoptionReconciliation,
  ADOPTION_RECON_VERSION,
} from './reconciliation.js';

export { getAdoptionLineage } from './lineage.js';

export { searchAdoptionIndex } from './search.js';

export {
  ADOPTION_CACHE_KEYS,
  buildAdoptionCacheKey,
} from './cache.js';

export {
  ADOPTION_HUB_ROUTES,
  ADOPTION_PERMISSION_NOTES_WAVE4,
  ADOPTION_SEARCH_KEYS,
} from './hubKeys.js';

export {
  migratePhase8SuccessPlans,
  getFoundationStatusWithPlan,
} from './phase8Migrate.js';
