/**
 * Training conflict evaluation — Phase 18 Wave 2.
 * BLOCKED / UNKNOWN ≠ confirmable as NO_CONFLICT.
 */

import {
  TRAINING_CONFLICT_STATE,
  TRAINING_SESSION_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingConflictModel,
  hasCustomerTrainingSessionModel,
  hasCustomerTrainingTrainerAssignmentModel,
  resolveTrainingActor,
  serializeTrainingSession,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function overlaps(aStart, aEnd, bStart, bEnd) {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  if (![as, ae, bs, be].every(Number.isFinite)) return false;
  return as < be && bs < ae;
}

function isConfirmable(state) {
  return (
    state === TRAINING_CONFLICT_STATE.NO_CONFLICT ||
    state === TRAINING_CONFLICT_STATE.WARNING
  );
}

/**
 * Evaluate conflicts for a Session (trainer overlap, optional forced UNKNOWN).
 */
export async function evaluateTrainingConflicts(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_conflict_evaluate_forbidden' };
  }
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_session_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  if (!sessionId) return { ok: false, error: 'sessionId_required' };

  const session = await prisma.customerTrainingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return { ok: false, error: 'session_not_found', notFound: true };

  if (args.forceUnknown === true) {
    const conflictState = TRAINING_CONFLICT_STATE.UNKNOWN;
    await prisma.customerTrainingSession.update({
      where: { id: sessionId },
      data: {
        conflictState,
        updatedAt: args.now || new Date(),
      },
    });
    return {
      ok: true,
      sessionId,
      conflictState,
      confirmable: false,
      reasons: ['forced_unknown'],
      domain: getTrainingDomainContract(),
    };
  }

  const reasons = [];
  let conflictState = TRAINING_CONFLICT_STATE.NO_CONFLICT;
  let trainerId = args.trainerId ? String(args.trainerId).trim() : null;

  if (hasCustomerTrainingTrainerAssignmentModel(prisma)) {
    if (!trainerId) {
      const onSession = await prisma.customerTrainingTrainerAssignment.findMany({
        where: { sessionId },
      });
      trainerId = onSession[0]?.trainerId || null;
    }

    if (trainerId) {
      const assignments = await prisma.customerTrainingTrainerAssignment.findMany({
        where: { trainerId },
      });
      const otherSessionIds = assignments
        .map((a) => a.sessionId)
        .filter((id) => id && id !== sessionId);

      for (const otherId of otherSessionIds) {
        const other = await prisma.customerTrainingSession.findUnique({
          where: { id: otherId },
        });
        if (!other) continue;
        if (
          String(other.status || '').toUpperCase() === TRAINING_SESSION_STATUS.CANCELLED
        ) {
          continue;
        }
        if (overlaps(session.startsAt, session.endsAt, other.startsAt, other.endsAt)) {
          reasons.push(`trainer_overlap:${otherId}`);
          conflictState = TRAINING_CONFLICT_STATE.BLOCKED;
        }
      }
    }
  }

  if (
    !session.timezone ||
    !session.startsAt ||
    !session.endsAt
  ) {
    reasons.push('schedule_incomplete');
    if (conflictState === TRAINING_CONFLICT_STATE.NO_CONFLICT) {
      conflictState = TRAINING_CONFLICT_STATE.UNKNOWN;
    }
  }

  if (hasCustomerTrainingConflictModel(prisma) && reasons.length) {
    await prisma.customerTrainingConflict.create({
      data: {
        programId: session.programId,
        sessionId,
        trainerId,
        conflictState,
        reasonsJson: reasons,
        createdByAdminId: admin?.id || null,
        createdAt: args.now || new Date(),
        updatedAt: args.now || new Date(),
      },
    });
  }

  await prisma.customerTrainingSession.update({
    where: { id: sessionId },
    data: {
      conflictState,
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    sessionId,
    conflictState,
    confirmable: isConfirmable(conflictState),
    reasons,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Confirm Session schedule only when conflict state is confirmable.
 * Always re-evaluates server-side — never trust client conflictState.
 * BLOCKED / UNKNOWN never become NO_CONFLICT via confirm.
 */
export async function confirmTrainingSchedule(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_schedule_confirm_forbidden' };
  }
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_session_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  if (!sessionId) return { ok: false, error: 'sessionId_required' };

  const session = await prisma.customerTrainingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) return { ok: false, error: 'session_not_found', notFound: true };

  if (session.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: session.programId,
    });
    if (!access.ok) return access;
  }

  // Server-side only: ignore caller conflictState / forceUnknown.
  const evaluation = await evaluateTrainingConflicts(prisma, {
    actorContext: args.actorContext,
    admin: args.admin,
    sessionId,
    trainerId: args.trainerId,
    now: args.now,
  });
  if (!evaluation.ok) return evaluation;

  const conflictState = evaluation.conflictState;

  if (
    conflictState === TRAINING_CONFLICT_STATE.BLOCKED ||
    conflictState === TRAINING_CONFLICT_STATE.UNKNOWN ||
    conflictState === TRAINING_CONFLICT_STATE.APPROVAL_REQUIRED ||
    !isConfirmable(conflictState)
  ) {
    return {
      ok: false,
      error: 'schedule_confirm_blocked_by_conflict',
      conflictState,
      confirmable: false,
      sessionDelivered: false,
      domain: getTrainingDomainContract(),
    };
  }

  const updated = await prisma.customerTrainingSession.update({
    where: { id: sessionId },
    data: {
      status: TRAINING_SESSION_STATUS.CONFIRMED,
      conflictState: TRAINING_CONFLICT_STATE.NO_CONFLICT,
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    session: serializeTrainingSession(updated),
    conflictState: TRAINING_CONFLICT_STATE.NO_CONFLICT,
    confirmable: true,
    sessionDelivered: false,
    domain: getTrainingDomainContract(),
  };
}

export { isConfirmable };
