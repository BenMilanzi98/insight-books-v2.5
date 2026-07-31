/**
 * CustomerOnboarding* model guards + serializers — Phase 17 Wave 1–3.
 */

import {
  ONBOARDING_REQUEST_STATUS,
  ONBOARDING_PROJECT_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import { resolveCsAccess } from '../authz.js';

export function hasCustomerOnboardingRequestModel(prisma) {
  return typeof prisma?.customerOnboardingRequest?.create === 'function';
}

export function hasCustomerOnboardingRequestStatusHistoryModel(prisma) {
  return typeof prisma?.customerOnboardingRequestStatusHistory?.create === 'function';
}

export function hasCustomerOnboardingProjectModel(prisma) {
  return typeof prisma?.customerOnboardingProject?.create === 'function';
}

export function hasCustomerOnboardingProjectStatusHistoryModel(prisma) {
  return typeof prisma?.customerOnboardingProjectStatusHistory?.create === 'function';
}

export function hasCustomerOnboardingTemplateVersionModel(prisma) {
  return typeof prisma?.customerOnboardingTemplateVersion?.create === 'function';
}

export function hasCustomerOnboardingTemplateModel(prisma) {
  return typeof prisma?.customerOnboardingTemplate?.create === 'function';
}

export function hasCustomerOnboardingMaterialisationModel(prisma) {
  return typeof prisma?.customerOnboardingMaterialisation?.create === 'function';
}

export function hasCustomerOnboardingWorkstreamModel(prisma) {
  return typeof prisma?.customerOnboardingWorkstream?.create === 'function';
}

export function hasCustomerOnboardingMilestoneModel(prisma) {
  return typeof prisma?.customerOnboardingMilestone?.create === 'function';
}

export function hasCustomerOnboardingTaskModel(prisma) {
  return typeof prisma?.customerOnboardingTask?.create === 'function';
}

export function hasCustomerOnboardingChecklistModel(prisma) {
  return typeof prisma?.customerOnboardingChecklist?.create === 'function';
}

export function hasCustomerOnboardingKickoffModel(prisma) {
  return typeof prisma?.customerOnboardingKickoff?.create === 'function';
}

export function hasCustomerOnboardingStakeholderModel(prisma) {
  return typeof prisma?.customerOnboardingStakeholder?.create === 'function';
}

export function hasCustomerOnboardingRequirementModel(prisma) {
  return typeof prisma?.customerOnboardingRequirement?.create === 'function';
}

export function hasCustomerOnboardingScopeItemModel(prisma) {
  return typeof prisma?.customerOnboardingScopeItem?.create === 'function';
}

export function hasCustomerOnboardingChangeRequestModel(prisma) {
  return typeof prisma?.customerOnboardingChangeRequest?.create === 'function';
}

export function hasCustomerOnboardingTaskEvidenceModel(prisma) {
  return typeof prisma?.customerOnboardingTaskEvidence?.create === 'function';
}

export function hasCustomerOnboardingTaskDependencyModel(prisma) {
  return typeof prisma?.customerOnboardingTaskDependency?.create === 'function';
}

export function hasCustomerOnboardingResponsibilityModel(prisma) {
  return typeof prisma?.customerOnboardingResponsibility?.create === 'function';
}

export function hasCustomerOnboardingReadinessEvaluationModel(prisma) {
  return typeof prisma?.customerOnboardingReadinessEvaluation?.create === 'function';
}

export function hasCustomerOnboardingMigrationModel(prisma) {
  return typeof prisma?.customerOnboardingMigration?.create === 'function';
}

export function hasCustomerOnboardingMraEisModel(prisma) {
  return typeof prisma?.customerOnboardingMraEis?.create === 'function';
}

export function hasCustomerOnboardingTrainingModel(prisma) {
  return typeof prisma?.customerOnboardingTraining?.create === 'function';
}

export function hasCustomerOnboardingDefectModel(prisma) {
  return typeof prisma?.customerOnboardingDefect?.create === 'function';
}

export function hasCustomerOnboardingTestPlanModel(prisma) {
  return typeof prisma?.customerOnboardingTestPlan?.create === 'function';
}

export function hasCustomerOnboardingGoLiveModel(prisma) {
  return typeof prisma?.customerOnboardingGoLive?.create === 'function';
}

export function hasCustomerOnboardingGoLiveApprovalModel(prisma) {
  return typeof prisma?.customerOnboardingGoLiveApproval?.create === 'function';
}

export function hasCustomerOnboardingGoLiveDecisionModel(prisma) {
  return typeof prisma?.customerOnboardingGoLiveDecision?.create === 'function';
}

export function hasCustomerOnboardingCutoverModel(prisma) {
  return typeof prisma?.customerOnboardingCutover?.create === 'function';
}

export function hasCustomerOnboardingPhase22TrainingHandoffModel(prisma) {
  return (
    typeof prisma?.customerOnboardingPhase22TrainingHandoff?.create === 'function'
  );
}

export function hasCustomerOnboardingStabilisationModel(prisma) {
  return typeof prisma?.customerOnboardingStabilisation?.create === 'function';
}

export function hasCustomerOnboardingHandoverModel(prisma) {
  return typeof prisma?.customerOnboardingHandover?.create === 'function';
}

export function hasCustomerOnboardingCompletionModel(prisma) {
  return typeof prisma?.customerOnboardingCompletion?.create === 'function';
}

export function hasCustomerOnboardingCompletionCertificateModel(prisma) {
  return typeof prisma?.customerOnboardingCompletionCertificate?.create === 'function';
}

export function resolveOnboardingActor(args = {}) {
  return args.admin || args.actorContext?.admin || args.actorContext || null;
}

export function canManageOnboarding(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canManageCases || access?.isSuperAdmin);
}

