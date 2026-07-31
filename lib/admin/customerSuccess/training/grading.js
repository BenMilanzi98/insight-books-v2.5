/**
 * Assessment grading / finalise / regrade — Phase 18 Wave 3.
 * Objective + manual; final results immutable except via regrade (original preserved).
 */

import {
  TRAINING_ATTEMPT_STATUS,
  TRAINING_RESULT_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingAssessmentResultModel,
  hasCustomerTrainingAssessmentAttemptModel,
  hasCustomerTrainingAssessmentRegradeModel,
  resolveTrainingActor,
  serializeTrainingAssessmentResult,
  serializeTrainingAssessmentRegrade,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function scoreObjective(version, answersJson) {
  const questions = Array.isArray(version?.questionsJson) ? version.questionsJson : [];
  if (!questions.length) {
    return { score: 0, maxScore: 0, passed: false };
  }
  const answers = answersJson && typeof answersJson === 'object' ? answersJson : {};
  let earned = 0;
  let maxScore = 0;
  for (const q of questions) {
    const points = Number(q.points ?? 0);
    maxScore += points;
    if (q.type === 'OBJECTIVE' || q.correctAnswer != null) {
      const given = answers[q.id];
      if (String(given ?? '') === String(q.correctAnswer ?? '')) {
        earned += points;
      }
    }
  }
  const score = maxScore > 0 ? Math.round((earned / maxScore) * 100) : 0;
  const passScore = Number(version.passScore ?? 70);
  return { score, maxScore: 100, earned, rawMax: maxScore, passed: score >= passScore };
}

export async function gradeAssessmentAttempt(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_grade_forbidden' };
  }
  if (
    !hasCustomerTrainingAssessmentAttemptModel(prisma) ||
    !hasCustomerTrainingAssessmentResultModel(prisma)
  ) {
    return {
      ok: false,
      error: 'customer_training_assessment_result_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const attemptId = args.attemptId ? String(args.attemptId).trim() : '';
  if (!attemptId) return { ok: false, error: 'attemptId_required' };

  const attempt = await prisma.customerTrainingAssessmentAttempt.findUnique({
    where: { id: attemptId },
  });
  if (!attempt) return { ok: false, notFound: true, error: 'attempt_not_found' };

  if (attempt.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: attempt.programId,
    });
    if (!access.ok) return access;
  }

  const existingResult = await prisma.customerTrainingAssessmentResult.findFirst({
    where: { attemptId },
  });
  if (existingResult?.immutable || existingResult?.status === TRAINING_RESULT_STATUS.FINALISED) {
    return {
      ok: false,
      error: 'final_result_immutable_regrade_required',
      resultId: existingResult.id,
    };
  }

  // Reject IN_PROGRESS — submit/server timer must not be bypassed.
  const gradeableStatuses = new Set([
    TRAINING_ATTEMPT_STATUS.SUBMITTED,
    TRAINING_ATTEMPT_STATUS.GRADED,
    'AUTO_GRADING',
    'MANUAL_REVIEW',
  ]);
  const attemptStatus = String(attempt.status || '');
  if (!gradeableStatuses.has(attemptStatus)) {
    return {
      ok: false,
      error: 'attempt_not_submitted_for_grading',
      status: attemptStatus,
    };
  }

  const version = await prisma.customerTrainingAssessmentVersion.findUnique({
    where: { id: attempt.assessmentVersionId },
  });
  if (!version) return { ok: false, error: 'assessment_version_not_found' };

  const mode = String(args.mode || 'OBJECTIVE')
    .trim()
    .toUpperCase();
  let score;
  let passed;
  if (mode === 'MANUAL') {
    if (args.score == null || !Number.isFinite(Number(args.score))) {
      return { ok: false, error: 'manual_score_required' };
    }
    score = Number(args.score);
    passed = score >= Number(version.passScore ?? 70);
  } else {
    const obj = scoreObjective(version, attempt.answersJson);
    score = obj.score;
    passed = obj.passed;
  }

  const now = args.now || new Date();
  let result;
  if (existingResult) {
    result = await prisma.customerTrainingAssessmentResult.update({
      where: { id: existingResult.id },
      data: {
        score,
        passed,
        gradeMode: mode,
        status: passed ? TRAINING_RESULT_STATUS.PASSED : TRAINING_RESULT_STATUS.FAILED,
        immutable: false,
        gradedByAdminId: admin?.id || null,
        updatedAt: now,
      },
    });
  } else {
    result = await prisma.customerTrainingAssessmentResult.create({
      data: {
        attemptId,
        assessmentVersionId: attempt.assessmentVersionId,
        participantId: attempt.participantId,
        programId: attempt.programId,
        score,
        originalScore: score,
        passed,
        gradeMode: mode,
        status: passed ? TRAINING_RESULT_STATUS.PASSED : TRAINING_RESULT_STATUS.FAILED,
        immutable: false,
        gradedByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  await prisma.customerTrainingAssessmentAttempt.update({
    where: { id: attemptId },
    data: {
      status: TRAINING_ATTEMPT_STATUS.GRADED,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    result: serializeTrainingAssessmentResult(result),
    domain: getTrainingDomainContract(),
  };
}

export async function finaliseAssessmentResult(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_finalise_forbidden' };
  }
  if (!hasCustomerTrainingAssessmentResultModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_assessment_result_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const resultId = args.resultId ? String(args.resultId).trim() : '';
  if (!resultId) return { ok: false, error: 'resultId_required' };

  const result = await prisma.customerTrainingAssessmentResult.findUnique({
    where: { id: resultId },
  });
  if (!result) return { ok: false, notFound: true, error: 'result_not_found' };

  if (result.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: result.programId,
    });
    if (!access.ok) return access;
  }

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingAssessmentResult.update({
    where: { id: resultId },
    data: {
      status: TRAINING_RESULT_STATUS.FINALISED,
      immutable: true,
      finalisedAt: now,
      updatedAt: now,
    },
  });

  if (result.attemptId) {
    await prisma.customerTrainingAssessmentAttempt.update({
      where: { id: result.attemptId },
      data: {
        status: TRAINING_ATTEMPT_STATUS.FINALISED,
        updatedAt: now,
      },
    });
  }

  return {
    ok: true,
    result: serializeTrainingAssessmentResult(updated),
    domain: getTrainingDomainContract(),
  };
}

export async function regradeAssessmentAttempt(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_regrade_forbidden' };
  }
  if (
    !hasCustomerTrainingAssessmentResultModel(prisma) ||
    !hasCustomerTrainingAssessmentRegradeModel(prisma)
  ) {
    return {
      ok: false,
      error: 'customer_training_assessment_regrade_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const resultId = args.resultId ? String(args.resultId).trim() : '';
  const reason = args.reason ? String(args.reason).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  const score = Number(args.score);

  if (!resultId) return { ok: false, error: 'resultId_required' };
  if (!reason) return { ok: false, error: 'reason_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };
  if (!Number.isFinite(score)) return { ok: false, error: 'score_required' };

  const existingRegrade = await prisma.customerTrainingAssessmentRegrade.findFirst({
    where: { idempotencyKey },
  });
  if (existingRegrade) {
    const result = await prisma.customerTrainingAssessmentResult.findUnique({
      where: { id: existingRegrade.resultId },
    });
    return {
      ok: true,
      regrade: serializeTrainingAssessmentRegrade(existingRegrade),
      result: serializeTrainingAssessmentResult(result),
      originalScore: existingRegrade.originalScore,
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const result = await prisma.customerTrainingAssessmentResult.findUnique({
    where: { id: resultId },
  });
  if (!result) return { ok: false, notFound: true, error: 'result_not_found' };

  if (result.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: result.programId,
    });
    if (!access.ok) return access;
  }

  const version = await prisma.customerTrainingAssessmentVersion.findUnique({
    where: { id: result.assessmentVersionId },
  });
  const passScore = Number(version?.passScore ?? 70);
  const originalScore =
    result.originalScore != null ? Number(result.originalScore) : Number(result.score);
  const now = args.now || new Date();
  const passed = score >= passScore;

  const regrade = await prisma.customerTrainingAssessmentRegrade.create({
    data: {
      resultId,
      attemptId: result.attemptId,
      originalScore,
      newScore: score,
      reason,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  const updated = await prisma.customerTrainingAssessmentResult.update({
    where: { id: resultId },
    data: {
      score,
      originalScore,
      passed,
      status: TRAINING_RESULT_STATUS.FINALISED,
      immutable: true,
      regradedAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    regrade: serializeTrainingAssessmentRegrade(regrade),
    result: serializeTrainingAssessmentResult(updated),
    originalScore,
    domain: getTrainingDomainContract(),
  };
}
