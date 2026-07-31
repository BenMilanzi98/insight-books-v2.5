import {
  applyApprovalDecision,
  buildApprovalRequest,
  computeApprovalPayloadChecksum,
  invalidateIfStale,
} from '../domain/approvalEngine.js';
import { ApprovalDecisionType } from '../domain/enums.js';
import { appendAuditEvent } from './auditService.js';
import { AUDIT_EVENT_TYPES } from '../domain/enums.js';

export async function createApprovalPolicy(db, context, input = {}) {
  const businessId = context.businessId;
  return db.secV2ApprovalPolicy.create({
    data: {
      businessId,
      policyCode: input.policyCode,
      policyName: input.policyName || input.policyCode,
      module: input.module,
      action: input.action,
      status: 'DRAFT',
      createdBy: context.effectiveUserId || context.actorId,
      metadata: input.metadata || null,
    },
  });
}

export async function publishApprovalPolicyVersion(db, context, policyId, versionInput = {}) {
  const businessId = context.businessId;
  const policy = await db.secV2ApprovalPolicy.findFirst({ where: { id: policyId, businessId } });
  if (!policy) throw new Error('Approval policy not found for business.');

  const latest = await db.secV2ApprovalPolicyVersion.findFirst({
    where: { policyId, businessId },
    orderBy: { version: 'desc' },
  });
  const version = (latest?.version || 0) + 1;

  const published = await db.secV2ApprovalPolicyVersion.create({
    data: {
      businessId,
      policyId,
      version,
      status: 'PUBLISHED',
      approvalMode: versionInput.approvalMode || 'SEQUENTIAL',
      minimumApprovers: versionInput.minimumApprovers || 1,
      selfApprovalAllowed: Boolean(versionInput.selfApprovalAllowed),
      mfaRequired: Boolean(versionInput.mfaRequired),
      expiryHours: versionInput.expiryHours || 72,
      thresholdAmountMinor: BigInt(versionInput.thresholdAmountMinor || 0),
      currency: versionInput.currency || 'MWK',
      routeSnapshot: versionInput.routeSnapshot || [],
      conditionSet: versionInput.conditionSet || null,
      publishedBy: context.effectiveUserId || context.actorId,
      publishedAt: new Date(),
    },
  });

  await db.secV2ApprovalPolicy.update({
    where: { id: policyId },
    data: { status: 'ACTIVE', currentVersion: version },
  });

  return published;
}

export async function submitApprovalRequest(db, context, input = {}) {
  const businessId = context.businessId;
  const policy = await db.secV2ApprovalPolicy.findFirst({
    where: {
      businessId,
      module: input.module,
      action: input.action,
      status: 'ACTIVE',
    },
  });
  let policyVersion = null;
  if (policy) {
    policyVersion = await db.secV2ApprovalPolicyVersion.findFirst({
      where: { policyId: policy.id, businessId, status: 'PUBLISHED' },
      orderBy: { version: 'desc' },
    });
  }

  const built = buildApprovalRequest({
    businessId,
    policyId: policy?.id || null,
    policyVersion: policyVersion
      ? {
          version: policyVersion.version,
          status: 'PUBLISHED',
          approvalMode: policyVersion.approvalMode,
          minimumApprovers: policyVersion.minimumApprovers,
          selfApprovalAllowed: policyVersion.selfApprovalAllowed,
          mfaRequired: policyVersion.mfaRequired,
          expiryHours: policyVersion.expiryHours,
          thresholdAmountMinor: policyVersion.thresholdAmountMinor,
          currency: policyVersion.currency,
          routeSnapshot: policyVersion.routeSnapshot,
        }
      : { status: 'PUBLISHED', version: 0, selfApprovalAllowed: false, minimumApprovers: 1, expiryHours: 72 },
    sourceModule: input.sourceModule || input.module,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceNumber: input.sourceNumber,
    action: input.action,
    amountMinor: input.amountMinor || 0,
    currency: input.currency || 'MWK',
    riskLevel: input.riskLevel,
    requestedBy: context.effectiveUserId || context.actorId,
    payload: input.payload || {},
    correlationId: context.correlationId,
  });

  const row = await db.secV2ApprovalRequest.create({
    data: {
      businessId,
      policyId: built.policyId,
      policyVersion: built.policyVersion,
      sourceModule: built.sourceModule,
      sourceType: built.sourceType,
      sourceId: built.sourceId,
      sourceNumber: built.sourceNumber,
      action: built.action,
      amountMinor: BigInt(built.amountMinor || 0),
      currency: built.currency,
      riskLevel: built.riskLevel,
      status: built.status,
      currentStep: built.currentStep,
      requestedBy: built.requestedBy,
      requestedAt: new Date(built.requestedAt),
      expiresAt: new Date(built.expiresAt),
      payloadChecksum: built.payloadChecksum,
      sourceVersion: built.sourceVersion ? String(built.sourceVersion) : null,
      correlationId: built.correlationId,
      routeSnapshot: built.routeSnapshot,
      metadata: { requirement: built.requirement },
    },
  });

  await appendAuditEvent(db, {
    eventType: AUDIT_EVENT_TYPES.APPROVAL_REQUESTED,
    businessId,
    actor: context,
    sourceModule: built.sourceModule,
    sourceType: built.sourceType,
    sourceId: built.sourceId,
    action: built.action,
    outcome: 'SUCCESS',
    approvalReference: row.id,
  });

  return row;
}

