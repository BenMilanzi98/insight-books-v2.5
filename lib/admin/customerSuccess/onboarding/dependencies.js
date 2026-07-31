/**
 * Task dependency graph — reject circular / self / cross-project links.
 */

import {
  ONBOARDING_DEPENDENCY_TYPE,
  getOnboardingDomainContract,
} from './catalogue.js';
import {
  canManageOnboarding,
  hasCustomerOnboardingTaskDependencyModel,
  hasCustomerOnboardingTaskModel,
  resolveOnboardingActor,
  serializeOnboardingTaskDependency,
} from './model.js';

async function wouldCreateCycle(prisma, projectId, predecessorTaskId, successorTaskId) {
  // DFS: if we can reach predecessor from successor via existing edges, adding pred→succ cycles.
  const edges = await prisma.customerOnboardingTaskDependency.findMany({
    where: { projectId },
  });
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.predecessorTaskId)) adj.set(e.predecessorTaskId, []);
    adj.get(e.predecessorTaskId).push(e.successorTaskId);
  }
  // Simulate adding edge predecessor → successor
  if (!adj.has(predecessorTaskId)) adj.set(predecessorTaskId, []);
  adj.get(predecessorTaskId).push(successorTaskId);

  const visited = new Set();
  const stack = [successorTaskId];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === predecessorTaskId) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const next of adj.get(cur) || []) {
      stack.push(next);
    }
  }
  return false;
}

export async function addOnboardingTaskDependency(prisma, args = {}) {
  const admin = resolveOnboardingActor(args);
  if (!canManageOnboarding(admin)) {
    return { ok: false, forbidden: true, reason: 'onboarding_dependency_forbidden' };
  }
  if (!hasCustomerOnboardingTaskModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerOnboardingTaskDependencyModel(prisma)) {
    return {
      ok: false,
      error: 'customer_onboarding_task_dependency_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const projectId = args.projectId ? String(args.projectId).trim() : '';
  const predecessorTaskId = args.predecessorTaskId
    ? String(args.predecessorTaskId).trim()
    : '';
  const successorTaskId = args.successorTaskId
    ? String(args.successorTaskId).trim()
    : '';
  if (!projectId) return { ok: false, error: 'projectId_required' };
  if (!predecessorTaskId || !successorTaskId) {
    return { ok: false, error: 'predecessor_and_successor_required' };
  }
  if (predecessorTaskId === successorTaskId) {
    return { ok: false, error: 'self_dependency_rejected' };
  }

  const pred = await prisma.customerOnboardingTask.findUnique({
    where: { id: predecessorTaskId },
  });
  const succ = await prisma.customerOnboardingTask.findUnique({
    where: { id: successorTaskId },
  });
  if (!pred || !succ) return { ok: false, error: 'task_not_found' };
  if (pred.projectId !== projectId || succ.projectId !== projectId) {
    return { ok: false, error: 'cross_project_dependency_rejected' };
  }

  const cyclic = await wouldCreateCycle(
    prisma,
    projectId,
    predecessorTaskId,
    successorTaskId
  );
  if (cyclic) {
    return { ok: false, error: 'circular_dependency_rejected' };
  }

  const dependencyType = String(
    args.dependencyType || ONBOARDING_DEPENDENCY_TYPE.FINISH_TO_START
  )
    .trim()
    .toUpperCase();
  const now = args.now || new Date();

  const row = await prisma.customerOnboardingTaskDependency.create({
    data: {
      projectId,
      predecessorTaskId,
      successorTaskId,
      dependencyType,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    dependency: serializeOnboardingTaskDependency(row),
    domain: getOnboardingDomainContract(),
  };
}
