/**
 * Training Trainers / Assignments — Phase 22 Wave 2.
 * Qualification / conflict checks; BLOCKED requires approved exception only.
 */

import {
  TRAINING_CONFLICT_STATE,
  getTrainingDomainContract,
} from './catalogue.js';
import { evaluateTrainingConflicts } from './conflicts.js';
import {
  canManageTraining,
  hasCustomerTrainingSessionModel,
  hasCustomerTrainingTrainerAssignmentModel,
  hasCustomerTrainingTrainerModel,
  resolveTrainingActor,
  serializeTrainingTrainer,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function asList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v));
  if (value == null || value === '') return [];
  return [String(value)];
}

function hasSkill(trainer, requiredSkills = []) {
  if (!requiredSkills.length) return true;
  const skills = asList(trainer.skillsJson);
  return requiredSkills.every((s) => skills.includes(String(s)));
}

function hasLanguage(trainer, requiredLanguage) {
  if (!requiredLanguage) return true;
  const langs = asList(trainer.languagesJson);
  return langs.includes(String(requiredLanguage));
}

function hasApprovedException(args = {}) {
  return args.approvedException === true || args.allowBlockedConflict === true;
}

/**
 * Assign a Trainer to a Session with competence + conflict checks.
 */
export async function assignTrainingTrainer(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_trainer_assign_forbidden' };
  }
  if (!hasCustomerTrainingTrainerModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_trainer_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerTrainingTrainerAssignmentModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_trainer_assignment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_session_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  const trainerId = args.trainerId ? String(args.trainerId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };
  if (!sessionId) return { ok: false, error: 'sessionId_required' };
  if (!trainerId) return { ok: false, error: 'trainerId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const existing = await prisma.customerTrainingTrainerAssignment.findFirst({
    where: { sessionId, trainerId },
  });
  if (existing) {
    return {
      ok: true,
      assignment: existing,
      alreadyExists: true,
      idempotentReplay: true,
      conflictState: existing.conflictState || TRAINING_CONFLICT_STATE.NO_CONFLICT,
      approvedException: existing.approvedException === true,
      domain: getTrainingDomainContract(),
    };
  }

  const trainer = await prisma.customerTrainingTrainer.findUnique({
    where: { id: trainerId },
  });
  if (!trainer) return { ok: false, error: 'trainer_not_found', notFound: true };

  const session = await prisma.customerTrainingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return { ok: false, error: 'session_not_found', notFound: true };

  const requiredSkills = asList(args.requiredSkills);
  const requiredLanguage = args.requiredLanguage
    ? String(args.requiredLanguage).trim()
    : null;

  if (!hasSkill(trainer, requiredSkills)) {
    return {
      ok: false,
      error: 'trainer_skill_qualification_mismatch',
      conflictState: TRAINING_CONFLICT_STATE.BLOCKED,
    };
  }
  if (!hasLanguage(trainer, requiredLanguage)) {
    return {
      ok: false,
      error: 'trainer_language_qualification_mismatch',
      conflictState: TRAINING_CONFLICT_STATE.BLOCKED,
    };
  }

  const evaluation = await evaluateTrainingConflicts(prisma, {
    actorContext: args.actorContext,
    admin,
    sessionId,
    trainerId,
  });
  if (!evaluation.ok) return evaluation;

  const conflictState = evaluation.conflictState;
  // UNKNOWN is not clear — same as BLOCKED / APPROVAL_REQUIRED (Spec §8 / G22-12).
  const needsException =
    conflictState === TRAINING_CONFLICT_STATE.BLOCKED ||
    conflictState === TRAINING_CONFLICT_STATE.APPROVAL_REQUIRED ||
    conflictState === TRAINING_CONFLICT_STATE.UNKNOWN;

  if (needsException && !hasApprovedException(args)) {
    return {
      ok: false,
      error:
        conflictState === TRAINING_CONFLICT_STATE.UNKNOWN
          ? 'trainer_conflict_UNKNOWN_requires_approved_exception'
          : 'trainer_overlap_blocked',
      conflictState,
      reasons: evaluation.reasons,
      note: 'Conflict / UNKNOWN assignment requires approvedException (approved exception only)',
      domain: getTrainingDomainContract(),
    };
  }

  if (needsException && hasApprovedException(args)) {
    const reason = args.exceptionReason
      ? String(args.exceptionReason).trim()
      : '';
    // Tree Wave2 uses allowBlockedConflict without reason — accept alias without forcing reason.
    if (
      args.approvedException === true &&
      !reason &&
      args.allowBlockedConflict !== true
    ) {
      return {
        ok: false,
        error: 'exception_reason_required',
        conflictState,
      };
    }
  }

  const maxConcurrent = Number(
    trainer.maxConcurrentAssignments ??
      trainer.capacity ??
      (trainer.skillsJson && trainer.skillsJson.maxConcurrentAssignments)
  );
  // Capacity hard gate: conflict-exception flags must NOT bypass capacity when
  // there is no conflict needing exception (NO_CONFLICT / WARNING).
  const governedConflictException =
    needsException && hasApprovedException(args);
  if (
    Number.isFinite(maxConcurrent) &&
    maxConcurrent >= 1 &&
    !governedConflictException
  ) {
    const active = await prisma.customerTrainingTrainerAssignment.findMany({
      where: { trainerId },
    });
    if (active.length >= maxConcurrent) {
      return {
        ok: false,
        error: 'trainer_capacity_exceeded',
        capacity: maxConcurrent,
        conflictState:
          conflictState === TRAINING_CONFLICT_STATE.NO_CONFLICT
            ? TRAINING_CONFLICT_STATE.BLOCKED
            : conflictState,
      };
    }
  }

  const now = args.now || new Date();
  const approvedException = needsException && hasApprovedException(args);
  const assignment = await prisma.customerTrainingTrainerAssignment.create({
    data: {
      programId,
      sessionId,
      trainerId,
      conflictState,
      approvedException,
      exceptionReason: approvedException
        ? args.exceptionReason
          ? String(args.exceptionReason).trim()
          : 'allowBlockedConflict'
        : null,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    assignment,
    trainer: serializeTrainingTrainer(trainer),
    conflictState,
    approvedException,
    created: true,
    domain: getTrainingDomainContract(),
  };
}