export async function decideApprovalRequest(db, context, requestId, { decision, reason, currentPayload } = {}) {
  const businessId = context.businessId;
  const row = await db.secV2ApprovalRequest.findFirst({
    where: { id: requestId, businessId },
    include: { decisions: true },
  });
  if (!row) throw new Error('Approval request not found.');

  let working = {
    ...row,
    amountMinor: String(row.amountMinor),
    decisions: row.decisions || [],
    requirement: row.metadata?.requirement || {
      minimumApprovers: 1,
      mode: 'SEQUENTIAL',
      selfApprovalAllowed: false,
    },
    selfApprovalAllowed: false,
  };

  if (currentPayload) {
    working = invalidateIfStale(working, currentPayload);
    if (working.status === 'INVALIDATED') {
      await db.secV2ApprovalRequest.update({
        where: { id: row.id },
        data: { status: 'INVALIDATED', metadata: { ...(row.metadata || {}), invalidation: working } },
      });
      await appendAuditEvent(db, {
        eventType: AUDIT_EVENT_TYPES.APPROVAL_INVALIDATED,
        businessId,
        actor: context,
        sourceId: row.sourceId,
        approvalReference: row.id,
        outcome: 'SUCCESS',
      });
      return working;
    }
  }

  const applied = applyApprovalDecision(working, {
    decision: decision || ApprovalDecisionType.APPROVE,
    reason,
    approverId: context.effectiveUserId || context.actorId,
    effectiveApproverId: context.effectiveUserId || context.actorId,
    currentPayloadChecksum: currentPayload
      ? computeApprovalPayloadChecksum(currentPayload)
      : row.payloadChecksum,
    requestId: context.requestId,
    correlationId: context.correlationId,
  });

  await db.secV2ApprovalDecision.create({
    data: {
      businessId,
      approvalRequestId: row.id,
      step: applied.decision.step,
      approverId: applied.decision.approverId,
      effectiveApproverId: applied.decision.effectiveApproverId,
      delegatedFromId: applied.decision.delegatedFromId,
      decision: applied.decision.decision,
      reason: applied.decision.reason,
      sourceChecksum: applied.decision.sourceChecksum,
      requestId: applied.decision.requestId,
      correlationId: applied.decision.correlationId,
      decisionAt: new Date(applied.decision.decisionAt),
      metadata: { immutable: true },
    },
  });

  const updated = await db.secV2ApprovalRequest.update({
    where: { id: row.id },
    data: {
      status: applied.request.status,
      currentStep: applied.request.currentStep,
    },
    include: { decisions: true },
  });

  await appendAuditEvent(db, {
    eventType:
      decision === ApprovalDecisionType.REJECT
        ? AUDIT_EVENT_TYPES.APPROVAL_REJECTED
        : AUDIT_EVENT_TYPES.APPROVAL_APPROVED,
    businessId,
    actor: context,
    sourceId: row.sourceId,
    approvalReference: row.id,
    outcome: 'SUCCESS',
  });

  return updated;
}
