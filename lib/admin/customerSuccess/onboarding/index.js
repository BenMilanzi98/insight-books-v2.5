/**

 * Phase 17 Wave 1–4 — Customer Onboarding public surface.

 */



export {

  ONBOARDING_REQUEST_NUMBER_RE,

  ONBOARDING_PROJECT_NUMBER_RE,

  ONBOARDING_REQUEST_SOURCE,

  ONBOARDING_REQUEST_STATUS,

  ONBOARDING_REQUEST_STATUSES,

  ONBOARDING_TYPE,

  ONBOARDING_PROJECT_STATUS,

  GO_LIVE_DECISION,

  PHASE22_TRAINING_HANDOFF_STATUS,

  ONBOARDING_TEMPLATE_STATUS,

  ONBOARDING_TASK_ACTOR_TYPE,

  ONBOARDING_TASK_STATUS,

  ONBOARDING_EVIDENCE_STATUS,

  ONBOARDING_DEPENDENCY_TYPE,

  ONBOARDING_RESPONSIBILITY_PARTY,

  ONBOARDING_CHANGE_REQUEST_REASON,

  ONBOARDING_READINESS_STATUS,

  ONBOARDING_HANDOFF_VALIDATION_STATUS,

  WAVE1_STANDARD_TEMPLATE_CODE,

  CUSTOMER_PORTAL_NOT_CONFIGURED,

  MEETING_SERVICE_UNAVAILABLE,

  ONBOARDING_DOMAIN_CONTRACT,

  getOnboardingDomainContract,

  CRM_NUMBER_PREFIX,

} from './catalogue.js';



export {

  CRM_MEETING_RSVP,

  CRM_MEETING_ATTENDANCE,

} from './kickoff.js';



export {

  allocateOnboardingRequestNumber,

  allocateOnboardingProjectNumber,

  formatCrmNumber,

  utcYearOf,

} from './numbering.js';



export {

  hasCustomerOnboardingRequestModel,

  hasCustomerOnboardingRequestStatusHistoryModel,

  hasCustomerOnboardingProjectModel,

  hasCustomerOnboardingProjectStatusHistoryModel,

  hasCustomerOnboardingTemplateVersionModel,

  hasCustomerOnboardingTemplateModel,

  hasCustomerOnboardingMaterialisationModel,

  hasCustomerOnboardingWorkstreamModel,

  hasCustomerOnboardingMilestoneModel,

  hasCustomerOnboardingTaskModel,

  hasCustomerOnboardingChecklistModel,

  hasCustomerOnboardingKickoffModel,

  hasCustomerOnboardingStakeholderModel,

  hasCustomerOnboardingRequirementModel,

  hasCustomerOnboardingScopeItemModel,

  hasCustomerOnboardingChangeRequestModel,

  hasCustomerOnboardingTaskEvidenceModel,

  hasCustomerOnboardingTaskDependencyModel,

  hasCustomerOnboardingResponsibilityModel,

  hasCustomerOnboardingReadinessEvaluationModel,

  hasCustomerOnboardingMigrationModel,

  hasCustomerOnboardingMraEisModel,

  hasCustomerOnboardingTrainingModel,

  hasCustomerOnboardingDefectModel,

  hasCustomerOnboardingTestPlanModel,

  hasCustomerOnboardingGoLiveModel,

  hasCustomerOnboardingGoLiveApprovalModel,

  hasCustomerOnboardingStabilisationModel,

  hasCustomerOnboardingHandoverModel,

  hasCustomerOnboardingCompletionModel,

  hasCustomerOnboardingCompletionCertificateModel,

  resolveOnboardingActor,

  canManageOnboarding,

  canViewOnboarding,

  serializeOnboardingRequest,

  serializeOnboardingProject,

  serializeOnboardingTemplateVersion,

  serializeOnboardingMaterialisation,

  serializeOnboardingWorkstream,

  serializeOnboardingMilestone,

  serializeOnboardingTask,

  serializeOnboardingKickoff,

  serializeOnboardingStakeholder,

  serializeOnboardingRequirement,

  serializeOnboardingChangeRequest,

  serializeOnboardingTaskEvidence,

  serializeOnboardingTaskDependency,

  serializeOnboardingResponsibility,

  serializeOnboardingReadinessEvaluation,

  serializeOnboardingMigration,

  serializeOnboardingMraEis,

  serializeOnboardingTraining,

  serializeOnboardingDefect,

  serializeOnboardingTestPlan,

  serializeOnboardingGoLive,

  serializeOnboardingGoLiveApproval,

  serializeOnboardingStabilisation,

  serializeOnboardingHandover,

  serializeOnboardingCompletion,

  serializeOnboardingCompletionCertificate,

} from './model.js';



