/**
 * Server-authoritative onboarding progress — versioned rules; progress ≠ completion.
 */

import { loadOnboardingProjectForActor } from './projectAccess.js';
import { getOnboardingDomainContract } from './catalogue.js';

export const PROGRESS_RULES_VERSION = 'onboarding-progress-v1';

export async function calculateOnboardingProgress(prisma, args = {}) {
  const loaded = await loadOnboardingProjectForActor(prisma, args);
  if (!loaded.ok) return loaded;

  let required = 0;
  let done = 0;

  if (typeof prisma?.customerOnboardingTask?.findMany === 'function') {
    const tasks = await prisma.customerOnboardingTask.findMany({
      where: { projectId: loaded.project.id },
    });
    for (const t of tasks || []) {
      const status = String(t.status || '').toUpperCase();
      if (status === 'NOT_APPLICABLE' || status === 'CANCELLED') continue;
      required += 1;
      if (status === 'COMPLETED' || status === 'WAIVED') done += 1;
    }
  }

  if (typeof prisma?.customerOnboardingMilestone?.findMany === 'function') {
    const milestones = await prisma.customerOnboardingMilestone.findMany({
      where: { projectId: loaded.project.id },
    });
    for (const m of milestones || []) {
      if (m.required === false) continue;
      const status = String(m.status || '').toUpperCase();
      if (status === 'NOT_APPLICABLE') continue;
      required += 1;
      if (status === 'COMPLETED' || status === 'DONE') done += 1;
    }
  }

  // When no materialised items, use coarse status weight (never invent 100% complete)
  if (required === 0) {
    const statusWeights = {
      DRAFT: 5,
      READY_FOR_KICKOFF: 10,
      KICKOFF_COMPLETED: 20,
      PLANNING: 25,
      IN_PROGRESS: 40,
      GO_LIVE_READINESS: 55,
      READY_FOR_GO_LIVE: 65,
      GO_LIVE_IN_PROGRESS: 75,
      LIVE: 80,
      STABILISATION: 85,
      HANDOVER_PENDING: 90,
      COMPLETION_PENDING: 95,
      COMPLETED: 100,
      COMPLETED_WITH_OPEN_ITEMS: 98,
    };
    const st = String(loaded.project.status || 'DRAFT').toUpperCase();
    const percent = Math.min(100, Math.max(0, statusWeights[st] ?? 0));
    return {
      ok: true,
      projectId: loaded.project.id,
      percent,
      required: 0,
      completed: 0,
      rulesVersion: PROGRESS_RULES_VERSION,
      // Progress % is never readiness, completion, or adoption.
      complete: false,
      isComplete: false,
      isReadiness: false,
      isAdoption: false,
      domain: getOnboardingDomainContract(),
    };
  }

  const percent = Math.min(100, Math.round((done / required) * 100));
  return {
    ok: true,
    projectId: loaded.project.id,
    percent,
    required,
    completed: done,
    rulesVersion: PROGRESS_RULES_VERSION,
    // Progress % is never readiness, completion, or adoption.
    complete: false,
    isComplete: false,
    isReadiness: false,
    isAdoption: false,
    domain: getOnboardingDomainContract(),
  };
}
