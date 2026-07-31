/**
 * Training Progress — Phase 22 Wave 4 harden.
 * Progress ≠ quality ≠ completion; completion ≠ adoption; versioned percent only.
 */

import {
  TRAINING_PROGRESS_RULES_VERSION,
  TRAINING_COMPLETION_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canViewTraining,
  canManageTraining,
  resolveTrainingActor,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

const PRESENT_LIKE = new Set(['PRESENT', 'PRESENT_LATE']);

/**
 * Current-projection attendance for a program: exclude superseded rows and
 * constrain PRESENT* to sessions belonging to the requested program.
 */
async function hasCurrentProgramPresentAttendance(
  prisma,
  { programId, participantId }
) {
  if (typeof prisma.customerTrainingAttendance?.findMany !== 'function') {
    return false;
  }

  const attendanceRows = await prisma.customerTrainingAttendance.findMany({
    where: { participantId },
  });

  const currentAttendance = attendanceRows.filter((r) => !r.supersededById);
  if (!currentAttendance.length) return false;

  const sessionIds = [
    ...new Set(
      currentAttendance
        .map((r) => r.sessionId)
        .filter((id) => id != null && id !== '')
    ),
  ];
  if (!sessionIds.length) return false;

  let programSessionIds = new Set();
  if (typeof prisma.customerTrainingSession?.findMany === 'function') {
    const sessions = await prisma.customerTrainingSession.findMany({
      where: { id: { in: sessionIds }, programId },
    });
    programSessionIds = new Set(sessions.map((s) => s.id));
  } else if (typeof prisma.customerTrainingSession?.findUnique === 'function') {
    for (const sid of sessionIds) {
      const session = await prisma.customerTrainingSession.findUnique({
        where: { id: sid },
      });
      if (session && String(session.programId) === programId) {
        programSessionIds.add(session.id);
      }
    }
  }

  return currentAttendance.some(
    (r) =>
      programSessionIds.has(r.sessionId) &&
      PRESENT_LIKE.has(String(r.status || ''))
  );
}

export async function calculateTrainingProgress(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canViewTraining(admin) && !canManageTraining(admin)) {
    return { ok: false, forbidden: true, error: 'training_progress_forbidden' };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const participantId = args.participantId
    ? String(args.participantId).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  let weight = 0;
  let earned = 0;

  // Attendance — current projection only; scoped to this program's sessions.
  weight += 1;
  if (participantId) {
    const present = await hasCurrentProgramPresentAttendance(prisma, {
      programId,
      participantId,
    });
    if (present) {
      earned += 1;
    }
  }

  // Exercises
  weight += 1;
  if (participantId && typeof prisma.customerTrainingExercise?.findMany === 'function') {
    const ex = await prisma.customerTrainingExercise.findMany({
      where: { programId, participantId },
    });
    if (ex.some((e) => e.status === 'PASSED' || e.status === 'WAIVED')) {
      earned += 1;
    }
  }

  // Assessments
  weight += 1;
  if (
    participantId &&
    typeof prisma.customerTrainingAssessmentResult?.findMany === 'function'
  ) {
    const results = await prisma.customerTrainingAssessmentResult.findMany({
      where: { programId, participantId },
    });
    if (results.some((r) => r.passed === true)) {
      earned += 1;
    }
  }

  // Completion record
  weight += 1;
  let complete = false;
  if (
    participantId &&
    typeof prisma.customerTrainingParticipantCompletion?.findFirst === 'function'
  ) {
    const comp = await prisma.customerTrainingParticipantCompletion.findFirst({
      where: {
        programId,
        participantId,
        status: TRAINING_COMPLETION_STATUS.COMPLETED,
      },
    });
    if (comp) {
      earned += 1;
      complete = true;
    }
  }

  const percent = weight > 0 ? Math.round((earned / weight) * 100) : 0;

  return {
    ok: true,
    percent,
    rulesVersion: TRAINING_PROGRESS_RULES_VERSION,
    complete: false,
    isComplete: false,
    isQuality: false,
    isAdoption: false,
    completionRecorded: complete,
    programId,
    participantId: participantId || null,
    domain: getTrainingDomainContract(),
  };
}
