/**
 * CrmConversion* model guards + serializers — Phase 16 Wave 1.
 */

import {
  CRM_CONVERSION_REQUEST_STATUS,
  CRM_CONVERSION_STATUS,
  getConversionDomainContract,
} from './catalogue.js';

export function hasCrmConversionRequestModel(prisma) {
  return typeof prisma?.crmConversionRequest?.create === 'function';
}

export function hasCrmConversionRequestStatusHistoryModel(prisma) {
  return typeof prisma?.crmConversionRequestStatusHistory?.create === 'function';
}

export function hasCrmConversionPlanModel(prisma) {
  return typeof prisma?.crmConversionPlan?.create === 'function';
}

export function hasCrmConversionPlanVersionModel(prisma) {
  return typeof prisma?.crmConversionPlanVersion?.create === 'function';
}

export function hasCrmConversionDryRunModel(prisma) {
  return typeof prisma?.crmConversionDryRun?.create === 'function';
}

export function hasCrmConversionModel(prisma) {
  return typeof prisma?.crmConversion?.create === 'function';
}

export function hasCrmConversionStatusHistoryModel(prisma) {
  return typeof prisma?.crmConversionStatusHistory?.create === 'function';
}

export function hasCrmConversionStepModel(prisma) {
  return typeof prisma?.crmConversionStep?.create === 'function';
}

export function hasCrmConversionAttemptModel(prisma) {
  return typeof prisma?.crmConversionAttempt?.create === 'function';
}

export function hasCrmConversionFailureModel(prisma) {
  return typeof prisma?.crmConversionFailure?.create === 'function';
}

export function hasCrmConversionMatchDecisionModel(prisma) {
  return typeof prisma?.crmConversionMatchDecision?.create === 'function';
}

export function hasCrmConversionResourceModel(prisma) {
  return typeof prisma?.crmConversionResource?.create === 'function';
}

export function hasCrmConversionInvitationModel(prisma) {
  return typeof prisma?.crmConversionInvitation?.create === 'function';
}

export function resolveConversionActor(args = {}) {
  return args.admin || args.actorContext?.admin || args.actorContext || null;
}

export function serializeConversionRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    status: row.status || CRM_CONVERSION_REQUEST_STATUS.DRAFT,
    source: row.source || null,
    conversionType: row.conversionType || null,
    acceptanceId: row.acceptanceId || null,
    handoffId: row.handoffId || null,
    opportunityId: row.opportunityId || null,
    accountId: row.accountId || null,
    contactId: row.contactId || null,
    documentVersionId: row.documentVersionId || null,
    checksumSha256: row.checksumSha256 || null,
    currency: row.currency || null,
    payloadJson: row.payloadJson ?? null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    currentPlanId: row.currentPlanId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeConversionPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionRequestId: row.conversionRequestId,
    latestVersionNumber: row.latestVersionNumber ?? null,
    currentVersionId: row.currentVersionId || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeConversionPlanVersion(row) {
  if (!row) return null;
  return {
    id: row.id,
    planId: row.planId,
    versionNumber: row.versionNumber,
    planChecksum: row.planChecksum || null,
    contentJson: row.contentJson ?? null,
    immutable: row.immutable !== false,
    notes: row.notes || null,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeConversion(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionNumber: row.conversionNumber,
    status: row.status || CRM_CONVERSION_STATUS.LOCKED,
    conversionRequestId: row.conversionRequestId,
    conversionPlanVersionId: row.conversionPlanVersionId || null,
    opportunityId: row.opportunityId || null,
    acceptanceId: row.acceptanceId || null,
    inputHash: row.inputHash || null,
    idempotencyKey: row.idempotencyKey || null,
    closedWonAt: row.closedWonAt ? new Date(row.closedWonAt).toISOString() : null,
    closedWonRetained: row.closedWonRetained !== false,
    createdByAdminId: row.createdByAdminId || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    domain: getConversionDomainContract(),
  };
}

export function serializeConversionStep(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversionId: row.conversionId,
    stepCode: row.stepCode,
    stepOrder: row.stepOrder,
    status: row.status,
    inputHash: row.inputHash || null,
    attemptCount: row.attemptCount ?? 0,
    outputJson: row.outputJson ?? null,
    errorCode: row.errorCode || null,
    retryable: row.retryable === true,
    compensationState: row.compensationState || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}
