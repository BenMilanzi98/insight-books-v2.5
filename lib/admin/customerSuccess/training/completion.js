/**
 * Participant / Program completion — Phase 18 Wave 3.
 * Deterministic against versioned policy; UNKNOWN ≠ COMPLETED.
 */

import {
  TRAINING_ATTENDANCE_STATUS,
  TRAINING_COMPLETION_POLICY_V1,
  TRAINING_COMPLETION_STATUS,
  TRAINING_ENROLMENT_STATUS,
  TRAINING_EXERCISE_STATUS,
  TRAINING_RESULT_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingEnrolmentModel,
  hasCustomerTrainingParticipantCompletionModel,
  resolveTrainingActor,
  serializeTrainingParticipantCompletion,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

/** Enrolment statuses that count toward program completion denominator. */
const ACTIVE_ENROLMENT = new Set([
  TRAINING_ENROLMENT_STATUS.ENROLLED,
  TRAINING_ENROLMENT_STATUS.COMPLETED,
]);

const PRESENT_LIKE = new Set([
  TRAINING_ATTENDANCE_STATUS.PRESENT,
  TRAINING_ATTENDANCE_STATUS.PRESENT_LATE,
  TRAINING_ATTENDANCE_STATUS.PRESENT_PARTIAL,
  TRAINING_ATTENDANCE_STATUS.LEFT_EARLY,
]);

const EXERCISE_OK = new Set([
  TRAINING_EXERCISE_STATUS.PASSED,
  TRAINING_EXERCISE_STATUS.WAIVED,
]);

async function loadPolicy(prisma, policyVersion) {
  if (typeof prisma?.customerTrainingCompletionPolicy?.findFirst === 'function') {
    const row = await prisma.customerTrainingCompletionPolicy.findFirst({
      where: { policyVersion, status: 'ACTIVE' },
    });
    if (row) return row;
  }
  if (policyVersion === TRAINING_COMPLETION_POLICY_V1) {
    return {
      id: 'builtin-policy-v1',
      policyVersion: TRAINING_COMPLETION_POLICY_V1,
      requiresAttendance: true,
      requiresExercises: true,
      requiresAssessments: true,
      status: 'ACTIVE',
    };
  }
  return null;
}

export async function evaluateParticipantCompletion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_completion_evaluate_forbidden' };
  }
  if (!hasCustomerTrainingParticipantCompletionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_participant_completion_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const policyVersion = args.policyVersion
    ? String(args.policyVersion).trim()
    : TRAINING_COMPLETION_POLICY_V1;
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';

  if (!programId) return { ok: false, error: 'programId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const existing = await prisma.customerTrainingParticipantCompletion.findFirst({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      completion: serializeTrainingParticipantCompletion(existing),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const policy = await loadPolicy(prisma, policyVersion);
  if (!policy) return { ok: false, error: 'completion_policy_not_found' };

  const gaps = [];

  if (policy.requiresAttendance !== false) {
    let attendanceRows = [];
    if (typeof prisma.customerTrainingAttendance?.findMany === 'function') {
      attendanceRows = await prisma.customerTrainingAttendance.findMany({
        where: { participantId },
      });
    }
    // Scope PRESENT to sessions of this program (enrolment), not any program.
    const sessionIds = [
      ...new Set(
        attendanceRows.map((r) => r.sessionId).filter((id) => id != null && id !== '')
      ),
    ];
    let programSessionIds = new Set();
    if (
      sessionIds.length &&
      typeof prisma.customerTrainingSession?.findMany === 'function'
    ) {
      const sessions = await prisma.customerTrainingSession.findMany({
        where: { id: { in: sessionIds }, programId },
      });
      programSessionIds = new Set(sessions.map((s) => s.id));
    } else if (
      sessionIds.length &&
      typeof prisma.customerTrainingSession?.findUnique === 'function'
    ) {
      for (const sid of sessionIds) {
        const session = await prisma.customerTrainingSession.findUnique({
          where: { id: sid },
        });
        if (session && String(session.programId) === programId) {
          programSessionIds.add(session.id);
        }
      }
    }
    // Current projection only — superseded rows (append-only corrections) do not count.
    const currentAttendance = attendanceRows.filter((r) => !r.supersededById);
    const present = currentAttendance.some(
      (r) =>
        programSessionIds.has(r.sessionId) && PRESENT_LIKE.has(String(r.status || ''))
    );
    if (!present) {
      gaps.push('ATTENDANCE_REQUIRED');
    }
  }

  if (policy.requiresExercises !== false) {
    let exercises = [];
    if (typeof prisma.customerTrainingExercise?.findMany === 'function') {
      exercises = await prisma.customerTrainingExercise.findMany({
        where: { programId, participantId },
      });
    }
    const ok = exercises.some((e) => EXERCISE_OK.has(String(e.status || '')));
    if (!ok) {
      gaps.push('EXERCISES_REQUIRED');
    }
  }

  if (policy.requiresAssessments !== false) {
    let results = [];
    if (typeof prisma.customerTrainingAssessmentResult?.findMany === 'function') {
      results = await prisma.customerTrainingAssessmentResult.findMany({
        where: { programId, participantId },
      });
    }
    // Only finalised (immutable) passes count — raw PASSED before finalise does not.
    const passed = results.some(
      (r) =>
        r.passed === true &&
        (r.immutable === true || r.status === TRAINING_RESULT_STATUS.FINALISED)
    );
    if (!passed) {
      gaps.push('ASSESSMENTS_REQUIRED');
    }
  }

  if (gaps.length) {
    // COMPLETED_WITH_GAPS is explicit only — never silent COMPLETED.
    if (args.allowCompletedWithGaps === true) {
      const now = args.now || new Date();
      const completion = await prisma.customerTrainingParticipantCompletion.create({
        data: {
          programId,
          participantId,
          policyVersion,
          status: TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS,
          gapsJson: gaps,
          idempotencyKey,
          createdByAdminId: admin?.id || null,
          createdAt: now,
          updatedAt: now,
        },
      });
      return {
        ok: true,
        completion: serializeTrainingParticipantCompletion(completion),
        gaps,
        created: true,
        domain: getTrainingDomainContract(),
      };
    }
    return {
      ok: false,
      error: 'completion_blocked_policy_gaps',
      status: TRAINING_COMPLETION_STATUS.NOT_COMPLETED,
      gaps,
      completion: null,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const completion = await prisma.customerTrainingParticipantCompletion.create({
    data: {
      programId,
      participantId,
      policyVersion,
      status: TRAINING_COMPLETION_STATUS.COMPLETED,
      gapsJson: [],
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    completion: serializeTrainingParticipantCompletion(completion),
    created: true,
    domain: getTrainingDomainContract(),
  };
}

export async function evaluateProgramCompletion(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_program_completion_forbidden' };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  if (!programId) return { ok: false, error: 'programId_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  // Denominator: active enrolments (policy cohort), not “any one COMPLETED”.
  let enrolledParticipantIds = [];
  if (hasCustomerTrainingEnrolmentModel(prisma)) {
    const enrolments = await prisma.customerTrainingEnrolment.findMany({
      where: { programId },
    });
    enrolledParticipantIds = [
      ...new Set(
        (enrolments || [])
          .filter((e) => ACTIVE_ENROLMENT.has(String(e.status || '')))
          .map((e) => String(e.participantId))
          .filter(Boolean)
      ),
    ];
  }

  const completions =
    typeof prisma.customerTrainingParticipantCompletion?.findMany === 'function'
      ? await prisma.customerTrainingParticipantCompletion.findMany({
          where: { programId },
        })
      : [];

  const enrolledSet = new Set(enrolledParticipantIds);
  const completed = completions.filter(
    (c) =>
      c.status === TRAINING_COMPLETION_STATUS.COMPLETED &&
      (!enrolledSet.size || enrolledSet.has(String(c.participantId)))
  );
  const withGaps = completions.filter(
    (c) =>
      c.status === TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS &&
      (!enrolledSet.size || enrolledSet.has(String(c.participantId)))
  );

  const enrolledCount = enrolledParticipantIds.length;
  let status = TRAINING_COMPLETION_STATUS.IN_PROGRESS;
  if (enrolledCount === 0 && !completions.length) {
    status = TRAINING_COMPLETION_STATUS.UNKNOWN;
  } else if (withGaps.length) {
    status = TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS;
  } else if (
    enrolledCount > 0 &&
    completed.length === enrolledCount &&
    !withGaps.length
  ) {
    status = TRAINING_COMPLETION_STATUS.COMPLETED;
  } else if (!completions.length) {
    status = TRAINING_COMPLETION_STATUS.UNKNOWN;
  }

  return {
    ok: true,
    status,
    participantCompletedCount: completed.length,
    enrolledCount,
    domain: getTrainingDomainContract(),
  };
}
