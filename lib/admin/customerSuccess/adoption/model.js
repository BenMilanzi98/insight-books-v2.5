/**
 * CustomerAdoption* model guards + serializers — Phase 19 Wave 1–3.
 */

import {
  ADOPTION_REQUEST_STATUS,
  ADOPTION_PLAN_STATUS,
  ADOPTION_MILESTONE_STATUS,
  ADOPTION_EVIDENCE_STATUS,
  ADOPTION_VALUE_OUTCOME_STATUS,
  ADOPTION_DORMANCY_STATUS,
  ADOPTION_EXPANSION_STATUS,
  getAdoptionDomainContract,
} from './catalogue.js';
import { resolveCsAccess } from '../authz.js';

export function hasCustomerAdoptionRequestModel(prisma) {
  return typeof prisma?.customerAdoptionRequest?.create === 'function';
}

export function hasCustomerAdoptionRequestStatusHistoryModel(prisma) {
  return typeof prisma?.customerAdoptionRequestStatusHistory?.create === 'function';
}

export function hasCustomerAdoptionPlanModel(prisma) {
  return typeof prisma?.customerAdoptionPlan?.create === 'function';
}

export function hasCustomerAdoptionPlanStatusHistoryModel(prisma) {
  return typeof prisma?.customerAdoptionPlanStatusHistory?.create === 'function';
}

export function hasCustomerAdoptionPlanTemplateModel(prisma) {
  return typeof prisma?.customerAdoptionPlanTemplate?.create === 'function';
}

export function hasCustomerAdoptionPlanTemplateVersionModel(prisma) {
  return typeof prisma?.customerAdoptionPlanTemplateVersion?.create === 'function';
}

export function hasCustomerAdoptionMilestoneModel(prisma) {
  return typeof prisma?.customerAdoptionMilestone?.create === 'function';
}

export function hasCustomerAdoptionEvidenceSnapshotModel(prisma) {
  return typeof prisma?.customerAdoptionEvidenceSnapshot?.create === 'function';
}

export function hasCustomerAdoptionValueOutcomeModel(prisma) {
  return typeof prisma?.customerAdoptionValueOutcome?.create === 'function';
}

export function hasCustomerTrainingProgramModel(prisma) {
  return typeof prisma?.customerTrainingProgram?.findUnique === 'function';
}

export function hasCustomerTrainingCertificateModel(prisma) {
  return typeof prisma?.customerTrainingCertificate?.findFirst === 'function';
}

export function hasCustomerAdoptionChampionModel(prisma) {
  return typeof prisma?.customerAdoptionChampion?.create === 'function';
}

export function hasCustomerAdoptionDormancyCaseModel(prisma) {
  return typeof prisma?.customerAdoptionDormancyCase?.create === 'function';
}

export function hasCustomerAdoptionInterventionLinkModel(prisma) {
  return typeof prisma?.customerAdoptionInterventionLink?.create === 'function';
}

export function hasCustomerAdoptionExpansionHandoffModel(prisma) {
  return typeof prisma?.customerAdoptionExpansionHandoff?.create === 'function';
}

export function hasCsInterventionModel(prisma) {
  return typeof prisma?.csIntervention?.findUnique === 'function';
}

export function hasCrmContactModel(prisma) {
  return (
    typeof prisma?.crmContact?.findUnique === 'function' ||
    typeof prisma?.crmContact?.findFirst === 'function'
  );
}

export function resolveAdoptionActor(args = {}) {
  return args.admin || args.actorContext?.admin || args.actorContext || null;
}

export function canManageAdoption(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canManageCases || access?.isSuperAdmin);
}

export function canViewAdoption(admin) {
  const access = resolveCsAccess(admin);
  return Boolean(access?.canView || access?.isSuperAdmin);
}

