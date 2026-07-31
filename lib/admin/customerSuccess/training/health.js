/**
 * Training Health — Phase 18 Wave 3 (versioned; distinct from Customer Health).
 */

import {
  TRAINING_HEALTH_RULES_VERSION,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canViewTraining,
  canManageTraining,
  resolveTrainingActor,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

export async function calculateTrainingHealth(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'training_health_forbidden' };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) return { ok: false, error: 'programId_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const program = access.programRow || access.program;
  let status = 'NOT_ENOUGH_DATA';

  const participants =
    typeof prisma.customerTrainingParticipant?.findMany === 'function'
      ? await prisma.customerTrainingParticipant.findMany({ where: { programId } })
      : [];
  const sessions =
    typeof prisma.customerTrainingSession?.findMany === 'function'
      ? await prisma.customerTrainingSession.findMany({ where: { programId } })
      : [];
  const completions =
    typeof prisma.customerTrainingParticipantCompletion?.findMany === 'function'
      ? await prisma.customerTrainingParticipantCompletion.findMany({
          where: { programId },
        })
      : [];

  if (!participants.length && !sessions.length) {
    status = 'NOT_ENOUGH_DATA';
  } else if (String(program.status || '').includes('AT_RISK') || String(program.status || '') === 'BLOCKED') {
    status = 'AT_RISK';
  } else if (completions.some((c) => c.status === 'COMPLETED')) {
    status = 'HEALTHY';
  } else if (sessions.length || participants.length) {
    status = 'WATCH';
  } else {
    status = 'UNKNOWN';
  }

  return {
    ok: true,
    status,
    rulesVersion: TRAINING_HEALTH_RULES_VERSION,
    programId,
    domain: getTrainingDomainContract(),
  };
}
