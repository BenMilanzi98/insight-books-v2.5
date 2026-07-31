/**
 * Training Exercises — Phase 18 Wave 3.
 * Submit → review → pass / retry / waived. Source-backed evidence.
 */

import {
  TRAINING_EXERCISE_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingExerciseModel,
  resolveTrainingActor,
  serializeTrainingExercise,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';
import { assertTrainingEnvironmentIsolation } from './environment.js';

const DECISION_MAP = Object.freeze({
  PASSED: TRAINING_EXERCISE_STATUS.PASSED,
  PASS: TRAINING_EXERCISE_STATUS.PASSED,
  RETRY: TRAINING_EXERCISE_STATUS.RETRY_REQUIRED,
  RETRY_REQUIRED: TRAINING_EXERCISE_STATUS.RETRY_REQUIRED,
  WAIVED: TRAINING_EXERCISE_STATUS.WAIVED,
  WAIVE: TRAINING_EXERCISE_STATUS.WAIVED,
});

export async function submitTrainingExercise(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_exercise_submit_forbidden' };
  }
  if (!hasCustomerTrainingExerciseModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_exercise_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const title = args.title ? String(args.title).trim() : '';
  const evidenceRef = args.evidenceRef ? String(args.evidenceRef).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!programId) return { ok: false, error: 'programId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!title) return { ok: false, error: 'title_required' };
  if (!evidenceRef) return { ok: false, error: 'evidenceRef_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  // Always assert — omitting fiscalPlane must not bypass Production fiscal refusal.
  // Default plane is labelled sandbox (fail-closed for Production GL/journals/stock/MRA).
  const isolation = await assertTrainingEnvironmentIsolation(prisma, {
    ...args,
    admin,
    environmentKind: args.environmentKind || 'SANDBOX',
    fiscalPlane: args.fiscalPlane || 'SANDBOX_LABELLED',
    dataClassification: args.dataClassification,
    programId,
  });
  if (!isolation.ok) return isolation;

  const existing = await prisma.customerTrainingExercise.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      exercise: serializeTrainingExercise(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const exercise = await prisma.customerTrainingExercise.create({
    data: {
      programId,
      participantId,
      title,
      evidenceRef,
      status: TRAINING_EXERCISE_STATUS.SUBMITTED,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    exercise: serializeTrainingExercise(exercise),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

export async function reviewTrainingExercise(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_exercise_review_forbidden' };
  }
  if (!hasCustomerTrainingExerciseModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_exercise_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const exerciseId = args.exerciseId ? String(args.exerciseId).trim() : '';
  const decision = String(args.decision || '')
    .trim()
    .toUpperCase();
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!exerciseId) return { ok: false, error: 'exerciseId_required' };
  if (!DECISION_MAP[decision]) {
    return { ok: false, error: 'invalid_exercise_decision' };
  }
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const existing = await prisma.customerTrainingExercise.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      exercise: serializeTrainingExercise(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const exercise = await prisma.customerTrainingExercise.findUnique({
    where: { id: exerciseId },
  });
  if (!exercise) return { ok: false, notFound: true, error: 'exercise_not_found' };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: exercise.programId,
  });
  if (!access.ok) return access;

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingExercise.update({
    where: { id: exerciseId },
    data: {
      status: DECISION_MAP[decision],
      reviewDecision: decision,
      reviewReason: args.reason ? String(args.reason).trim() : null,
      reviewedByAdminId: admin?.id || null,
      reviewIdempotencyKey: idempotencyKey,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    exercise: serializeTrainingExercise(updated),
    domain: getTrainingDomainContract(),
  };
}

export async function waiveTrainingExercise(prisma, args = {}) {
  return reviewTrainingExercise(prisma, {
    ...args,
    decision: 'WAIVED',
  });
}

export async function retryTrainingExercise(prisma, args = {}) {
  return reviewTrainingExercise(prisma, {
    ...args,
    decision: 'RETRY_REQUIRED',
  });
}
