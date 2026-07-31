/**
 * Training Invitation lifecycle — Phase 22 Wave 2.
 * QUEUED → SENT → DELIVERED → REGISTERED. SENT ≠ DELIVERED ≠ REGISTERED ≠ attendance.
 * Never invent delivery without evidence.
 */

import {
  TRAINING_ENROLMENT_STATUS,
  TRAINING_INVITATION_STATUS,
  TRAINING_PARTICIPANT_VERIFICATION,
  getTrainingDomainContract,
} from './catalogue.js';
import { enrolTrainingParticipant } from './enrolment.js';
import {
  canManageTraining,
  hasCustomerTrainingInvitationModel,
  hasCustomerTrainingParticipantModel,
  resolveTrainingActor,
  serializeTrainingEnrolment,
  serializeTrainingInvitation,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function hasDeliveryEvidence(evidence) {
  if (!evidence || typeof evidence !== 'object') return false;
  const receiptId =
    evidence.receiptId != null ? String(evidence.receiptId).trim() : '';
  const deliveredAt =
    evidence.deliveredAt != null ? String(evidence.deliveredAt).trim() : '';
  const provider =
    evidence.provider != null ? String(evidence.provider).trim() : '';
  return Boolean(receiptId && (deliveredAt || provider));
}

/**
 * Create a QUEUED invitation (idempotent). Does not send or deliver.
 */
export async function createTrainingInvitation(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_invitation_create_forbidden',
    };
  }
  if (!hasCustomerTrainingInvitationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_invitation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const programId = args.programId ? String(args.programId).trim() : '';
  const cohortId = args.cohortId ? String(args.cohortId).trim() : '';
  const participantId = args.participantId
    ? String(args.participantId).trim()
    : '';
  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : '';
  if (!programId) return { ok: false, error: 'programId_required' };
  if (!cohortId) return { ok: false, error: 'cohortId_required' };
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!idempotencyKey) return { ok: false, error: 'idempotencyKey_required' };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId,
  });
  if (!access.ok) return access;

  const existing = await prisma.customerTrainingInvitation
    .findUnique({ where: { idempotencyKey } })
    .catch(async () =>
      prisma.customerTrainingInvitation.findFirst({ where: { idempotencyKey } })
    );
  if (existing) {
    if (
      String(existing.programId) !== programId ||
      String(existing.participantId) !== participantId
    ) {
      return {
        ok: false,
        error: 'idempotency_conflict',
        existingInvitationId: existing.id,
      };
    }
    return {
      ok: true,
      invitation: serializeTrainingInvitation(existing),
      alreadyExists: true,
      idempotentReplay: true,
      attendanceCreated: false,
      enrolmentCreated: false,
      domain: getTrainingDomainContract(),
    };
  }

  if (hasCustomerTrainingParticipantModel(prisma)) {
    const participant = await prisma.customerTrainingParticipant.findUnique({
      where: { id: participantId },
    });
    if (!participant) {
      return { ok: false, error: 'participant_not_found', notFound: true };
    }
    if (String(participant.programId) !== programId) {
      return { ok: false, error: 'participant_program_mismatch' };
    }
  }

  const now = args.now || new Date();
  const row = await prisma.customerTrainingInvitation.create({
    data: {
      programId,
      cohortId,
      participantId,
      status: TRAINING_INVITATION_STATUS.QUEUED,
      deliveryEvidenceJson: null,
      idempotencyKey,
      createdByAdminId: admin?.id || null,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    invitation: serializeTrainingInvitation(row),
    created: true,
    attendanceCreated: false,
    enrolmentCreated: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Transition QUEUED → SENT. Never marks DELIVERED or creates enrolment/attendance.
 */
export async function sendTrainingInvitation(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_invitation_send_forbidden',
    };
  }
  if (!hasCustomerTrainingInvitationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_invitation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const invitationId = args.invitationId
    ? String(args.invitationId).trim()
    : '';
  if (!invitationId) return { ok: false, error: 'invitationId_required' };

  const row = await prisma.customerTrainingInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!row) return { ok: false, error: 'invitation_not_found', notFound: true };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: row.programId,
  });
  if (!access.ok) return access;

  const status = String(row.status || '').trim().toUpperCase();
  if (
    status === TRAINING_INVITATION_STATUS.SENT ||
    status === TRAINING_INVITATION_STATUS.DELIVERED ||
    status === TRAINING_INVITATION_STATUS.REGISTERED
  ) {
    return {
      ok: true,
      invitation: serializeTrainingInvitation(row),
      alreadyExists: true,
      idempotentReplay: true,
      attendanceCreated: false,
      enrolmentCreated: false,
      domain: getTrainingDomainContract(),
    };
  }
  if (status !== TRAINING_INVITATION_STATUS.QUEUED) {
    return {
      ok: false,
      error: 'invitation_not_sendable',
      status,
    };
  }

  const updated = await prisma.customerTrainingInvitation.update({
    where: { id: invitationId },
    data: {
      status: TRAINING_INVITATION_STATUS.SENT,
      sentAt: args.now || new Date(),
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    invitation: serializeTrainingInvitation(updated),
    attendanceCreated: false,
    enrolmentCreated: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Mark DELIVERED only with delivery evidence. Never invent delivery from SENT alone.
 */
export async function markTrainingInvitationDelivered(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_invitation_deliver_forbidden',
    };
  }
  if (!hasCustomerTrainingInvitationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_invitation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const invitationId = args.invitationId
    ? String(args.invitationId).trim()
    : '';
  if (!invitationId) return { ok: false, error: 'invitationId_required' };

  if (!hasDeliveryEvidence(args.deliveryEvidence)) {
    return {
      ok: false,
      error: 'delivery_evidence_required',
      note: 'SENT ≠ DELIVERED; never invent delivery without provider receipt evidence',
    };
  }

  const row = await prisma.customerTrainingInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!row) return { ok: false, error: 'invitation_not_found', notFound: true };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: row.programId,
  });
  if (!access.ok) return access;

  const status = String(row.status || '').trim().toUpperCase();
  if (status === TRAINING_INVITATION_STATUS.DELIVERED) {
    return {
      ok: true,
      invitation: serializeTrainingInvitation(row),
      alreadyExists: true,
      idempotentReplay: true,
      attendanceCreated: false,
      domain: getTrainingDomainContract(),
    };
  }
  if (status === TRAINING_INVITATION_STATUS.REGISTERED) {
    return {
      ok: true,
      invitation: serializeTrainingInvitation(row),
      alreadyExists: true,
      attendanceCreated: false,
      domain: getTrainingDomainContract(),
    };
  }
  if (status !== TRAINING_INVITATION_STATUS.SENT) {
    return {
      ok: false,
      error: 'invitation_not_deliverable',
      status,
      note: 'Only SENT invitations may become DELIVERED with evidence',
    };
  }

  const updated = await prisma.customerTrainingInvitation.update({
    where: { id: invitationId },
    data: {
      status: TRAINING_INVITATION_STATUS.DELIVERED,
      deliveryEvidenceJson: args.deliveryEvidence,
      deliveredAt: args.now || new Date(),
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    invitation: serializeTrainingInvitation(updated),
    attendanceCreated: false,
    enrolmentCreated: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * REGISTERED from invitation — may create enrolment. Never creates attendance.
 */
export async function registerFromTrainingInvitation(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'training_invitation_register_forbidden',
    };
  }
  if (!hasCustomerTrainingInvitationModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_invitation_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const invitationId = args.invitationId
    ? String(args.invitationId).trim()
    : '';
  if (!invitationId) return { ok: false, error: 'invitationId_required' };

  const row = await prisma.customerTrainingInvitation.findUnique({
    where: { id: invitationId },
  });
  if (!row) return { ok: false, error: 'invitation_not_found', notFound: true };

  const access = await loadTrainingProgramForActor(prisma, {
    ...args,
    programId: row.programId,
  });
  if (!access.ok) return access;

  const status = String(row.status || '').trim().toUpperCase();
  if (status === TRAINING_INVITATION_STATUS.REGISTERED) {
    return {
      ok: true,
      invitation: serializeTrainingInvitation(row),
      enrolment: row.enrolmentId
        ? serializeTrainingEnrolment({
            id: row.enrolmentId,
            programId: row.programId,
            cohortId: row.cohortId,
            participantId: row.participantId,
            status: TRAINING_ENROLMENT_STATUS.REGISTERED,
          })
        : null,
      alreadyExists: true,
      idempotentReplay: true,
      attendanceCreated: false,
      domain: getTrainingDomainContract(),
    };
  }
  if (
    status !== TRAINING_INVITATION_STATUS.DELIVERED &&
    status !== TRAINING_INVITATION_STATUS.SENT
  ) {
    return {
      ok: false,
      error: 'invitation_not_registrable',
      status,
      note: 'Registration requires SENT or DELIVERED; QUEUED alone is not registration',
    };
  }

  const enrolKey =
    args.idempotencyKey ||
    (row.idempotencyKey ? `enr-from-inv:${row.idempotencyKey}` : '');
  if (!enrolKey) return { ok: false, error: 'idempotencyKey_required' };

  const enrolled = await enrolTrainingParticipant(prisma, {
    ...args,
    actorContext: args.actorContext,
    admin,
    programId: row.programId,
    cohortId: row.cohortId,
    participantId: row.participantId,
    verificationState: TRAINING_PARTICIPANT_VERIFICATION.VERIFIED,
    status: TRAINING_ENROLMENT_STATUS.REGISTERED,
    idempotencyKey: enrolKey,
  });
  if (!enrolled.ok) return enrolled;

  const updated = await prisma.customerTrainingInvitation.update({
    where: { id: invitationId },
    data: {
      status: TRAINING_INVITATION_STATUS.REGISTERED,
      enrolmentId: enrolled.enrolment?.id || null,
      registeredAt: args.now || new Date(),
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: true,
    invitation: serializeTrainingInvitation(updated),
    enrolment: enrolled.enrolment,
    attendanceCreated: false,
    enrolmentCreated: enrolled.created === true,
    domain: getTrainingDomainContract(),
  };
}
