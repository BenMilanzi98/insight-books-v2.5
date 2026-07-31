/**
 * Customer task evidence — admin-plane attestation.
 * Portal path reserved as CUSTOMER_PORTAL_NOT_CONFIGURED.
 */

import {
  CUSTOMER_PORTAL_NOT_CONFIGURED,
  ONBOARDING_EVIDENCE_STATUS,
  ONBOARDING_TASK_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTaskEvidenceModel,
  hasCustomerOnboardingTaskModel,
  resolveOnboardingActor,
  serializeOnboardingTaskEvidence,
} from './model.js';

/**
 * Submit Customer evidence via admin attestation (not customer portal).
 */
export async function submitCustomerTaskEvidence(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_evidence_forbidden' };
  }
  if (!hasCustomerOnboardingTaskModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingTaskEvidenceModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_evidence_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const taskId = args.taskId ? String(args.taskId).trim() : '';
  if (!taskId) return { ok: false, error: 'taskId_required' };

  const attestationReason = args.attestationReason
    ? String(args.attestationReason).trim()
    : '';
  if (!attestationReason) return { ok: false, error: 'attestationReason_required' };

  const task = await prisma.customerOnboardingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) return { ok: false, error: 'task_not_found' };

  const now = args.now || new Date();
  const evidence = await prisma.customerOnboardingTaskEvidence.create({
    data: {
      taskId,
      projectId: task.projectId,
      status: ONBOARDING_EVIDENCE_STATUS.EVIDENCE_SUBMITTED,
      fileRef: args.fileRef || null,
      note: args.note || null,
      contactId: args.contactId || null,
      attestedByAdminId: admin?.id || null,
      attestedAt: now,
      attestationReason,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  await prisma.customerOnboardingTask.update({
    where: { id: taskId },
    data: {
      status: ONBOARDING_TASK_STATUS.EVIDENCE_SUBMITTED,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    evidence: serializeOnboardingTaskEvidence(evidence),
    portalStatus: CUSTOMER_PORTAL_NOT_CONFIGURED,
    domain: getOnboardingDomainContract(),
  };
}

/**
 * Approve or reject evidence. Reject retains reviewReason.
 */
export async function reviewCustomerTaskEvidence(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_evidence_review_forbidden' };
  }
  if (!hasCustomerOnboardingTaskEvidenceModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_evidence_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const evidenceId = args.evidenceId ? String(args.evidenceId).trim() : '';
  if (!evidenceId) return { ok: false, error: 'evidenceId_required' };

  const decision = String(args.decision || '')
    .trim()
    .toUpperCase();
  if (decision !== 'APPROVE' && decision !== 'REJECT') {
    return { ok: false, error: 'decision_must_be_APPROVE_or_REJECT' };
  }

  const evidence = await prisma.customerOnboardingTaskEvidence.findUnique({
    where: { id: evidenceId },
  });
  if (!evidence) return { ok: false, error: 'evidence_not_found' };

  const reason = args.reason ? String(args.reason).trim() : '';
  if (decision === 'REJECT' && !reason) {
    return { ok: false, error: 'reject_reason_required' };
  }

  const now = args.now || new Date();
  const status =
    decision === 'APPROVE'
      ? ONBOARDING_EVIDENCE_STATUS.APPROVED
      : ONBOARDING_EVIDENCE_STATUS.REJECTED;

  const updated = await prisma.customerOnboardingTaskEvidence.update({
    where: { id: evidenceId },
    data: {
      status,
      reviewDecision: decision,
      reviewReason: reason || null,
      rejectReason: decision === 'REJECT' ? reason : null,
      reviewedByAdminId: admin?.id || null,
      reviewedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    evidence: serializeOnboardingTaskEvidence(updated),
    portalStatus: CUSTOMER_PORTAL_NOT_CONFIGURED,
    domain: getOnboardingDomainContract(),
  };
}
