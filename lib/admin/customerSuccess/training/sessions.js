/**
 * Training Sessions ↔ Phase 13 CrmMeeting — Phase 18 Wave 2.
 * RSVP ≠ attendance; Meeting unavailable → MEETING_SERVICE_UNAVAILABLE;
 * never fabricates Session delivery.
 */

import {
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_RSVP,
} from '../../crm/meetings/catalogue.js';
import { createMeeting, recordMeetingRsvp } from '../../crm/meetings/service.js';
import {
  MEETING_SERVICE_UNAVAILABLE,
  TRAINING_SESSION_STATUS,
  getTrainingDomainContract,
  VIRTUAL_PROVIDER_NOT_CONFIGURED,
} from './catalogue.js';
import { allocateTrainingSessionNumber } from './numbering.js';
import {
  canManageTraining,
  hasCustomerTrainingCohortModel,
  hasCustomerTrainingProgramModel,
  hasCustomerTrainingSessionModel,
  resolveTrainingActor,
  serializeTrainingSession,
} from './model.js';
import { loadTrainingProgramForActor } from './programAccess.js';

function resolveMeetingService(args = {}) {
  return (
    args.meetingService || {
      createMeeting,
      recordMeetingRsvp,
    }
  );
}

function mapMeetingUnavailable(result) {
  if (!result || result.ok) return null;
  const err = String(result.error || result.reason || result.status || '');
  if (
    /unavailable|model_unavailable|UNAVAILABLE/i.test(err) ||
    result.status === 'UNAVAILABLE'
  ) {
    return {
      ok: false,
      error: MEETING_SERVICE_UNAVAILABLE,
      status: 'UNAVAILABLE',
      underlying: result.error || result.reason || null,
      sessionDelivered: false,
    };
  }
  return {
    ok: false,
    error: result.error || result.reason || 'meeting_create_failed',
    sessionDelivered: false,
  };
}

function toMillis(value) {
  if (value == null || value === '') return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Validate idempotent Session replay against program + cohort + schedule identity.
 */
function assertSessionIdempotencyMatch(existing, { programId, cohortId, timezone, startsAt, endsAt }) {
  if (String(existing.programId) !== programId) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      existingProgramId: existing.programId,
      attemptedProgramId: programId,
    };
  }
  if (String(existing.cohortId) !== cohortId) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      existingCohortId: existing.cohortId,
      attemptedCohortId: cohortId,
    };
  }
  if (String(existing.timezone || '') !== String(timezone || '')) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'timezone',
    };
  }
  if (toMillis(existing.startsAt) !== toMillis(startsAt)) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'startsAt',
    };
  }
  if (toMillis(existing.endsAt) !== toMillis(endsAt)) {
    return {
      ok: false,
      error: 'idempotency_conflict',
      field: 'endsAt',
    };
  }
  return null;
}

