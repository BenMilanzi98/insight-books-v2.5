/**
 * Commercial approval engine — Phase 15 Wave 2.
 * SoD: requester ≠ protected approver. Material change invalidates approvals.
 */

import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  CRM_APPROVAL_REQUEST_STATUS,
  CRM_APPROVAL_STEP_STATUS,
} from './catalogue.js';
import {
  hasCrmApprovalDecisionModel,
  hasCrmApprovalPolicyModel,
  hasCrmApprovalRequestModel,
  hasCrmApprovalStepModel,
  resolveCommercialActor,
  serializeApprovalRequest,
  serializeApprovalStep,
} from './model.js';

function canEdit(access) {
  return access.canEditOpportunities || access.canEditLeads || access.canCreateLeads;
}

function canApprove(access) {
  return access.canApproveMerge || access.canEditOpportunities || access.isSuperAdmin;
}

function parseStepsJson(policy) {
  const raw = policy?.stepsJson;
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * submitCommercialDocumentForApproval({
 *   actorContext, commercialDocumentVersionId, approvalPolicyVersionId, idempotencyKey
 * })
 */
export async function submitCommercialDocumentForApproval(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEdit(access)) {
    return { ok: false, forbidden: true, reason: 'crm_approval_submit_forbidden' };
  }
  if (
    !hasCrmApprovalRequestModel(prisma) ||
    !hasCrmApprovalStepModel(prisma) ||
    !hasCrmApprovalPolicyModel(prisma)
  ) {
    return { ok: false, error: 'crm_approval_model_unavailable', status: 'UNAVAILABLE' };
  }

  const documentVersionId = String(args.commercialDocumentVersionId || '').trim();
  const policyId = String(args.approvalPolicyVersionId || args.approvalPolicyId || '').trim();
  const idempotencyKey = args.idempotencyKey != null ? String(args.idempotencyKey).trim() : '';

  if (!documentVersionId || !policyId) {
    return { ok: false, error: 'approval_required_fields_missing' };
  }

  if (idempotencyKey) {
    const existing = await prisma.crmApprovalRequest.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      const steps = await prisma.crmApprovalStep.findMany({
        where: { approvalRequestId: existing.id },
      });
      return {
        ok: true,
        alreadyExists: true,
        request: serializeApprovalRequest(existing),
        steps: steps.map(serializeApprovalStep),
      };
    }
  }

  const policy = await prisma.crmApprovalPolicy.findUnique({ where: { id: policyId } });
  if (!policy) return { ok: false, notFound: true, error: 'approval_policy_not_found' };

  const now = args.now || new Date();
  const request = await prisma.crmApprovalRequest.create({
    data: {
      documentVersionId,
      approvalPolicyId: policy.id,
      status: CRM_APPROVAL_REQUEST_STATUS.PENDING,
      requestedByAdminId: admin?.id || null,
      idempotencyKey: idempotencyKey || null,
      materialFingerprint: args.materialFingerprint || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const stepDefs = parseStepsJson(policy);
  const defs = stepDefs.length
    ? stepDefs
    : [{ stepOrder: 1, role: 'approver', protected: true }];

  const steps = [];
  for (const def of defs) {
    const step = await prisma.crmApprovalStep.create({
      data: {
        approvalRequestId: request.id,
        stepOrder: Number(def.stepOrder) || steps.length + 1,
        role: def.role || 'approver',
        protected: def.protected !== false,
        status: CRM_APPROVAL_STEP_STATUS.PENDING,
        createdAt: now,
        updatedAt: now,
      },
    });
    steps.push(step);
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: documentVersionId,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_APPROVAL_SUBMITTED,
    summary: 'Commercial document submitted for approval',
    payload: { approvalRequestId: request.id, documentVersionId },
    actorAdminId: admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    request: serializeApprovalRequest(request),
    steps: steps.map(serializeApprovalStep),
  };
}

/**
 * decideApprovalStep — SoD: requester ≠ protected approver
 */
export async function decideApprovalStep(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canApprove(access)) {
    return { ok: false, forbidden: true, reason: 'crm_approval_decide_forbidden' };
  }
  if (
    !hasCrmApprovalStepModel(prisma) ||
    !hasCrmApprovalRequestModel(prisma) ||
    !hasCrmApprovalDecisionModel(prisma)
  ) {
    return { ok: false, error: 'crm_approval_model_unavailable', status: 'UNAVAILABLE' };
  }

  const step = await prisma.crmApprovalStep.findUnique({
    where: { id: String(args.approvalStepId || '').trim() },
  });
  if (!step) return { ok: false, notFound: true, error: 'approval_step_not_found' };

  const request = await prisma.crmApprovalRequest.findUnique({
    where: { id: step.approvalRequestId },
  });
  if (!request) return { ok: false, notFound: true, error: 'approval_request_not_found' };

  if (String(request.status).toUpperCase() === CRM_APPROVAL_REQUEST_STATUS.INVALIDATED) {
    return { ok: false, error: 'approval_request_invalidated' };
  }
  if (String(request.status).toUpperCase() === CRM_APPROVAL_REQUEST_STATUS.APPROVED) {
    return { ok: true, alreadyExists: true, request: serializeApprovalRequest(request) };
  }

  const decision = String(args.decision || '').trim().toUpperCase();
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return { ok: false, error: 'invalid_approval_decision' };
  }

  const approverId = admin?.id ? String(admin.id) : '';
  const requesterId = request.requestedByAdminId ? String(request.requestedByAdminId) : '';
  if (step.protected !== false && requesterId && approverId && requesterId === approverId) {
    return {
      ok: false,
      error: 'self_approval_blocked',
      reason: 'sod_requester_must_differ_from_approver',
    };
  }

  const now = args.now || new Date();
  const stepStatus =
    decision === 'APPROVE'
      ? CRM_APPROVAL_STEP_STATUS.APPROVED
      : CRM_APPROVAL_STEP_STATUS.REJECTED;

  await prisma.crmApprovalStep.update({
    where: { id: step.id },
    data: { status: stepStatus, decidedAt: now, updatedAt: now },
  });

  await prisma.crmApprovalDecision.create({
    data: {
      approvalRequestId: request.id,
      approvalStepId: step.id,
      decision,
      reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
      decidedByAdminId: approverId || null,
      at: now,
      createdAt: now,
    },
  });

  let requestStatus = request.status;
  if (decision === 'REJECT') {
    requestStatus = CRM_APPROVAL_REQUEST_STATUS.REJECTED;
  } else {
    const allSteps = await prisma.crmApprovalStep.findMany({
      where: { approvalRequestId: request.id },
    });
    const allApproved = allSteps.every(
      (s) =>
        s.id === step.id ||
        String(s.status).toUpperCase() === CRM_APPROVAL_STEP_STATUS.APPROVED ||
        String(s.status).toUpperCase() === CRM_APPROVAL_STEP_STATUS.SKIPPED
    );
    // current step already updated above; re-check including it
    const pendingLeft = allSteps.filter((s) => {
      if (s.id === step.id) return false;
      return String(s.status).toUpperCase() === CRM_APPROVAL_STEP_STATUS.PENDING;
    });
    if (pendingLeft.length === 0 && allApproved) {
      requestStatus = CRM_APPROVAL_REQUEST_STATUS.APPROVED;
    } else if (pendingLeft.length === 0) {
      requestStatus = CRM_APPROVAL_REQUEST_STATUS.APPROVED;
    }
  }

  const updated = await prisma.crmApprovalRequest.update({
    where: { id: request.id },
    data: { status: requestStatus, updatedAt: now },
  });

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
    subjectId: request.documentVersionId,
    eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_APPROVAL_DECIDED,
    summary: `Commercial approval ${decision}`,
    payload: {
      approvalRequestId: request.id,
      stepId: step.id,
      decision,
      status: requestStatus,
    },
    actorAdminId: approverId || null,
    at: now,
  });

  return {
    ok: true,
    request: serializeApprovalRequest(updated),
    step: serializeApprovalStep({ ...step, status: stepStatus }),
  };
}

