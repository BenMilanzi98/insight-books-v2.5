/**
 * Training Enrolment — Phase 22 Wave 2.
 * Enrol verified Participants into Cohorts; capacity + prerequisite + waitlist.
 * Invitation / registration states remain distinct from attendance.
 */

import {
  TRAINING_ENROLMENT_STATUS,
  TRAINING_PARTICIPANT_VERIFICATION,
  getTrainingDomainContract,
} from './catalogue.js';
import {
  canManageTraining,
  hasCustomerTrainingCohortModel,
  hasCustomerTrainingEnrolmentModel,
  hasCustomerTrainingParticipantModel,
  resolveTrainingActor,
  serializeTrainingEnrolment,
  serializeTrainingParticipant,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';
import { verifyTrainingParticipant } from './participants.js';

function asCodeList(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (value == null || value === '') return [];
  return [String(value).trim()].filter(Boolean);
}

function countActiveEnrolments(enrolments) {
  const active = new Set([
    TRAINING_ENROLMENT_STATUS.ENROLLED,
    TRAINING_ENROLMENT_STATUS.REGISTERED,
    TRAINING_ENROLMENT_STATUS.COMPLETED,
  ]);
  return enrolments.filter((e) => active.has(String(e.status || '').toUpperCase()))
    .length;
}

/**
 * Enrol a Participant into a Cohort (capacity-aware; duplicate identity blocked).
 */
export async function enrolTrainingParticipant(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_enrolment_forbidden' };
  }
  if (!hasCustomerTrainingEnrolmentModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_enrolment_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }
  if (!hasCustomerTrainingCohortModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_cohort_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const cohortId = args.cohortId ? String(args.cohortId).trim() : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };
  if (!cohortId) return { ok: false, error: 'cohortId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
  if (!access.ok) return access;

  const existingByKey = await prisma.customerTrainingEnrolment.findFirst({
    where: { idempotencyKey },
  });
  if (existingByKey) {
    return {
      ok: true,
      enrolment: serializeTrainingEnrolment(existingByKey),
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const cohort = await prisma.customerTrainingCohort.findUnique({
    where: { id: cohortId },
  });
  if (!cohort) return { ok: false, error: 'cohort_not_found', notFound: true };
  if (String(cohort.programId) !== programId) {
    return { ok: false, error: 'cohort_program_mismatch' };
  }

  let participantId = args.participantId ? String(args.participantId).trim() : '';
  let participant = null;

  if (participantId && hasCustomerTrainingParticipantModel(prisma)) {
    participant = await prisma.customerTrainingParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) return { ok: false, error: 'participant_not_found', notFound: true };
  } else if (args.contactId || args.tenantUserId) {
    const verified = await verifyTrainingParticipant(prisma, {
      ...args,
      actorContext: args.actorContext,
      admin,
      programId,
      verificationState:
        args.verificationState || TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
      idempotencyKey: args.participantIdempotencyKey || `part-from-enr:${idempotencyKey}`,
    });
    if (!verified.ok) return verified;
    participant = verified.participant;
    participantId = participant.id;
  } else {
    return { ok: false, error: 'participantId_required' };
  }

  const verification = String(participant.verificationState || '')
    .trim()
    .toUpperCase();
  if (verification !== TRAINING_PARTICIPANT_VERIFICATION.VERIFIED) {
    return {
      ok: false,
      error: 'UNKNOWN_or_unverified_participant_blocks_enrolment',
      verificationState: verification,
    };
  }

  const requiredPrereqs = asCodeList(args.prerequisiteModuleCodes);
  if (requiredPrereqs.length) {
    const completed = new Set(asCodeList(args.completedPrerequisiteModuleCodes));
    const missing = requiredPrereqs.filter((code) => !completed.has(code));
    if (missing.length) {
      return {
        ok: false,
        error: 'enrolment_prerequisite_not_met',
        missingPrerequisiteModuleCodes: missing,
      };
    }
  }

  const dupEnrol = await prisma.customerTrainingEnrolment.findFirst({
    where: { programId, participantId },
  });
  if (dupEnrol) {
    return {
      ok: false,
      error: 'duplicate_identity_enrolment',
      existingEnrolmentId: dupEnrol.id,
    };
  }

  const enrolments = await prisma.customerTrainingEnrolment.findMany({
    where: { cohortId },
  });
  const activeCount = countActiveEnrolments(enrolments);
  const capacity = Number(cohort.capacity);
  const atCapacity = Number.isFinite(capacity) && activeCount >= capacity;

  let status = args.status
    ? String(args.status).trim().toUpperCase()
    : TRAINING_ENROLMENT_STATUS.ENROLLED;
  const allowedStatus = new Set(Object.values(TRAINING_ENROLMENT_STATUS));
  if (!allowedStatus.has(status)) {
    status = TRAINING_ENROLMENT_STATUS.ENROLLED;
  }

  if (atCapacity) {
    if (args.waitlist === true) {
      status = TRAINING_ENROLMENT_STATUS.WAITLISTED;
    } else {
      return {
        ok: false,
        error: 'cohort_capacity_exceeded',
        capacity: cohort.capacity,
      };
    }
  }

  const now = args.now || new Date();
  const enrolment = await prisma.customerTrainingEnrolment.create({
    data: {
      programId,
      cohortId,
      participantId,
      status,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    enrolment: serializeTrainingEnrolment(enrolment),
    participant: serializeTrainingParticipant(participant),
    created: true,
    domain: getTrainingDomainContract(),
  };
}