export function serializeAdoptionRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status || ADOPTION_REQUEST_STATUS.NEW,
    source: row.source || null,
    trainingProgramId: row.trainingProgramId || null,
    onboardingProjectId: row.onboardingProjectId || null,
    onboardingHandoverId: row.onboardingHandoverId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    targetRolesJson: row.targetRolesJson ?? null,
    payloadJson: row.payloadJson ?? null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    planId: row.planId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionPlan(row) {
  if (!row) return null;
  const templateVersionId = row.planTemplateVersionId || row.templateVersionId || null;
  return {
    id: row.id,
    planNumber: row.planNumber,
    status: row.status || ADOPTION_PLAN_STATUS.DRAFT,
    adoptionRequestId: row.adoptionRequestId || null,
    trainingProgramId: row.trainingProgramId || null,
    onboardingProjectId: row.onboardingProjectId || null,
    onboardingHandoverId: row.onboardingHandoverId || null,
    customerId: row.customerId || null,
    tenantId: row.tenantId || null,
    subscriptionId: row.subscriptionId || null,
    planTemplateVersionId: templateVersionId,
    templateVersionId,
    successPlanId: row.successPlanId || null,
    ownerAssignmentsJson: row.ownerAssignmentsJson ?? null,
    csOwnerAdminId: row.csOwnerAdminId || null,
    ownerAdminId: row.ownerAdminId || null,
    healthStatus: row.healthStatus || null,
    valueReviewState: row.valueReviewState || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionPlanTemplateVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    templateId: row.templateId || null,
    templateCode: row.templateCode || null,
    versionNumber: row.versionNumber ?? null,
    status: row.status || null,
    contentJson: row.contentJson ?? null,
    immutable: row.immutable !== false,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionMilestone(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    planTemplateVersionId: row.planTemplateVersionId || null,
    templateKey: row.templateKey || null,
    roleTarget: row.roleTarget || null,
    evidenceMode: row.evidenceMode || null,
    status: row.status || ADOPTION_MILESTONE_STATUS.NOT_STARTED,
    critical: row.critical === true,
    dueAt: row.dueAt ? new Date(row.dueAt).toISOString() : null,
    definitionJson: row.definitionJson ?? null,
    attestedByAdminId: row.attestedByAdminId || null,
    attestedAt: row.attestedAt ? new Date(row.attestedAt).toISOString() : null,
    attestationReason: row.attestationReason || null,
    waivedByAdminId: row.waivedByAdminId || null,
    waivedAt: row.waivedAt ? new Date(row.waivedAt).toISOString() : null,
    waiverReason: row.waiverReason || null,
    evidenceSnapshotId: row.evidenceSnapshotId || null,
    lastEvaluatedAt: row.lastEvaluatedAt
      ? new Date(row.lastEvaluatedAt).toISOString()
      : null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionEvidenceSnapshot(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    milestoneId: row.milestoneId || null,
    evidenceMode: row.evidenceMode || null,
    status: row.status || ADOPTION_EVIDENCE_STATUS.UNKNOWN,
    sourceSystem: row.sourceSystem || null,
    observedAt: row.observedAt ? new Date(row.observedAt).toISOString() : null,
    snapshotJson: row.snapshotJson ?? null,
    reasonCode: row.reasonCode || null,
    reasonMessage: row.reasonMessage || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeAdoptionValueOutcome(row) {
  if (!row) return null;
  const value = row.value === undefined ? null : row.value;
  return {
    id: row.id,
    planId: row.planId || null,
    outcomeType: row.outcomeType || null,
    status: row.status || ADOPTION_VALUE_OUTCOME_STATUS.UNKNOWN,
    value: value == null ? null : value,
    sourceSystem: row.sourceSystem || null,
    observedAt: row.observedAt ? new Date(row.observedAt).toISOString() : null,
    lineageJson: row.lineageJson ?? null,
    reasonCode: row.reasonCode || null,
    reasonMessage: row.reasonMessage || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionChampion(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    contactId: row.contactId || null,
    role: row.role || null,
    enablementStatus: row.enablementStatus || null,
    lastEvidenceRef: row.lastEvidenceRef || null,
    tenantId: row.tenantId || null,
    customerId: row.customerId || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionDormancyCase(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    tenantId: row.tenantId || null,
    status: row.status || ADOPTION_DORMANCY_STATUS.OPEN,
    signalIdentity: row.signalIdentity || null,
    signalCode: row.signalCode || null,
    featureCode: row.featureCode || null,
    interventionId: row.interventionId || null,
    playbookExecutionId: row.playbookExecutionId || null,
    usageReturnSnapshotJson: row.usageReturnSnapshotJson ?? null,
    outreachAttestedAt: row.outreachAttestedAt
      ? new Date(row.outreachAttestedAt).toISOString()
      : null,
    outreachAttestedByAdminId: row.outreachAttestedByAdminId || null,
    outcomeReason: row.outcomeReason || null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeAdoptionInterventionLink(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    dormancyCaseId: row.dormancyCaseId || null,
    interventionId: row.interventionId || null,
    playbookExecutionId: row.playbookExecutionId || null,
    outcomeAttestationJson: row.outcomeAttestationJson ?? null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
  };
}

export function serializeAdoptionExpansionHandoff(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId || null,
    tenantId: row.tenantId || null,
    status: row.status || ADOPTION_EXPANSION_STATUS.DRAFT,
    targetQueue: row.targetQueue || null,
    signalPackageJson: row.signalPackageJson ?? null,
    evidenceRefsJson: row.evidenceRefsJson ?? null,
    idempotencyKey: row.idempotencyKey || null,
    createdByAdminId: row.createdByAdminId || null,
    handedOffAt: row.handedOffAt ? new Date(row.handedOffAt).toISOString() : null,
    handedOffByAdminId: row.handedOffByAdminId || null,
    acknowledgedAt: row.acknowledgedAt
      ? new Date(row.acknowledgedAt).toISOString()
      : null,
    acknowledgedByAdminId: row.acknowledgedByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export { getAdoptionDomainContract };