function idempotentSessionReplay(existing) {
  return {
    ok: true,
    session: serializeTrainingSession(existing),
    crmMeetingId: existing.crmMeetingId,
    alreadyExists: true,
    idempotentReplay: true,
    // Honest delivery state — never hardcode false after markTrainingSessionDelivered.
    sessionDelivered: existing.sessionDelivered === true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Schedule Training Session: create/link Phase 13 Meeting once (idempotent).
 */
export async function scheduleTrainingSession(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_session_schedule_forbidden' };
  }
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_session_model_unavailable',
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

  const meetingInput = args.meetingInput || {};
  const timezone =
    (meetingInput.timezone != null ? String(meetingInput.timezone).trim() : '') ||
    '';
  if (!timezone) return { ok: false, error: 'timezone_required' };

  const startsAt = meetingInput.startsAt || null;
  const endsAt = meetingInput.endsAt || null;
  const scheduleIdentity = { programId, cohortId, timezone, startsAt, endsAt };

  const existingByKey = await prisma.customerTrainingSession.findUnique({
    where: { idempotencyKey },
  }).catch(async () =>
    prisma.customerTrainingSession.findFirst({ where: { idempotencyKey } })
  );
  if (existingByKey) {
    const conflict = assertSessionIdempotencyMatch(existingByKey, scheduleIdentity);
    if (conflict) return conflict;
    return idempotentSessionReplay(existingByKey);
  }

  if (hasCustomerTrainingProgramModel(prisma) && !access.programRow && !access.program) {
    return { ok: false, error: 'program_not_found', notFound: true };
  }
  if (hasCustomerTrainingCohortModel(prisma)) {
    const cohort = await prisma.customerTrainingCohort.findUnique({
      where: { id: cohortId },
    });
    if (!cohort) return { ok: false, error: 'cohort_not_found', notFound: true };
    if (String(cohort.programId) !== programId) {
      return { ok: false, error: 'cohort_program_mismatch' };
    }
  }

  const meetingService = resolveMeetingService(args);
  const now = args.now || new Date();

  const meetingResult = await meetingService.createMeeting(prisma, {
    admin,
    actorContext: args.actorContext,
    title: meetingInput.title || 'Training session',
    timezone,
    startsAt: meetingInput.startsAt,
    endsAt: meetingInput.endsAt,
    contactId: meetingInput.contactId || null,
    ownerAdminId: meetingInput.ownerAdminId || admin?.id || null,
    idempotencyKey: `meeting:${idempotencyKey}`,
    now,
  });

  if (!meetingResult?.ok) {
    return mapMeetingUnavailable(meetingResult);
  }

  const crmMeetingId = meetingResult.meeting?.id || meetingResult.crmMeetingId;
  if (!crmMeetingId) {
    return {
      ok: false,
      error: MEETING_SERVICE_UNAVAILABLE,
      status: 'UNAVAILABLE',
      sessionDelivered: false,
    };
  }

  const sessionNumber = await allocateTrainingSessionNumber(prisma, { now });
  let session;
  try {
    session = await prisma.customerTrainingSession.create({
      data: {
        sessionNumber,
        programId,
        cohortId,
        crmMeetingId,
        timezone,
        startsAt: meetingInput.startsAt ? new Date(meetingInput.startsAt) : null,
        endsAt: meetingInput.endsAt ? new Date(meetingInput.endsAt) : null,
        status: TRAINING_SESSION_STATUS.SCHEDULED,
        sessionDelivered: false,
        rsvpSummaryJson: { note: 'RSVP tracked on CrmMeetingParticipant; ≠ attendance' },
        attendanceSummaryJson: { note: 'Attendance requires separate confirmation' },
        idempotencyKey,
        createdByAdminId: admin?.id || null,
        createdAt: now,
        updatedAt: now,
      },
    });
  } catch (err) {
    let raced = await prisma.customerTrainingSession.findUnique({
      where: { idempotencyKey },
    }).catch(async () =>
      prisma.customerTrainingSession.findFirst({ where: { idempotencyKey } })
    );
    if (!raced) {
      raced = await prisma.customerTrainingSession.findFirst({
        where: { idempotencyKey },
      });
    }
    if (raced) {
      const conflict = assertSessionIdempotencyMatch(raced, scheduleIdentity);
      if (conflict) return conflict;
      return idempotentSessionReplay(raced);
    }
    throw err;
  }

  return {
    ok: true,
    session: serializeTrainingSession(session),
    crmMeetingId,
    created: true,
    sessionDelivered: false,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Record RSVP for Session Meeting participant. Does NOT capture attendance.
 */
export async function recordTrainingSessionRsvp(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_session_rsvp_forbidden' };
  }

  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  const contactId = args.contactId ? String(args.contactId).trim() : '';
  const rsvpStatus = String(args.rsvpStatus || '')
    .trim()
    .toUpperCase();
  if (!sessionId) return { ok: false, error: 'sessionId_required' };
  if (!contactId) return { ok: false, error: 'contactId_required' };
  if (!rsvpStatus) return { ok: false, error: 'rsvpStatus_required' };

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

  const meetingService = resolveMeetingService(args);
  if (typeof meetingService.recordMeetingRsvp === 'function') {
    const rsvpResult = await meetingService.recordMeetingRsvp(prisma, {
      admin,
      meetingId: session.crmMeetingId,
      contactId,
      rsvpStatus,
    });
    if (!rsvpResult?.ok) {
      return mapMeetingUnavailable(rsvpResult) || {
        ok: false,
        error: rsvpResult?.error || 'rsvp_failed',
        attendanceCaptured: false,
        sessionDelivered: false,
      };
    }
  } else if (typeof prisma.crmMeetingParticipant?.findFirst === 'function') {
    const p = await prisma.crmMeetingParticipant.findFirst({
      where: { meetingId: session.crmMeetingId, contactId },
    });
    if (p) {
      await prisma.crmMeetingParticipant.update({
        where: { id: p.id },
        data: { rsvpStatus },
      });
    }
  }

  return {
    ok: true,
    sessionId,
    crmMeetingId: session.crmMeetingId,
    rsvpStatus,
    attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
    attendanceCaptured: false,
    sessionDelivered: false,
    note: 'RSVP_ACCEPTED_IS_NOT_ATTENDANCE',
    domain: getTrainingDomainContract(),
  };
}

/**
 * Mark Session delivered — requires delivery evidence. Schedule alone ≠ delivered.
 */
export async function markTrainingSessionDelivered(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_session_deliver_forbidden' };
  }
  if (!hasCustomerTrainingSessionModel(prisma)) {
    return {
      ok: false,
      error: 'customer_training_session_model_unavailable',
      status: 'UNAVAILABLE',
      sessionDelivered: false,
    };
  }

  const sessionId = args.sessionId ? String(args.sessionId).trim() : '';
  if (!sessionId) {
    return { ok: false, error: 'sessionId_required', sessionDelivered: false };
  }

  const evidence = args.deliveryEvidence;
  const hasEvidence =
    evidence &&
    typeof evidence === 'object' &&
    (evidence.kind || evidence.confirmedAt || evidence.trainerId || evidence.providerRecordId);
  if (!hasEvidence) {
    return {
      ok: false,
      error: 'delivery_evidence_required',
      sessionDelivered: false,
      note: 'SCHEDULED_IS_NOT_DELIVERED',
    };
  }

  const session = await prisma.customerTrainingSession.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return { ok: false, error: 'session_not_found', notFound: true, sessionDelivered: false };
  }

  if (session.programId) {
    const access = await loadTrainingProgramForActor(prisma, {
      ...args,
      programId: session.programId,
    });
    if (!access.ok) return { ...access, sessionDelivered: false };
  }

  if (session.sessionDelivered === true) {
    return {
      ok: true,
      session: serializeTrainingSession(session),
      sessionDelivered: true,
      alreadyExists: true,
      idempotentReplay: true,
      domain: getTrainingDomainContract(),
    };
  }

  const now = args.now || new Date();
  const updated = await prisma.customerTrainingSession.update({
    where: { id: sessionId },
    data: {
      sessionDelivered: true,
      status: TRAINING_SESSION_STATUS.DELIVERED,
      deliveryEvidenceJson: evidence,
      deliveredAt: evidence.confirmedAt ? new Date(evidence.confirmedAt) : now,
      updatedAt: now,
    },
  });

  return {
    ok: true,
    session: serializeTrainingSession(updated),
    sessionDelivered: true,
    created: true,
    domain: getTrainingDomainContract(),
  };
}

/**
 * Virtual provider path — typed unavailable; never fabricates delivery.
 */
export async function requestVirtualTrainingProviderSession(prisma, args = {}) {
  const admin = resolveTrainingActor(args);
  if (!canManageTraining(admin)) {
    return { ok: false, forbidden: true, reason: 'training_virtual_provider_forbidden' };
  }
  const programId = args.programId ? String(args.programId).trim() : '';
  if (programId) {
    const access = await loadTrainingProgramForActor(prisma, { ...args, programId });
    if (!access.ok) return access;
  }
  return {
    ok: false,
    error: VIRTUAL_PROVIDER_NOT_CONFIGURED,
    status: 'UNAVAILABLE',
    sessionDelivered: false,
    programId: args.programId || null,
    sessionId: args.sessionId || null,
    domain: getTrainingDomainContract(),
  };
}

export { CRM_MEETING_RSVP, CRM_MEETING_ATTENDANCE, MEETING_SERVICE_UNAVAILABLE };
