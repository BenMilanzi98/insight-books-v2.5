/**
 * Training Request / Program status transitions — Phase 18 Wave 1.
 * Invalid transitions throw. No DRAFT → COMPLETED.
 * Manage + portfolio access required; COMPLETED gated by completion policy.
 */

import {
  TRAINING_REQUEST_STATUS,
  TRAINING_PROGRAM_STATUS,
  TRAINING_COMPLETION_STATUS,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingRequestStatusHistoryModel,
  hasCustomerTrainingProgramStatusHistoryModel,
  resolveTrainingActor,
  serializeTrainingRequest,
  serializeTrainingProgram,
} from './model.js';
import {
  loadTrainingProgramForActor,
  loadTrainingRequestForActor,
} from './programAccess.js';
import { evaluateProgramCompletion } from './completion.js';

const REQUEST_TRANSITIONS = Object.freeze({
  [TRAINING_REQUEST_STATUS.NEW]: [
    TRAINING_REQUEST_STATUS.VALIDATING,
    TRAINING_REQUEST_STATUS.INFORMATION_REQUIRED,
    TRAINING_REQUEST_STATUS.READY,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [TRAINING_REQUEST_STATUS.VALIDATING]: [
    TRAINING_REQUEST_STATUS.INFORMATION_REQUIRED,
    TRAINING_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED,
    TRAINING_REQUEST_STATUS.READY,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
  ],
  [TRAINING_REQUEST_STATUS.INFORMATION_REQUIRED]: [
    TRAINING_REQUEST_STATUS.VALIDATING,
    TRAINING_REQUEST_STATUS.READY,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [TRAINING_REQUEST_STATUS.DUPLICATE_REVIEW_REQUIRED]: [
    TRAINING_REQUEST_STATUS.VALIDATING,
    TRAINING_REQUEST_STATUS.READY,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.SUPERSEDED,
  ],
  [TRAINING_REQUEST_STATUS.READY]: [
    TRAINING_REQUEST_STATUS.ACCEPTED,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.CUSTOMER_DEFERRED,
    TRAINING_REQUEST_STATUS.INFORMATION_REQUIRED,
  ],
  [TRAINING_REQUEST_STATUS.ACCEPTED]: [
    TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM,
    TRAINING_REQUEST_STATUS.REJECTED,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.CUSTOMER_DEFERRED,
  ],
  [TRAINING_REQUEST_STATUS.CONVERTED_TO_PROGRAM]: [TRAINING_REQUEST_STATUS.ARCHIVED],
  [TRAINING_REQUEST_STATUS.REJECTED]: [TRAINING_REQUEST_STATUS.ARCHIVED],
  [TRAINING_REQUEST_STATUS.CANCELLED]: [TRAINING_REQUEST_STATUS.ARCHIVED],
  [TRAINING_REQUEST_STATUS.CUSTOMER_DEFERRED]: [
    TRAINING_REQUEST_STATUS.READY,
    TRAINING_REQUEST_STATUS.CANCELLED,
    TRAINING_REQUEST_STATUS.ARCHIVED,
  ],
  [TRAINING_REQUEST_STATUS.SUPERSEDED]: [TRAINING_REQUEST_STATUS.ARCHIVED],
  [TRAINING_REQUEST_STATUS.ARCHIVED]: [],
});

/** Wave 1 subset — no DRAFT → COMPLETED. */
const PROGRAM_TRANSITIONS = Object.freeze({
  [TRAINING_PROGRAM_STATUS.DRAFT]: [
    TRAINING_PROGRAM_STATUS.REQUIREMENTS_REVIEW,
    TRAINING_PROGRAM_STATUS.CURRICULUM_PINNED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.REQUIREMENTS_REVIEW]: [
    TRAINING_PROGRAM_STATUS.CURRICULUM_PINNED,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.CURRICULUM_PINNED]: [
    TRAINING_PROGRAM_STATUS.PARTICIPANT_PLANNING,
    TRAINING_PROGRAM_STATUS.READY_TO_START,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.PARTICIPANT_PLANNING]: [
    TRAINING_PROGRAM_STATUS.TRAINER_ASSIGNMENT,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.TRAINER_ASSIGNMENT]: [
    TRAINING_PROGRAM_STATUS.SCHEDULING,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.SCHEDULING]: [
    TRAINING_PROGRAM_STATUS.READY_TO_START,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.READY_TO_START]: [
    TRAINING_PROGRAM_STATUS.IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.PAUSED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.IN_PROGRESS]: [
    TRAINING_PROGRAM_STATUS.ASSESSMENT_IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.COMPLETION_REVIEW,
    TRAINING_PROGRAM_STATUS.PAUSED,
    TRAINING_PROGRAM_STATUS.AT_RISK,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.FAILED,
  ],
  [TRAINING_PROGRAM_STATUS.ASSESSMENT_IN_PROGRESS]: [
    TRAINING_PROGRAM_STATUS.RETAKE_REVIEW,
    TRAINING_PROGRAM_STATUS.COMPLETION_REVIEW,
    TRAINING_PROGRAM_STATUS.BLOCKED,
  ],
  [TRAINING_PROGRAM_STATUS.RETAKE_REVIEW]: [
    TRAINING_PROGRAM_STATUS.ASSESSMENT_IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.COMPLETION_REVIEW,
  ],
  [TRAINING_PROGRAM_STATUS.COMPLETION_REVIEW]: [
    TRAINING_PROGRAM_STATUS.COMPLETED,
    TRAINING_PROGRAM_STATUS.COMPLETED_WITH_GAPS,
  ],
  [TRAINING_PROGRAM_STATUS.COMPLETED]: [TRAINING_PROGRAM_STATUS.ARCHIVED],
  [TRAINING_PROGRAM_STATUS.COMPLETED_WITH_GAPS]: [TRAINING_PROGRAM_STATUS.ARCHIVED],
  [TRAINING_PROGRAM_STATUS.PAUSED]: [
    TRAINING_PROGRAM_STATUS.IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.READY_TO_START,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.AT_RISK]: [
    TRAINING_PROGRAM_STATUS.IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.BLOCKED,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.BLOCKED]: [
    TRAINING_PROGRAM_STATUS.IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.READY_TO_START,
    TRAINING_PROGRAM_STATUS.CANCELLED,
    TRAINING_PROGRAM_STATUS.FAILED,
  ],
  [TRAINING_PROGRAM_STATUS.CUSTOMER_DEFERRED]: [
    TRAINING_PROGRAM_STATUS.READY_TO_START,
    TRAINING_PROGRAM_STATUS.CANCELLED,
  ],
  [TRAINING_PROGRAM_STATUS.CANCELLED]: [TRAINING_PROGRAM_STATUS.ARCHIVED],
  [TRAINING_PROGRAM_STATUS.FAILED]: [
    TRAINING_PROGRAM_STATUS.IN_PROGRESS,
    TRAINING_PROGRAM_STATUS.ARCHIVED,
  ],
  [TRAINING_PROGRAM_STATUS.ARCHIVED]: [],
});

const COMPLETION_TERMINAL = new Set([
  TRAINING_PROGRAM_STATUS.COMPLETED,
  TRAINING_PROGRAM_STATUS.COMPLETED_WITH_GAPS,
]);

export function canTransitionTrainingRequestStatus(from, to) {
  const allowed = REQUEST_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function canTransitionTrainingProgramStatus(from, to) {
  const allowed = PROGRAM_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

export function assertCanTransitionTrainingRequestStatus(from, to) {
  if (from === to) return;
  if (!canTransitionTrainingRequestStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

export function assertCanTransitionTrainingProgramStatus(from, to) {
  if (from === to) return;
  if (!canTransitionTrainingProgramStatus(from, to)) {
    throw new Error(`invalid_status_transition: ${from} → ${to}`);
  }
}

function hasAuditedCompletionWaiver(args = {}) {
  const waiver =
    args.auditedCompletionWaiver === true ||
    args.completionWaiver === true ||
    String(args.waiverType || '')
      .trim()
      .toUpperCase() === 'AUDITED_COMPLETION_WAIVER';
  const reason = args.waiverReason || args.reason;
  return Boolean(waiver && reason && String(reason).trim());
}

/**
 * Transition Request status. Invalid transition throws.
 */
export async function transitionTrainingRequestStatus(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_request_status_forbidden' };
  }

  const requestId = args.trainingRequestId || args.requestId;
  const access = await loadTrainingRequestForActor(prisma, {
    ...args,
    requestId,
    trainingRequestId: requestId,
  });
  if (!access.ok) return access;
  const row = access.requestRow || access.request;

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      request: serializeTrainingRequest(row),
      alreadyInStatus: true,
      domain: getTrainingDomainContract(),
    };
  }

  assertCanTransitionTrainingRequestStatus(row.status, toStatus);

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingRequest.update({
    where: { id: row.id },
    data: {
      status: toStatus,
      updatedAt: now,
      ...(args.programId ? { programId: args.programId } : {}),
    },
  });

  if (hasCustomerTrainingRequestStatusHistoryModel(prisma)) {
    await prisma.customerTrainingRequestStatusHistory.create({
      data: {
        requestId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    request: serializeTrainingRequest(updated),
    domain: getTrainingDomainContract(),
  };
}

/**
 * Transition Program status. Invalid transition throws.
 * COMPLETED / COMPLETED_WITH_GAPS require evaluateProgramCompletion (or audited waiver).
 */
export async function transitionTrainingProgramStatus(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_program_status_forbidden' };
  }

  const programId = args.trainingProgramId || args.programId;
  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId,
  });
  if (!access.ok) return access;
  const row = access.programRow || access.program;

  const toStatus = String(args.toStatus || '')
    .trim()
    .toUpperCase();
  if (row.status === toStatus) {
    return {
      ok: true,
      program: serializeTrainingProgram(row),
      alreadyInStatus: true,
      domain: getTrainingDomainContract(),
    };
  }

  assertCanTransitionTrainingProgramStatus(row.status, toStatus);

  if (COMPLETION_TERMINAL.has(toStatus) && !hasAuditedCompletionWaiver(args)) {
    const evaluation = await evaluateProgramCompletion(prisma, {
      ...args,
      programId: row.id,
    });
    if (!evaluation.ok) return evaluation;

    if (
      toStatus === TRAINING_PROGRAM_STATUS.COMPLETED &&
      evaluation.status !== TRAINING_COMPLETION_STATUS.COMPLETED
    ) {
      return {
        ok: false,
        error: 'program_completion_policy_blocked',
        evaluationStatus: evaluation.status,
        enrolledCount: evaluation.enrolledCount,
        participantCompletedCount: evaluation.participantCompletedCount,
      };
    }
    if (
      toStatus === TRAINING_PROGRAM_STATUS.COMPLETED_WITH_GAPS &&
      evaluation.status !== TRAINING_COMPLETION_STATUS.COMPLETED_WITH_GAPS
    ) {
      return {
        ok: false,
        error: 'program_completion_policy_blocked',
        evaluationStatus: evaluation.status,
        enrolledCount: evaluation.enrolledCount,
        participantCompletedCount: evaluation.participantCompletedCount,
      };
    }
  }

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingProgram.update({
    where: { id: row.id },
    data: { status: toStatus, updatedAt: now },
  });

  if (hasCustomerTrainingProgramStatusHistoryModel(prisma)) {
    await prisma.customerTrainingProgramStatusHistory.create({
      data: {
        programId: row.id,
        fromStatus: row.status,
        toStatus,
        reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,
        changedByAdminId: admin?.id || null,
        at: now,
      },
    });
  }

  return {
    ok: true,
    program: serializeTrainingProgram(updated),
    domain: getTrainingDomainContract(),
  };
}

export { TRAINING_REQUEST_STATUS, TRAINING_PROGRAM_STATUS };
