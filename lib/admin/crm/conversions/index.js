/**
 * Phase 16 Wave 1–4 / Phase 20 Wave 1–4 — Closed-Won conversion domain exports.
 */

export {
  CRM_CONVERSION_REQUEST_SOURCE,
  CRM_CONVERSION_REQUEST_STATUS,
  CRM_CONVERSION_REQUEST_STATUSES,
  CRM_CONVERSION_TYPE,
  CRM_CONVERSION_STATUS,
  CRM_CONVERSION_STEP_CODE,
  CRM_CONVERSION_STEP_STATUS,
  CRM_CONVERSION_WAVE1_STEPS,
  CRM_CONVERSION_WAVE2_STEPS,
  CRM_CONVERSION_WAVE3_STEPS,
  CRM_CONVERSION_WAVE4_STEPS,
  CRM_CUSTOMER_MATCH_STATE,
  CRM_CONTACT_LINK_DECISION,
  CRM_CONVERSION_RESOURCE_TYPE,
  CRM_TENANT_PROVISION_STATUS,
  CRM_SUBSCRIPTION_PROVISION_STATUS,
  CRM_ACTIVATION_POLICY,
  CRM_PAYMENT_INITIATION_STATUS,
  RESERVED_TENANT_SLUGS,
  CRM_CONVERSION_READINESS_STATUS,
  CONVERSION_DOMAIN_CONTRACT,
  getConversionDomainContract,
  CRM_CONVERSION_REQUEST_NUMBER_RE,
  CRM_CONVERSION_NUMBER_RE,
  CRM_NUMBER_PREFIX,
} from './catalogue.js';

export {
  allocateConversionRequestNumber,
  allocateConversionNumber,
  formatCrmNumber,
  utcYearOf,
} from './numbering.js';

export {
  hasCrmConversionRequestModel,
  hasCrmConversionRequestStatusHistoryModel,
  hasCrmConversionPlanModel,
  hasCrmConversionPlanVersionModel,
  hasCrmConversionDryRunModel,
  hasCrmConversionModel,
  hasCrmConversionStatusHistoryModel,
  hasCrmConversionStepModel,
  hasCrmConversionAttemptModel,
  hasCrmConversionFailureModel,
  hasCrmConversionMatchDecisionModel,
  hasCrmConversionResourceModel,
  hasCrmConversionInvitationModel,
  resolveConversionActor,
  serializeConversionRequest,
  serializeConversionPlan,
  serializeConversionPlanVersion,
  serializeConversion,
  serializeConversionStep,
} from './model.js';

export {
  canTransitionConversionRequestStatus,
  transitionConversionRequestStatus,
  transitionConversionStatus,
} from './status.js';

export {
  createConversionRequest,
  createConversionRequestFromClosedWonHandoff,
  validateConversionRequest,
  approveConversionRequest,
  listConversionRequests,
  loadConversionRequest,
} from './requests.js';

export {
  evaluateConversionReadiness,
  evaluateConversionRequestReadiness,
} from './readiness.js';

export { createConversionPlan } from './plan.js';

export { dryRunConversion } from './dryRun.js';

export {
  hashConversionInput,
  ensureWave1Steps,
  ensureWave2Steps,
  ensureWave3Steps,
  recordStepAttempt,
  markStepStatus,
  isStepCompleted,
  claimConversionStep,
  beginStepOptimistic,
} from './steps.js';

export {
  matchPlatformCustomer,
  decideCustomerCreateOrLink,
  isExactCustomerMatch,
  isExactOrHighConfidenceMatch,
} from './customerMatch.js';

export { createOrLinkPlatformCustomer } from './customerProvision.js';

export {
  decideTenantCreateOrLink,
  createOrLinkTenant,
  isReservedTenantSlug,
} from './tenantProvision.js';

export {
  createPrimaryBusinessBranch,
  linkContactsForConversion,
  decideContactCreateOrLink,
} from './businessBranch.js';

export {
  lockConversionCommercialSnapshot,
  getLockedConversionCommercialSnapshot,
  resolveConversionAcceptedSnapshot,
  checksumCommercialSnapshot,
} from './commercialSnapshot.js';

export {
  createInitialUserInvitation,
  revokeConversionInvitation,
} from './invitations.js';

export { assertTenantIsolation } from './isolation.js';

export { assertNoTenantAccountingSideEffects } from './accountingBoundary.js';

export { runWave2ProvisionSpine } from './wave2Runner.js';

export { createOrAmendSubscriptionFromAccepted } from './subscription.js';

export { provisionEntitlementsFromAccepted } from './entitlements.js';

export {
  createOrLinkBillingAccount,
  createBillingSchedule,
  createPlatformInvoiceIfRequired,
} from './billing.js';

export { initiatePaymentIfRequired } from './paymentBoundary.js';

export {
  evaluateActivationPolicy,
  resolveAuthoritativePaymentSuccess,
  activateProvisionedSubscription,
} from './activation.js';

export { runWave3ProvisionSpine } from './wave3Runner.js';

export { assignCustomerSuccessOwner } from './customerSuccess.js';

export {
  createOnboardingHandoff,
  sendOnboardingHandoff,
  supersedeOnboardingHandoff,
} from './onboardingHandoff.js';

export { createTrainingHandoff } from './trainingHandoff.js';

export { createDataMigrationHandoff } from './migrationHandoff.js';

export { createMraEisHandoff } from './mraEisHandoff.js';

export {
  assertProvisionResultHonesty,
  clampProvisionRequestStatus,
  stripFabricatedProvisionArgs,
  CRM_FABRICATED_TERMINAL_STATUSES,
  CRM_HONEST_PENDING_STATUSES,
} from './requestHonesty.js';

export {
  finalizeConversion,
  compensateConversionArtifacts,
  computeCompletionCertificateChecksum,
} from './completion.js';

export {
  applyConversionReportHonesty,
  safeConversionCount,
  CRM_CONVERSION_REPORT_STATUS,
} from './reliabilityGate.js';

export { getConversionMetric } from './metrics.js';

export {
  getConversionReport,
  getConversionOverview,
  CRM_CONVERSION_REPORT_VERSION,
} from './reports.js';

export { runConversionDataQuality } from './dataQuality.js';

export { runConversionReconciliation } from './reconciliation.js';

export {
  resolveConversionListScope,
  whereFromConversionScope,
} from './listScope.js';

export { exportConversionReport } from './exports.js';

export { searchConversionIndex } from './search.js';

export {
  getConversionValueLabelHonesty,
  CRM_CONVERSION_VALUE_LABEL,
} from './valueLabels.js';

export {
  CRM_CONVERSION_HUB_ROUTES,
  CRM_CONVERSION_PERMISSION_NOTES,
  CRM_CONVERSION_SEARCH_KEYS,
  CRM_CONVERSION_CACHE_KEYS,
} from './hubKeys.js';

export {
  CRM_CONVERSION_HANDOFF_TYPE,
  CRM_CONVERSION_HANDOFF_STATUS,
  CRM_CONVERSION_HANDOFF_EXECUTION,
  CRM_ONBOARDING_HANDOFF_PACKAGE_STATUS,
  sanitizeConversionHandoffPayload,
  computeOnboardingHandoffChecksum,
  sendDomainHandoff,
  supersedeDomainHandoff,
} from './handoffShared.js';

export { executeClosedWonConversion, resumeConversion } from './orchestrator.js';