export function canViewOnboarding(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canView || access?.isSuperAdmin);
}

export function serializeOnboardingRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status || ONBOARDING_REQUEST_STATUS.NEW,
    source: row.source || null,
    onboardingType: row.onboardingType || null,
    handoffId: row.handoffId || null,
    conversionId: row.conversionId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    payloadJson: row.payloadJson ?? null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    projectId: row.projectId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeOnboardingProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    onboardingNumber: row.onboardingNumber,
    status: row.status || ONBOARDING_PROJECT_STATUS.DRAFT,
    onboardingType: row.onboardingType || null,
    onboardingRequestId: row.onboardingRequestId || null,
    handoffId: row.handoffId || null,
    conversionId: row.conversionId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    templateVersionId: row.templateVersionId || null,
    targetKickoffDate: row.targetKickoffDate
      ? new Date(row.targetKickoffDate).toISOString()
      : null,
    targetGoLiveDate: row.targetGoLiveDate
      ? new Date(row.targetGoLiveDate).toISOString()
      : null,
    ownerAssignmentsJson: row.ownerAssignmentsJson ?? null,
    csOwnerAdminId: row.csOwnerAdminId || null,
    ownerAdminId: row.ownerAdminId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    domain: getOnboardingDomainContract(),
  };
}

export function serializeOnboardingTemplateVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    templateCode: row.templateCode,
    versionNumber: row.versionNumber,
    onboardingType: row.onboardingType,
    status: row.status,
    contentJson: row.contentJson ?? null,
    immutable: row.immutable !== false,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeOnboardingMaterialisation(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    templateVersionId: row.templateVersionId,
    idempotencyKey: row.idempotencyKey || null,
    workstreamCount: row.workstreamCount ?? null,
    milestoneCount: row.milestoneCount ?? null,
    taskCount: row.taskCount ?? null,
    checklistCount: row.checklistCount ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeOnboardingWorkstream(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    code: row.code,
    name: row.name,
    sequence: row.sequence,
    status: row.status,
  };
}

export function serializeOnboardingMilestone(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    workstreamId: row.workstreamId || null,
    code: row.code,
    name: row.name,
    sequence: row.sequence,
    required: row.required !== false,
    status: row.status,
  };
}

export function serializeOnboardingTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    workstreamId: row.workstreamId || null,
    code: row.code,
    name: row.name,
    actorType: row.actorType,
    status: row.status,
    completionSource: row.completionSource || null,
    waiverReason: row.waiverReason || null,
    assigneeAdminId: row.assigneeAdminId || null,
    assigneeContactId: row.assigneeContactId || null,
  };
}

export function serializeOnboardingKickoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    crmMeetingId: row.crmMeetingId,
    status: row.status,
    timezone: row.timezone || null,
    kickoffCompleted: row.kickoffCompleted === true,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializeOnboardingStakeholder(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    contactId: row.contactId,
    role: row.role,
    party: row.party || null,
    required: row.required !== false,
    status: row.status,
  };
}

export function serializeOnboardingRequirement(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    confirmedScopeJson: row.confirmedScopeJson ?? null,
    confirmedAt: row.confirmedAt ? new Date(row.confirmedAt).toISOString() : null,
  };
}

export function serializeOnboardingChangeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    reasonCode: row.reasonCode,
    status: row.status,
    title: row.title || null,
    description: row.description || null,
    requestedScopeJson: row.requestedScopeJson ?? null,
    confirmedScopeJson: row.confirmedScopeJson ?? null,
    commercialHandoffRequired: row.commercialHandoffRequired !== false,
    subscriptionMutated: row.subscriptionMutated === true,
  };
}

