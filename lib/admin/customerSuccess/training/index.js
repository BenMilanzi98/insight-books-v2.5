/**
 * PRD Phase 22 Customer Training public surface (tree phase-18 alias).
 */

export {
  TRAINING_REQUEST_NUMBER_RE,
  TRAINING_PROGRAM_NUMBER_RE,
  TRAINING_COHORT_NUMBER_RE,
  TRAINING_SESSION_NUMBER_RE,
  TRAINING_CERTIFICATE_NUMBER_RE,
  TRAINING_REQUEST_SOURCE,
  TRAINING_REQUEST_SOURCE_ALIASES,
  resolveTrainingRequestSource,
  TRAINING_HANDOFF_VALIDATION_STATUS,
  TRAINING_REQUEST_STATUS,
  TRAINING_REQUEST_STATUSES,
  TRAINING_TYPE,
  TRAINING_PROGRAM_STATUS,
  TRAINING_CURRICULUM_STATUS,
  TRAINING_PARTICIPANT_VERIFICATION,
  TRAINING_ENROLMENT_STATUS,
  TRAINING_INVITATION_STATUS,
  TRAINING_COHORT_STATUS,
  TRAINING_SESSION_STATUS,
  TRAINING_CONFLICT_STATE,
  TRAINING_ATTENDANCE_STATUS,
  TRAINING_ATTENDANCE_SOURCE,
  TRAINING_ATTENDANCE_FORBIDDEN_SOURCES,
  TRAINING_MATERIAL_CLASSIFICATION,
  TRAINING_EXERCISE_STATUS,
  TRAINING_ASSESSMENT_TYPE,
  TRAINING_ATTEMPT_STATUS,
  TRAINING_RESULT_STATUS,
  TRAINING_COMPLETION_STATUS,
  TRAINING_CERTIFICATE_TYPE,
  TRAINING_CERTIFICATE_VERIFICATION,
  TRAINING_CERTIFICATE_ELIGIBILITY,
  TRAINING_CS_OUTCOME_HANDOFF_TYPE,
  TRAINING_PA_OUTCOME_HANDOFF_TYPE,
  TRAINING_FORBIDDEN_FISCAL_PLANES,
  TRAINING_COMPLETION_POLICY_V1,
  TRAINING_HEALTH_RULES_VERSION,
  TRAINING_PROGRESS_RULES_VERSION,
  WAVE1_ONBOARDING_CURRICULUM_CODE,
  VIRTUAL_PROVIDER_NOT_CONFIGURED,
  MEETING_SERVICE_UNAVAILABLE,
  TRAINING_DOMAIN_CONTRACT,
  getTrainingDomainContract,
  getVirtualProviderStatus,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';

export {
  allocateTrainingRequestNumber,
  allocateTrainingProgramNumber,
  allocateTrainingCohortNumber,
  allocateTrainingSessionNumber,
  allocateTrainingCertificateNumber,
  formatCrmNumber,
  utcYearOf,
} from './numbering.js';

export {
  hasCustomerTrainingRequestModel,
  hasCustomerTrainingRequestStatusHistoryModel,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingProgramStatusHistoryModel,
  hasCustomerTrainingCurriculumModel,
  hasCustomerTrainingCurriculumVersionModel,
  hasCustomerTrainingModuleModel,
  hasCustomerTrainingModuleVersionModel,
  hasCustomerTrainingCohortModel,
  hasCustomerTrainingParticipantModel,
  hasCustomerTrainingEnrolmentModel,
  hasCustomerTrainingInvitationModel,
  hasCustomerTrainingTrainerModel,
  hasCustomerTrainingTrainerAssignmentModel,
  hasCustomerTrainingSessionModel,
  hasCustomerTrainingAttendanceModel,
  hasCustomerTrainingMaterialModel,
  hasCustomerTrainingConflictModel,
  hasCustomerTrainingExerciseModel,
  hasCustomerTrainingAssessmentModel,
  hasCustomerTrainingAssessmentVersionModel,
  hasCustomerTrainingAssessmentAttemptModel,
  hasCustomerTrainingAssessmentResultModel,
  hasCustomerTrainingAssessmentRegradeModel,
  hasCustomerTrainingParticipantCompletionModel,
  hasCustomerTrainingProgramCompletionModel,
  hasCustomerTrainingCertificateModel,
  resolveTrainingActor,
  canManageTraining,
  canViewTraining,
  serializeTrainingRequest,
  serializeTrainingProgram,
  serializeTrainingCurriculumVersion,
  serializeTrainingCohort,
  serializeTrainingParticipant,
  serializeTrainingEnrolment,
  serializeTrainingInvitation,
  serializeTrainingTrainer,
  serializeTrainingSession,
  serializeTrainingAttendance,
  serializeTrainingMaterial,
  serializeTrainingMaterialForParticipant,
  serializeTrainingExercise,
  serializeTrainingAssessment,
  serializeTrainingAssessmentVersion,
  serializeTrainingAssessmentAttempt,
  serializeTrainingAssessmentAttemptListItem,
  serializeTrainingAssessmentResult,
  serializeTrainingAssessmentRegrade,
  serializeTrainingParticipantCompletion,
  serializeTrainingCertificate,
  serializeTrainingCertificatePublic,
} from './model.js';

export {
  canTransitionTrainingRequestStatus,
  canTransitionTrainingProgramStatus,
  assertCanTransitionTrainingRequestStatus,
  assertCanTransitionTrainingProgramStatus,
  transitionTrainingRequestStatus,
  transitionTrainingProgramStatus,
} from './status.js';

export {
  requestMissingPins,
  createTrainingRequest,
  validateTrainingRequest,
  acceptTrainingRequest,
  rejectTrainingRequest,
  listTrainingRequests,
  loadTrainingRequest,
} from './requests.js';

export {
  createCustomerTrainingProgram,
  listTrainingPrograms,
} from './programs.js';

export {
  acknowledgeTrainingHandoffInProgress,
  consumeTrainingHandoff,
  evaluatePhase22TrainingHandoffChecksum,
  validateTrainingHandoff,
  acceptTrainingHandoff,
} from './handoffConsume.js';

export {
  ensureWave1OnboardingCurriculumVersion,
  updateTrainingCurriculumVersion,
  assertTrainingModuleNotProductModule,
  bindTrainingModuleRoleEntitlement,
} from './curricula.js';

export {
  resolveTrainingListScope,
  tenantWhereFromScope,
} from './listScope.js';

export { createTrainingCohort } from './cohorts.js';
export {
  verifyTrainingParticipant,
  projectTrainingParticipant,
} from './participants.js';
export { enrolTrainingParticipant } from './enrolment.js';
export {
  createTrainingInvitation,
  sendTrainingInvitation,
  markTrainingInvitationDelivered,
  registerFromTrainingInvitation,
} from './invitations.js';
export { assignTrainingTrainer } from './trainers.js';
export {
  scheduleTrainingSession,
  recordTrainingSessionRsvp,
  markTrainingSessionDelivered,
  requestVirtualTrainingProviderSession,
} from './sessions.js';
export {
  evaluateTrainingConflicts,
  confirmTrainingSchedule,
} from './conflicts.js';
export {
  captureTrainingAttendance,
  correctTrainingAttendance,
} from './attendance.js';
export {
  assertRestrictedMaterialAccess,
  projectMaterialForParticipant,
} from './materials.js';
export { assertTrainingEnvironmentIsolation } from './environment.js';

export {
  loadTrainingProgramForActor,
  loadTrainingRequestForActor,
  resolveActorTenantId,
  assertTrainingTenantInPortfolioScope,
} from './programAccess.js';

export { findActiveProgramForPurpose } from './programs.js';

export {
  submitTrainingExercise,
  reviewTrainingExercise,
  waiveTrainingExercise,
  retryTrainingExercise,
} from './exercises.js';

export {
  createTrainingAssessment,
  publishTrainingAssessmentVersion,
  updateTrainingAssessmentVersion,
} from './assessments.js';

export {
  startAssessmentAttempt,
  submitAssessmentAttempt,
  listAssessmentAttempts,
  retakeAssessment,
} from './attempts.js';

export {
  gradeAssessmentAttempt,
  finaliseAssessmentResult,
  regradeAssessmentAttempt,
} from './grading.js';

export {
  evaluateParticipantCompletion,
  evaluateProgramCompletion,
} from './completion.js';

export {
  evaluateCertificateEligibility,
  issueTrainingCertificate,
  revokeTrainingCertificate,
  verifyTrainingCertificate,
} from './certificates.js';

export { publishTrainingOutcomeToOnboarding } from './onboardingFeed.js';

export {
  emitTrainingCsOutcomeHandoff,
  computeTrainingCsOutcomeHandoffChecksum,
} from './csOutcomeHandoff.js';

export {
  emitTrainingPaOutcomeHandoff,
  computeTrainingPaOutcomeHandoffChecksum,
} from './paOutcomeHandoff.js';

export { calculateTrainingHealth } from './health.js';
export { calculateTrainingProgress } from './progress.js';

/* Wave 4 */

export {
  applyTrainingReportHonesty,
  safeTrainingCount,
  gatedMetricCard,
  TRAINING_REPORT_STATUS,
} from './reliabilityGate.js';

export {
  getTrainingMetric,
  getTrainingOverviewCards,
  TRAINING_METRIC_VERSION,
} from './metrics.js';

export { getTrainingMyWork } from './myWork.js';

export {
  listTrainingReports,
  getTrainingReport,
  TRAINING_REPORT_CATALOGUE,
  TRAINING_REPORT_VERSION,
} from './reports.js';

export { exportTrainingReport } from './exports.js';

export {
  getTrainingStatusLabelHonesty,
  TRAINING_STATUS_LABEL,
} from './honestyLabels.js';

export { runTrainingDataQuality, TRAINING_DQ_VERSION } from './dataQuality.js';

export {
  runTrainingReconciliation,
  TRAINING_RECON_VERSION,
} from './reconciliation.js';

export { getTrainingLineage } from './lineage.js';

export { searchTrainingIndex } from './search.js';

export {
  TRAINING_CACHE_KEYS,
  buildTrainingCacheKey,
} from './cache.js';

export {
  getTrainingNotificationContract,
  enqueueTrainingNotification,
  TRAINING_NOTIFICATIONS_STATUS,
} from './notifications.js';

export {
  TRAINING_HUB_ROUTES,
  TRAINING_PERMISSION_NOTES,
  TRAINING_SEARCH_KEYS,
} from './hubKeys.js';

export {
  migratePhase8TrainingRecords,
  getFoundationStatusWithProgram,
} from './phase8Migrate.js';
