/**
 * Typed Training outcome → Phase 17 onboarding coordination — Phase 18 Wave 3.
 * Sets trainingDomainSource / trainingDomainStatus; does NOT mark onboarding Project COMPLETED.
 */

import { getTrainingDomainContract } from './catalogue.js';
import {
  canManageTraining,
  resolveTrainingActor,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';
import { evaluateProgramCompletion } from './completion.js';
import {
  setTrainingCoordinationStatus,
  TRAINING_COORD_STATUS,
} from '../onboarding/training.js';

/** Prefer Phase 22 Training source; PHASE_18 retained as alias in onboarding accept set. */
const DOMAIN_SOURCE = 'PHASE_22_TRAINING';

/**
 * Publish authoritative Training-domain outcome into Phase 17 coordination row.
 */
export async function publishTrainingOutcomeToOnboarding(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_onboarding_feed_forbidden' };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!programId) return { ok: false, error: 'programId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const program = access.programRow || access.program;
  const projectId = program.onboardingProjectId
    ? String(program.onboardingProjectId).trim()
    : '';
  if (!projectId) {
    return { ok: false, error: 'onboarding_project_not_linked' };
  }

  const programCompletion = await evaluateProgramCompletion(prisma, {
    ...args,
    programId,
  });
  if (!programCompletion.ok) return programCompletion;

  // Honest aggregate only — never OR participantCompletedCount; never collapse WITH_GAPS → COMPLETED.
  const domainStatus =
    programCompletion.status === 'COMPLETED'
      ? 'COMPLETED'
      : programCompletion.status === 'COMPLETED_WITH_GAPS'
        ? 'COMPLETED_WITH_GAPS'
        : 'IN_PROGRESS';

  const coordStatus =
    domainStatus === 'COMPLETED'
      ? TRAINING_COORD_STATUS.COMPLETED
      : domainStatus === 'COMPLETED_WITH_GAPS'
        ? TRAINING_COORD_STATUS.READY
        : TRAINING_COORD_STATUS.IN_PROGRESS;

  // Capture project status before feed — must remain unchanged for COMPLETED auto-flip.
  let projectBefore = null;
  if (typeof prisma.customerOnboardingProject?.findUnique === 'function') {
    projectBefore = await prisma.customerOnboardingProject.findUnique({
      where: { id: projectId },
    });
  }

  const fed = await setTrainingCoordinationStatus(prisma, {
    actorContext: args.actorContext || { admin },
    admin,
    projectId,
    status: coordStatus,
    trainingDomainSource: DOMAIN_SOURCE,
    trainingDomainStatus: domainStatus,
    sourceDomain: DOMAIN_SOURCE,
    now: args.now,
  });

  if (!fed.ok) return fed;

  let projectAfter = projectBefore;
  if (typeof prisma.customerOnboardingProject?.findUnique === 'function') {
    projectAfter = await prisma.customerOnboardingProject.findUnique({
      where: { id: projectId },
    });
  }

  // Hard rule: never mutate onboarding Project to COMPLETED from this feed.
  if (
    projectBefore &&
    projectAfter &&
    projectBefore.status !== 'COMPLETED' &&
    projectAfter.status === 'COMPLETED'
  ) {
    await prisma.customerOnboardingProject.update({
      where: { id: projectId },
      data: { status: projectBefore.status, updatedAt: args.now || new Date() },
    });
    projectAfter = { ...projectAfter, status: projectBefore.status };
  }

  return {
    ok: true,
    training: fed.training,
    onboardingProjectCompleted: false,
    projectStatus: projectAfter?.status || null,
    programCompletionStatus: programCompletion.status,
    idempotencyKey,
    domain: getTrainingDomainContract(),
  };
}
