/**
 * Onboarding tasks — create/assign/complete with Customer evidence gate.
 */

import {
  ONBOARDING_EVIDENCE_STATUS,
  ONBOARDING_TASK_ACTOR_TYPE,
  ONBOARDING_TASK_STATUS,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTaskModel,
  hasCustomerOnboardingProjectModel,
  resolveOnboardingActor,
  serializeOnboardingTask,
} from './model.js';

export async function createOnboardingTask(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_task_create_forbidden' };
  }
  if (!hasCustomerOnboardingProjectModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_project_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingTaskModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };

  const project = await prisma.customerOnboardingProject.findUnique({
    where: { id: projectId },
  });
  if (!project) return { ok: false, error: 'project_not_found' };

  const now = args.now || new Date();
  const actorType = String(args.actorType || ONBOARDING_TASK_ACTOR_TYPE.INTERNAL)
    .trim()
    .toUpperCase();
  const code = String(args.code || args.name || `TASK_${Date.now()}`)
    .trim()
    .toUpperCase();

  const row = await prisma.customerOnboardingTask.create({
    data: {
      projectId,
      workstreamId: args.workstreamId || null,
      code,
      name: args.name || code,
      actorType,
      assigneeAdminId: args.assigneeAdminId || null,
      assigneeContactId: args.assigneeContactId || null,
      sequence: args.sequence != null ? Number(args.sequence) : 0,
      status: ONBOARDING_TASK_STATUS.OPEN,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    task: serializeOnboardingTask(row),
    created: true,
    domain: getOnboardingDomainContract(),
  };
}

async function hasApprovedEvidence(prisma, taskId) {
  if (typeof prisma.customerOnboardingTaskEvidence?.findFirst !== 'function') {
    return false;
  }
  const approved = await prisma.customerOnboardingTaskEvidence.findFirst({
    where: { taskId, status: ONBOARDING_EVIDENCE_STATUS.APPROVED },
  });
  return Boolean(approved);
}

/**
 * Complete task. Customer/Shared tasks require approved evidence or authorised waiver.
 */
export async function completeOnboardingTask(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_task_complete_forbidden' };
  }
  if (!hasCustomerOnboardingTaskModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const taskId = args.taskId ? String(args.taskId).trim() : '';
  if (!taskId) return { ok: false, error: 'taskId_required' };

  const task = await prisma.customerOnboardingTask.findUnique({
    where: { id: taskId },
  });
  if (!task) return { ok: false, error: 'task_not_found' };

  const actorType = String(task.actorType || '').toUpperCase();
  const needsEvidence =
    actorType === ONBOARDING_TASK_ACTOR_TYPE.CUSTOMER ||
    actorType === ONBOARDING_TASK_ACTOR_TYPE.SHARED;

  const waiverAuthorised =
    args.authorisedWaiver === true &&
    args.waiverReason &&
    String(args.waiverReason).trim().length > 0;

  if (needsEvidence) {
    const approved = await hasApprovedEvidence(prisma, taskId);
    if (!approved && !waiverAuthorised) {
      return {
        ok: false,
        error: 'customer_task_requires_evidence_or_authorised_waiver',
        domain: getOnboardingDomainContract(),
      };
    }
  }

  const now = args.now || new Date();
  const completionSource = waiverAuthorised
    ? 'AUTHORISED_WAIVER'
    : args.completionSource ||
      (needsEvidence ? 'CUSTOMER_EVIDENCE_APPROVED' : 'INTERNAL_COMPLETION');

  const updated = await prisma.customerOnboardingTask.update({
    where: { id: taskId },
    data: {
      status: waiverAuthorised
        ? ONBOARDING_TASK_STATUS.WAIVED
        : ONBOARDING_TASK_STATUS.COMPLETED,
      completionSource,
      waiverReason: waiverAuthorised ? String(args.waiverReason).trim() : null,
      completedAt: now,
      completedByAdminId: admin?.id || null,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    task: serializeOnboardingTask(updated),
    domain: getOnboardingDomainContract(),
  };
}