export {

  canTransitionOnboardingRequestStatus,

  canTransitionOnboardingProjectStatus,

  assertCanTransitionOnboardingRequestStatus,

  assertCanTransitionOnboardingProjectStatus,

  transitionOnboardingRequestStatus,

  transitionOnboardingProjectStatus,

} from './status.js';



export {

  createOnboardingRequest,

  validateOnboardingRequest,

  acceptOnboardingRequest,

  rejectOnboardingRequest,

  listOnboardingRequests,

  loadOnboardingRequest,

  requestMissingPins,

} from './requests.js';



export {

  createOnboardingProject,

  listOnboardingProjects,

} from './projects.js';



export {

  consumeOnboardingHandoff,

  acknowledgeOnboardingHandoffInProgress,

  evaluateOnboardingHandoffChecksum,

  validateOnboardingHandoff,

  acceptOnboardingHandoff,

} from './handoffConsume.js';



export { ensureWave1StandardTemplateVersion } from './templates.js';



export {

  approveOnboardingTemplateVersion,

  activateOnboardingTemplateVersion,

} from './templateVersions.js';



export { materialiseOnboardingTemplate } from './materialise.js';



export {

  scheduleOnboardingKickoff,

  recordOnboardingKickoffRsvp,

} from './kickoff.js';



export { assignOnboardingStakeholder } from './stakeholders.js';



export { confirmOnboardingRequirements } from './requirements.js';



export { detectScopeMismatch } from './scope.js';



export { createOnboardingChangeRequest } from './changeRequests.js';



export { listOnboardingWorkstreams } from './workstreams.js';



export { listOnboardingMilestones } from './milestones.js';



export {

  createOnboardingTask,

  completeOnboardingTask,

} from './tasks.js';



export {

  submitCustomerTaskEvidence,

  reviewCustomerTaskEvidence,

} from './evidence.js';



export { assignOnboardingResponsibility } from './responsibilities.js';



export { addOnboardingTaskDependency } from './dependencies.js';



/* Wave 3 */

export {
  evaluateOnboardingReadiness,
  READINESS_STATUS,
  isGoLiveReadinessAllowed,
} from './readiness/evaluate.js';

export { evaluateTenantReadiness } from './readiness/tenant.js';

export { evaluateBusinessBranchReadiness } from './readiness/businessBranch.js';

export {
  evaluateUsersReadiness,
  refusePlatformSuperAdminViaOnboarding,
  refuseOnboardingUserMint,
} from './readiness/users.js';

export { evaluateConfigurationReadiness } from './readiness/configuration.js';

export { evaluateAccountingReadiness } from './readiness/accounting.js';

export {
  evaluateProvisioningReadiness,
  assertNoFabricatedTenantIdentity,
  refuseOnboardingTenantMint,
} from './readiness/provisioning.js';

export { evaluateSubscriptionReadiness } from './readiness/subscription.js';

export {
  evaluateEntitlementReadiness,
  refuseEntitlementMutationFromOnboarding,
} from './readiness/entitlement.js';

export {
  evaluateIntegrationReadiness,
  redactIntegrationSecrets,
} from './readiness/integration.js';



export {
  setMigrationCoordinationStatus,
  runOnboardingBrowserImport,
  assertMigrationCoordinationOnly,
  MIGRATION_STATUS,
} from './migration.js';