export function serializeOnboardingTaskEvidence(row) {
  if (!row) return null;
  return {
    id: row.id,
    taskId: row.taskId,
    projectId: row.projectId || null,
    status: row.status,
    fileRef: row.fileRef || null,
    contactId: row.contactId || null,
    attestationReason: row.attestationReason || null,
    attestedByAdminId: row.attestedByAdminId || null,
    attestedAt: row.attestedAt ? new Date(row.attestedAt).toISOString() : null,
    reviewDecision: row.reviewDecision || null,
    reviewReason: row.reviewReason || null,
    rejectReason: row.rejectReason || null,
    reviewedByAdminId: row.reviewedByAdminId || null,
  };
}

export function serializeOnboardingTaskDependency(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    predecessorTaskId: row.predecessorTaskId,
    successorTaskId: row.successorTaskId,
    dependencyType: row.dependencyType,
  };
}

export function serializeOnboardingResponsibility(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    party: row.party,
    title: row.title,
    status: row.status,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
  };
}

export function serializeOnboardingReadinessEvaluation(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    overallStatus: row.overallStatus,
    dimensionsJson: row.dimensionsJson ?? null,
    rulesVersion: row.rulesVersion || null,
  };
}

export function serializeOnboardingMigration(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    reconciliationStatus: row.reconciliationStatus || null,
    fileInventoryJson: row.fileInventoryJson ?? null,
    securityFlagsJson: row.securityFlagsJson ?? null,
    engineStatus: row.engineStatus || null,
  };
}

export function serializeOnboardingMraEis(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    credentialStatus: row.credentialStatus || null,
    testApprovalRef: row.testApprovalRef || null,
    productionApprovalRef: row.productionApprovalRef || null,
  };
}

export function serializeOnboardingTraining(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    sourceDomain: row.sourceDomain || null,
    trainingDomainSource: row.trainingDomainSource || null,
    trainingDomainStatus: row.trainingDomainStatus || null,
  };
}

export function serializeOnboardingDefect(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    title: row.title,
    severity: row.severity,
    status: row.status,
  };
}

export function serializeOnboardingTestPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    status: row.status,
    casesJson: row.casesJson ?? null,
    resultsJson: row.resultsJson ?? null,
  };
}

export function serializeOnboardingGoLive(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    outcome: row.outcome || null,
    windowStart: row.windowStart ? new Date(row.windowStart).toISOString() : null,
    windowEnd: row.windowEnd ? new Date(row.windowEnd).toISOString() : null,
    customerAcknowledged: row.customerAcknowledged === true,
    rollbackDecision: row.rollbackDecision || null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializeOnboardingGoLiveApproval(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    approvalRole: row.approvalRole,
    status: row.status,
    approvedAt: row.approvedAt ? new Date(row.approvedAt).toISOString() : null,
  };
}

export function serializeOnboardingGoLiveDecision(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    decision: row.decision || row.status || null,
    status: row.status || row.decision || null,
    decidedByAdminId: row.decidedByAdminId || row.createdByAdminId || null,
    decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
    conditionsJson: row.conditionsJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializeOnboardingCutover(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    checklistJson: row.checklistJson ?? null,
    rollbackPlanJson: row.rollbackPlanJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializeOnboardingStabilisation(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    exitApprovedAt: row.exitApprovedAt
      ? new Date(row.exitApprovedAt).toISOString()
      : null,
    hypercare: false,
  };
}

export function serializeOnboardingHandover(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    recipientsJson: row.recipientsJson ?? null,
    openItemsJson: row.openItemsJson ?? null,
    checksumSha256: row.checksumSha256 || null,
    acceptedAt: row.acceptedAt ? new Date(row.acceptedAt).toISOString() : null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializePhase22TrainingHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    status: row.status,
    checksumSha256: row.checksumSha256 || null,
    payloadJson: row.payloadJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
  };
}

export function serializeOnboardingCompletion(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    customerSignOffAt: row.customerSignOffAt
      ? new Date(row.customerSignOffAt).toISOString()
      : null,
    internalSignOffAt: row.internalSignOffAt
      ? new Date(row.internalSignOffAt).toISOString()
      : null,
    reconciliationStatus: row.reconciliationStatus || null,
  };
}

export function serializeOnboardingCompletionCertificate(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.projectId,
    checksumSha256: row.checksumSha256,
    status: row.status || 'ISSUED',
    idempotencyKey: row.idempotencyKey || null,
    payloadJson: row.payloadJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}