/**
 * Material change (e.g. qty) after approval → invalidate affected approval requests.
 */
export async function applyMaterialDocumentChange(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!canEdit(access)) {
    return { ok: false, forbidden: true, reason: 'crm_material_change_forbidden' };
  }
  if (!hasCrmApprovalRequestModel(prisma)) {
    return { ok: false, error: 'crm_approval_model_unavailable', status: 'UNAVAILABLE' };
  }

  const documentVersionId = String(args.commercialDocumentVersionId || '').trim();
  if (!documentVersionId) {
    return { ok: false, error: 'document_version_required' };
  }

  const change = args.change && typeof args.change === 'object' ? args.change : {};
  const isMaterial =
    change.quantity != null ||
    change.lineItems != null ||
    change.currency != null ||
    change.discountPercent != null ||
    args.material === true;

  if (!isMaterial) {
    return { ok: true, material: false, invalidatedApprovalIds: [] };
  }

  const now = args.now || new Date();
  const reason =
    args.reason != null
      ? String(args.reason).trim().slice(0, 1000)
      : 'material_change_invalidates_approval';

  const affected = await prisma.crmApprovalRequest.findMany({
    where: { documentVersionId },
  });

  // Filter statuses that should be invalidated
  const toInvalidate = (affected || []).filter((r) => {
    const s = String(r.status || '').toUpperCase();
    return (
      s === CRM_APPROVAL_REQUEST_STATUS.APPROVED ||
      s === CRM_APPROVAL_REQUEST_STATUS.PENDING
    );
  });

  const invalidatedApprovalIds = [];
  for (const row of toInvalidate) {
    await prisma.crmApprovalRequest.update({
      where: { id: row.id },
      data: {
        status: CRM_APPROVAL_REQUEST_STATUS.INVALIDATED,
        invalidatedReason: reason,
        invalidatedAt: now,
        updatedAt: now,
      },
    });
    invalidatedApprovalIds.push(row.id);
  }

  // Persist material change hint on document version content when available
  if (typeof prisma.crmCommercialDocumentVersion?.update === 'function') {
    try {
      const ver = await prisma.crmCommercialDocumentVersion.findUnique({
        where: { id: documentVersionId },
      });
      if (ver) {
        const content =
          ver.contentJson && typeof ver.contentJson === 'object' ? { ...ver.contentJson } : {};
        content.materialChange = {
          ...change,
          at: now.toISOString(),
          reason,
        };
        await prisma.crmCommercialDocumentVersion.update({
          where: { id: documentVersionId },
          data: { contentJson: content, updatedAt: now },
        });
      }
    } catch {
      // best-effort
    }
  }

  if (invalidatedApprovalIds.length) {
    await appendTimelineEvent(prisma, {
      subjectType: CRM_SUBJECT_TYPE.ACCOUNT,
      subjectId: documentVersionId,
      eventType: CRM_TIMELINE_EVENT_TYPE.COMMERCIAL_APPROVAL_INVALIDATED,
      summary: 'Commercial approvals invalidated by material change',
      payload: { documentVersionId, invalidatedApprovalIds, change },
      actorAdminId: admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    material: true,
    invalidatedApprovalIds,
    reason,
  };
}

export async function listCommercialApprovals(prisma, args = {}) {
  const admin = resolveCommercialActor(args);
  const access = resolveCrmAccess(admin);
  if (!(access.canViewOpportunities || access.canView || access.isSuperAdmin)) {
    return { ok: false, forbidden: true };
  }
  if (!hasCrmApprovalRequestModel(prisma)) {
    return { ok: false, error: 'crm_approval_model_unavailable', status: 'UNAVAILABLE' };
  }
  const where = {};
  if (args.documentVersionId) where.documentVersionId = String(args.documentVersionId);
  if (args.status) where.status = String(args.status);
  const rows = await prisma.crmApprovalRequest.findMany({ where });
  return { ok: true, approvals: rows.map(serializeApprovalRequest) };
}