export { setMraEisCoordinationStatus, MRA_EIS_STATUS } from './mraEis.js';

export {

  setTrainingCoordinationStatus,

  TRAINING_COORD_STATUS,

  emitPhase22TrainingHandoff,

  computePhase22TrainingHandoffChecksum,

  refusePhase22TrainingDelivery,

} from './training.js';

export { upsertOnboardingTestPlan } from './testing.js';

export {

  recordOnboardingDefect,

  listOpenCriticalDefects,

  listOpenBlockingDefects,

  DEFECT_SEVERITY,

} from './defects.js';



export {

  approveGoLive,

  recordGoLiveDecision,

  scheduleGoLive,

  executeGoLive,

  recordGoLiveOutcome,

} from './goLive.js';



export {

  recordCutoverCoordination,

  assertCutoverDistinctFromGoLiveSuccess,

} from './cutover.js';



export {

  recordStabilisationCheck,

  approveStabilisationExit,

} from './stabilisation.js';



export {

  createOnboardingHandover,

  acceptOnboardingHandover,

  computeOnboardingHandoverChecksum,

  assertHandoverDoesNotOverwriteCustomerHealth,

} from './handover.js';



export {

  evaluateOnboardingCompletion,

  issueCompletionCertificate,

  computeOnboardingCompletionChecksum,

} from './completion.js';



export {

  calculateOnboardingProgress,

  PROGRESS_RULES_VERSION,

} from './progress.js';



export {

  calculateOnboardingHealth,

  HEALTH_RULES_VERSION,

  ONBOARDING_HEALTH_STATUS,

} from './health.js';



export {

  assertOnboardingAccountingBoundary,

  assertNoOnboardingAccountingCreate,

  assertGovernedAccountingOnly,

  createOnboardingJournalEntry,

  editOnboardingAccountBalance,

  administerOnboardingSystemCoa,

} from './accountingBoundary.js';



export {
  loadOnboardingProjectForActor,
  resolveActorTenantId,
  assertOnboardingTenantInPortfolioScope,
} from './projectAccess.js';
export {
  resolveOnboardingListScope,
  tenantWhereFromScope,
} from './listScope.js';

/* Wave 4 */

export {
  applyOnboardingReportHonesty,
  safeOnboardingCount,
  gatedMetricCard,
  ONBOARDING_REPORT_STATUS,
} from './reliabilityGate.js';

export {
  getOnboardingMetric,
  getOnboardingOverviewCards,
  ONBOARDING_METRIC_VERSION,
} from './metrics.js';

export { getOnboardingMyWork } from './myWork.js';

export {
  listOnboardingReports,
  getOnboardingReport,
  ONBOARDING_REPORT_CATALOGUE,
  ONBOARDING_REPORT_VERSION,
} from './reports.js';

export { exportOnboardingReport } from './exports.js';

export {
  getOnboardingStatusLabelHonesty,
  ONBOARDING_STATUS_LABEL,
} from './honestyLabels.js';

export { runOnboardingDataQuality, ONBOARDING_DQ_VERSION } from './dataQuality.js';

export {
  runOnboardingReconciliation,
  ONBOARDING_RECON_VERSION,
} from './reconciliation.js';

export { getOnboardingLineage } from './lineage.js';

export { searchOnboardingIndex } from './search.js';

export {
  ONBOARDING_CACHE_KEYS,
  buildOnboardingCacheKey,
} from './cache.js';

export {
  getOnboardingNotificationContract,
  enqueueOnboardingNotification,
  ONBOARDING_NOTIFICATIONS_STATUS,
} from './notifications.js';

export {
  ONBOARDING_HUB_ROUTES,
  ONBOARDING_PERMISSION_NOTES,
  ONBOARDING_SEARCH_KEYS,
} from './hubKeys.js';

export {
  migratePhase8OnboardingRecords,
  getFoundationStatusWithProject,
} from './phase8Migrate.js';


