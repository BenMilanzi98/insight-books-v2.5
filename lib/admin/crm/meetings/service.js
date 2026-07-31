/**
 * Meetings — Phase 13 Wave 3.
 * Explicit timezone; end-before-start blocked; RSVP ≠ attendance;
 * Activity-linked fail-closed; invitation Contact gate (Wave 2 patterns).
 */

import {
  CRM_ACTIVITY_DIRECTION,
  CRM_ACTIVITY_STATUS,
  CRM_ACTIVITY_TYPE,
  CRM_CALENDAR_CONFLICT_POLICY,
  CRM_CALENDAR_EVENT_STATUS,
  CRM_CALENDAR_VISIBILITY,
  CRM_COMMUNICATION_CHANNEL,
  CRM_CONSENT_PURPOSE,
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_INVITATION_STATUS,
  CRM_MEETING_RSVP,
  CRM_MEETING_STATUS,
  CRM_SUBJECT_TYPE,
  CRM_SUBJECT_TYPES,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { checkCommunicationEligibility } from '../eligibility.js';
import { appendTimelineEvent } from '../timeline.js';
import { createFollowUp } from '../followUps.js';
import { hasCrmContactModel } from '../contacts.js';
import {
  createCrmActivity,
  hasCrmActivityModel,
  transitionActivityStatus,
} from '../activities/index.js';
import {
  applyConflictPolicy,
  createCalendarEventForMeeting,
} from '../calendar/index.js';
import {
  getMeetingIntegrationContract,
  isValidMeetingAttendance,
  isValidMeetingOutcome,
  isValidMeetingRsvp,
  CRM_MEETING_PARTICIPANT_ROLE,
  CRM_MEETING_PARTICIPANT_TYPE,
} from './catalogue.js';
import { allocateMeetingNumber } from './numbering.js';
import {
  hasCrmMeetingModel,
  hasCrmMeetingParticipantModel,
  hasCrmMeetingRescheduleHistoryModel,
  serializeMeeting,
  serializeMeetingParticipant,
  serializeRescheduleHistory,
} from './model.js';

const SUBJECT_SET = new Set(
  CRM_SUBJECT_TYPES.filter((s) => s !== CRM_SUBJECT_TYPE.ACTIVITY)
);

function canEditMeetings(access) {
  return (
    access.canEditActivities ||
    access.canEditLeads ||
    access.canEditOpportunities ||
    access.canCreateLeads
  );
}

function toUtcDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Outbound invitations require a resolvable Contact (Wave 2 gate pattern).
 */
async function requireOutboundContact(prisma, contactId) {
  const id = contactId ? String(contactId).trim() : '';
  if (!id) {
    return { ok: false, error: 'CONTACT_REQUIRED' };
  }
  if (!hasCrmContactModel(prisma)) {
    return { ok: true, contactId: id };
  }
  try {
    let row = null;
    if (typeof prisma.crmContact.findUnique === 'function') {
      row = await prisma.crmContact.findUnique({ where: { id } });
    }
    if (!row && typeof prisma.crmContact.findFirst === 'function') {
      row = await prisma.crmContact.findFirst({
        where: { OR: [{ id }, { contactNumber: id }] },
      });
    }
    if (!row) {
      return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
    }
  } catch {
    return { ok: false, error: 'CONTACT_IDENTITY_UNRESOLVED' };
  }
  return { ok: true, contactId: id };
}

async function evaluateInviteEligibility(prisma, { contactId, purpose, now }) {
  const elig = await checkCommunicationEligibility(prisma, {
    contactId,
    purpose: purpose || CRM_CONSENT_PURPOSE.SALES_CONTACT,
    channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
  });
  const eligibilityJson = {
    eligible: elig.eligible,
    reasons: elig.reasons,
    consentStatus: elig.consentStatus,
    dncFlags: elig.dncFlags,
    inferred: false,
    evaluatedAt: now.toISOString(),
    channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
    purpose: purpose || CRM_CONSENT_PURPOSE.SALES_CONTACT,
  };
  return {
    consentBlocked: !elig.eligible,
    eligibilityJson,
    invitationStatus: elig.eligible
      ? CRM_MEETING_INVITATION_STATUS.REQUESTED
      : CRM_MEETING_INVITATION_STATUS.BLOCKED_BY_CONSENT,
  };
}

/**
 * Create a Meeting linked to CrmActivity type MEETING (fail-closed).
 */
export async function createMeeting(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access)) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_create_forbidden' };
  }

  if (!hasCrmMeetingModel(prisma)) {
    return { ok: false, error: 'crm_meeting_model_unavailable', status: 'UNAVAILABLE' };
  }

  const timezone = args.timezone != null ? String(args.timezone).trim() : '';
  if (!timezone) {
    return { ok: false, error: 'timezone_required' };
  }

  const startsAtUtc = toUtcDate(args.startsAt || args.startsAtUtc);
  const endsAtUtc = toUtcDate(args.endsAt || args.endsAtUtc);
  if (!startsAtUtc || !endsAtUtc) {
    return { ok: false, error: 'startsAt_and_endsAt_required' };
  }
  if (endsAtUtc <= startsAtUtc) {
    return { ok: false, error: 'end_before_start' };
  }

  const subjectType = args.subjectType
    ? String(args.subjectType).trim().toUpperCase()
    : null;
  const subjectId = args.subjectId ? String(args.subjectId).trim() : null;
  if (Boolean(subjectType) !== Boolean(subjectId)) {
    return { ok: false, error: 'subjectType_and_subjectId_required_together' };
  }
  if (subjectType && !SUBJECT_SET.has(subjectType)) {
    return { ok: false, error: 'invalid_subject_type' };
  }

  const title =
    args.title != null ? String(args.title).trim().slice(0, 500) : 'Meeting';
  const contactId = args.contactId ? String(args.contactId).trim() : null;
  const purpose = args.purpose
    ? String(args.purpose).trim().toUpperCase()
    : CRM_CONSENT_PURPOSE.SALES_CONTACT;
  const now = args.now || new Date();
  const ownerAdminId = args.ownerAdminId || args.admin?.id || null;
  const sendInvitations = args.sendInvitations === true;
  const visibility = String(args.visibility || CRM_CALENDAR_VISIBILITY.PUBLIC)
    .trim()
    .toUpperCase();

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : null;
  if (idempotencyKey) {
    try {
      const existing = await prisma.crmMeeting.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return {
          ok: true,
          meeting: serializeMeeting(existing),
          alreadyExists: true,
          integrations: getMeetingIntegrationContract(),
        };
      }
    } catch {
      // continue
    }
  }

  if (sendInvitations) {
    const contactGate = await requireOutboundContact(prisma, contactId);
    if (!contactGate.ok) {
      return { ok: false, error: contactGate.error };
    }
  }

  const conflict = await applyConflictPolicy(prisma, {
    admin: args.admin,
    ownerAdminId,
    startsAt: startsAtUtc,
    endsAt: endsAtUtc,
    conflictPolicy: args.conflictPolicy || CRM_CALENDAR_CONFLICT_POLICY.WARN,
    conflictReason: args.conflictReason,
  });
  if (!conflict.ok) {
    return conflict;
  }

  let consentBlocked = false;
  let eligibilityJson = null;
  let invitationStatus = CRM_MEETING_INVITATION_STATUS.NOT_SENT;

  if (sendInvitations && contactId) {
    const gate = await evaluateInviteEligibility(prisma, {
      contactId,
      purpose,
      now,
    });
    consentBlocked = gate.consentBlocked;
    eligibilityJson = gate.eligibilityJson;
    invitationStatus = gate.invitationStatus;
  }

  const allocated = await allocateMeetingNumber(prisma, { now });
  if (!allocated.ok) {
    return { ok: false, error: allocated.error || 'meeting_number_allocation_failed' };
  }

  let activity = null;
  if (hasCrmActivityModel(prisma)) {
    const actResult = await createCrmActivity(prisma, {
      admin: args.admin,
      type: CRM_ACTIVITY_TYPE.MEETING,
      status: CRM_ACTIVITY_STATUS.PLANNED,
      direction: CRM_ACTIVITY_DIRECTION.INTERNAL,
      title,
      ownerAdminId,
      timezone,
      dueAt: startsAtUtc,
      primarySubjectType: subjectType,
      primarySubjectId: subjectId,
      now,
    });
    if (!actResult.ok) {
      return {
        ok: false,
        error: actResult.error || 'activity_create_failed',
        forbidden: actResult.forbidden,
        reason: actResult.reason,
      };
    }
    activity = actResult.activity;
  }

  const row = await prisma.crmMeeting.create({
    data: {
      meetingNumber: allocated.number,
      activityId: activity?.id || null,
      status: CRM_MEETING_STATUS.SCHEDULED,
      title,
      outcome: null,
      subjectType,
      subjectId,
      contactId,
      startsAtUtc,
      endsAtUtc,
      timezone,
      startsAtOriginal:
        args.startsAtOriginal != null
          ? String(args.startsAtOriginal).trim().slice(0, 64)
          : null,
      endsAtOriginal:
        args.endsAtOriginal != null
          ? String(args.endsAtOriginal).trim().slice(0, 64)
          : null,
      location: args.location != null ? String(args.location).slice(0, 500) : null,
      notes: args.notes != null ? String(args.notes).slice(0, 4000) : null,
      visibility,
      consentBlocked,
      eligibilityJson: eligibilityJson || undefined,
      ownerAdminId,
      createdByAdminId: args.admin?.id || null,
      idempotencyKey: idempotencyKey || undefined,
      createdAt: now,
      updatedAt: now,
    },
  });

  const calResult = await createCalendarEventForMeeting(prisma, {
    admin: args.admin,
    internalTrusted: true,
    activityId: activity?.id || null,
    meetingId: row.id,
    title,
    startsAtUtc,
    endsAtUtc,
    timezone,
    ownerAdminId,
    visibility,
    location: args.location,
    now,
  });
  if (!calResult.ok) {
    // Fail-closed: do not leave orphan Meeting without calendar projection when model present
    try {
      if (typeof prisma.crmMeeting.update === 'function') {
        await prisma.crmMeeting.update({
          where: { id: row.id },
          data: {
            status: CRM_MEETING_STATUS.CANCELLED,
            outcome: 'CALENDAR_CREATE_FAILED',
            updatedAt: now,
          },
        });
      }
    } catch {
      // best-effort
    }
    return {
      ok: false,
      error: calResult.error || 'calendar_event_create_failed',
      status: calResult.status,
    };
  }

  const participants = [];
  const participantInputs = Array.isArray(args.participants) ? args.participants : [];
  if (hasCrmMeetingParticipantModel(prisma) && participantInputs.length) {
    for (const p of participantInputs) {
      const participantType = String(p.participantType || CRM_MEETING_PARTICIPANT_TYPE.CONTACT)
        .trim()
        .toUpperCase();
      const participantId = String(p.participantId || '').trim();
      if (!participantId) continue;

      let pInviteStatus = CRM_MEETING_INVITATION_STATUS.NOT_SENT;
      let pElig = null;
      if (
        sendInvitations &&
        participantType === CRM_MEETING_PARTICIPANT_TYPE.CONTACT
      ) {
        const gate = await evaluateInviteEligibility(prisma, {
          contactId: participantId,
          purpose,
          now,
        });
        pInviteStatus = gate.invitationStatus;
        pElig = gate.eligibilityJson;
        if (gate.consentBlocked) consentBlocked = true;
      } else if (
        participantType === CRM_MEETING_PARTICIPANT_TYPE.CONTACT &&
        contactId === participantId
      ) {
        pInviteStatus = invitationStatus;
        pElig = eligibilityJson;
      }

      const prow = await prisma.crmMeetingParticipant.create({
        data: {
          meetingId: row.id,
          participantType,
          participantId,
          role: String(p.role || CRM_MEETING_PARTICIPANT_ROLE.REQUIRED)
            .trim()
            .toUpperCase(),
          rsvpStatus: CRM_MEETING_RSVP.PENDING,
          attendanceStatus: CRM_MEETING_ATTENDANCE.UNKNOWN,
          invitationStatus: pInviteStatus,
          eligibilityJson: pElig || undefined,
          createdAt: now,
          updatedAt: now,
        },
      });
      participants.push(serializeMeetingParticipant(prow));
    }
  }

  if (subjectType && subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType,
      subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.MEETING_CREATED,
      summary: `Meeting scheduled: ${title.slice(0, 120)}`,
      payload: {
        meetingId: row.id,
        meetingNumber: row.meetingNumber,
        activityId: activity?.id || null,
        timezone,
        externalSync: false,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  // Refresh consentBlocked on meeting if participants blocked
  if (consentBlocked && !row.consentBlocked) {
    try {
      await prisma.crmMeeting.update({
        where: { id: row.id },
        data: { consentBlocked: true, updatedAt: now },
      });
      row.consentBlocked = true;
    } catch {
      // best-effort
    }
  }

  return {
    ok: true,
    meeting: serializeMeeting(row),
    activity,
    calendarEvent: calResult.event,
    participants,
    conflicts: conflict.conflicts || [],
    conflictReason: conflict.conflictReason || null,
    invitationSent: false,
    integrations: getMeetingIntegrationContract(),
  };
}

/**
 * Reschedule Meeting — history required; conflict policy re-checked.
 */
export async function rescheduleMeeting(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access)) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_reschedule_forbidden' };
  }

  if (!hasCrmMeetingModel(prisma)) {
    return { ok: false, error: 'crm_meeting_model_unavailable', status: 'UNAVAILABLE' };
  }

  const meetingId = args.meetingId ? String(args.meetingId).trim() : '';
  if (!meetingId) return { ok: false, error: 'meetingId_required' };

  const row = await prisma.crmMeeting.findUnique({ where: { id: meetingId } });
  if (!row) return { ok: false, error: 'meeting_not_found' };
  if (row.status === CRM_MEETING_STATUS.CANCELLED) {
    return { ok: false, error: 'meeting_cancelled' };
  }

  const timezone = args.timezone != null ? String(args.timezone).trim() : row.timezone;
  if (!timezone) return { ok: false, error: 'timezone_required' };

  const startsAtUtc = toUtcDate(args.startsAt || args.startsAtUtc);
  const endsAtUtc = toUtcDate(args.endsAt || args.endsAtUtc);
  if (!startsAtUtc || !endsAtUtc) {
    return { ok: false, error: 'startsAt_and_endsAt_required' };
  }
  if (endsAtUtc <= startsAtUtc) {
    return { ok: false, error: 'end_before_start' };
  }

  const now = args.now || new Date();
  const conflict = await applyConflictPolicy(prisma, {
    admin: args.admin,
    ownerAdminId: row.ownerAdminId || args.admin?.id,
    startsAt: startsAtUtc,
    endsAt: endsAtUtc,
    excludeMeetingId: meetingId,
    conflictPolicy: args.conflictPolicy || CRM_CALENDAR_CONFLICT_POLICY.WARN,
    conflictReason: args.conflictReason,
  });
  if (!conflict.ok) return conflict;

  let historyRow = null;
  if (hasCrmMeetingRescheduleHistoryModel(prisma)) {
    historyRow = await prisma.crmMeetingRescheduleHistory.create({
      data: {
        meetingId,
        fromStartsAtUtc: row.startsAtUtc,
        fromEndsAtUtc: row.endsAtUtc,
        fromTimezone: row.timezone,
        toStartsAtUtc: startsAtUtc,
        toEndsAtUtc: endsAtUtc,
        toTimezone: timezone,
        reason: args.reason != null ? String(args.reason).slice(0, 1000) : null,
        changedByAdminId: args.admin?.id || null,
        at: now,
      },
    });
  }

  const updated = await prisma.crmMeeting.update({
    where: { id: meetingId },
    data: {
      status: CRM_MEETING_STATUS.RESCHEDULED,
      startsAtUtc,
      endsAtUtc,
      timezone,
      startsAtOriginal:
        args.startsAtOriginal != null
          ? String(args.startsAtOriginal).trim().slice(0, 64)
          : row.startsAtOriginal,
      endsAtOriginal:
        args.endsAtOriginal != null
          ? String(args.endsAtOriginal).trim().slice(0, 64)
          : row.endsAtOriginal,
      updatedAt: now,
    },
  });

  try {
    if (typeof prisma.crmCalendarEvent.updateMany === 'function') {
      await prisma.crmCalendarEvent.updateMany({
        where: { meetingId },
        data: {
          startsAtUtc,
          endsAtUtc,
          timezone,
          status: CRM_CALENDAR_EVENT_STATUS.SCHEDULED,
          updatedAt: now,
        },
      });
    }
  } catch {
    // best-effort
  }

  if (row.activityId && hasCrmActivityModel(prisma)) {
    try {
      await prisma.crmActivity.update({
        where: { id: row.activityId },
        data: { dueAt: startsAtUtc, timezone, updatedAt: now },
      });
    } catch {
      // best-effort
    }
  }

  if (row.subjectType && row.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.MEETING_RESCHEDULED,
      summary: `Meeting rescheduled: ${(row.title || '').slice(0, 120)}`,
      payload: {
        meetingId,
        from: {
          startsAtUtc: new Date(row.startsAtUtc).toISOString(),
          endsAtUtc: new Date(row.endsAtUtc).toISOString(),
        },
        to: {
          startsAtUtc: startsAtUtc.toISOString(),
          endsAtUtc: endsAtUtc.toISOString(),
        },
        reason: args.reason || null,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  let history = [];
  if (hasCrmMeetingRescheduleHistoryModel(prisma)) {
    try {
      const rows = await prisma.crmMeetingRescheduleHistory.findMany({
        where: { meetingId },
      });
      history = (rows || []).map(serializeRescheduleHistory);
    } catch {
      history = historyRow ? [serializeRescheduleHistory(historyRow)] : [];
    }
  }

  return {
    ok: true,
    meeting: serializeMeeting(updated),
    history,
    conflicts: conflict.conflicts || [],
    integrations: getMeetingIntegrationContract(),
  };
}

/**
 * Cancel Meeting; optional Follow-Up hook (never auto-executed).
 */
export async function cancelMeeting(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access)) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_cancel_forbidden' };
  }

  if (!hasCrmMeetingModel(prisma)) {
    return { ok: false, error: 'crm_meeting_model_unavailable', status: 'UNAVAILABLE' };
  }

  const meetingId = args.meetingId ? String(args.meetingId).trim() : '';
  if (!meetingId) return { ok: false, error: 'meetingId_required' };

  const row = await prisma.crmMeeting.findUnique({ where: { id: meetingId } });
  if (!row) return { ok: false, error: 'meeting_not_found' };
  if (row.status === CRM_MEETING_STATUS.CANCELLED) {
    return {
      ok: true,
      meeting: serializeMeeting(row),
      alreadyCancelled: true,
      followUp: null,
    };
  }

  const now = args.now || new Date();
  const outcome =
    args.outcome && isValidMeetingOutcome(args.outcome)
      ? String(args.outcome).trim().toUpperCase()
      : null;

  const updated = await prisma.crmMeeting.update({
    where: { id: meetingId },
    data: {
      status: CRM_MEETING_STATUS.CANCELLED,
      outcome,
      notes:
        args.reason != null
          ? `${row.notes ? `${row.notes}\n` : ''}Cancelled: ${String(args.reason).slice(0, 500)}`
          : row.notes,
      updatedAt: now,
    },
  });

  try {
    if (typeof prisma.crmCalendarEvent.updateMany === 'function') {
      await prisma.crmCalendarEvent.updateMany({
        where: { meetingId },
        data: {
          status: CRM_CALENDAR_EVENT_STATUS.CANCELLED,
          updatedAt: now,
        },
      });
    }
  } catch {
    // best-effort
  }

  if (row.activityId && hasCrmActivityModel(prisma)) {
    try {
      await transitionActivityStatus(prisma, {
        admin: args.admin,
        activityId: row.activityId,
        toStatus: CRM_ACTIVITY_STATUS.CANCELLED,
        reason: args.reason || 'meeting_cancelled',
        now,
      });
    } catch {
      // best-effort
    }
  }

  let followUp = null;
  if (args.createFollowUp === true && row.subjectType && row.subjectId) {
    const fu = await createFollowUp(prisma, {
      admin: args.admin,
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      title: `Follow-up after cancelled meeting: ${(row.title || 'Meeting').slice(0, 80)}`,
      contactId: row.contactId,
      channel: CRM_COMMUNICATION_CHANNEL.EMAIL,
      purpose: CRM_CONSENT_PURPOSE.SALES_CONTACT,
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      ownerAdminId: row.ownerAdminId || args.admin?.id,
      now,
    });
    if (fu.ok) {
      followUp = fu.followUp;
    }
  }

  if (row.subjectType && row.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: row.subjectType,
      subjectId: row.subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.MEETING_CANCELLED,
      summary: `Meeting cancelled: ${(row.title || '').slice(0, 120)}`,
      payload: {
        meetingId,
        reason: args.reason || null,
        followUpId: followUp?.id || null,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    meeting: serializeMeeting(updated),
    followUp,
    integrations: getMeetingIntegrationContract(),
  };
}

/**
 * Record RSVP only — never sets attendance.
 */
export async function recordMeetingRsvp(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access) && !access.canView) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_rsvp_forbidden' };
  }

  if (!hasCrmMeetingParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'crm_meeting_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const rsvpStatus = String(args.rsvpStatus || '').trim().toUpperCase();
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!isValidMeetingRsvp(rsvpStatus)) {
    return { ok: false, error: 'invalid_rsvp_status', rsvpStatus };
  }

  const row = await prisma.crmMeetingParticipant.findUnique({
    where: { id: participantId },
  });
  if (!row) return { ok: false, error: 'participant_not_found' };
  if (args.meetingId && row.meetingId !== String(args.meetingId).trim()) {
    return { ok: false, error: 'participant_meeting_mismatch' };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmMeetingParticipant.update({
    where: { id: participantId },
    data: {
      rsvpStatus,
      // Explicitly do NOT touch attendanceStatus
      updatedAt: now,
    },
  });

  return {
    ok: true,
    participant: serializeMeetingParticipant(updated),
    fabricatedAttendance: false,
    integrations: getMeetingIntegrationContract(),
  };
}

/**
 * Authorised attendance confirmation — never from RSVP alone.
 */
export async function recordAttendance(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access)) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_attendance_forbidden' };
  }

  if (!hasCrmMeetingParticipantModel(prisma)) {
    return {
      ok: false,
      error: 'crm_meeting_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const participantId = args.participantId ? String(args.participantId).trim() : '';
  const attendanceStatus = String(args.attendanceStatus || '').trim().toUpperCase();
  if (!participantId) return { ok: false, error: 'participantId_required' };
  if (!isValidMeetingAttendance(attendanceStatus)) {
    return { ok: false, error: 'invalid_attendance_status', attendanceStatus };
  }
  if (attendanceStatus === CRM_MEETING_ATTENDANCE.UNKNOWN) {
    return { ok: false, error: 'attendance_status_must_be_confirmed' };
  }

  const row = await prisma.crmMeetingParticipant.findUnique({
    where: { id: participantId },
  });
  if (!row) return { ok: false, error: 'participant_not_found' };
  if (args.meetingId && row.meetingId !== String(args.meetingId).trim()) {
    return { ok: false, error: 'participant_meeting_mismatch' };
  }

  const now = args.now || new Date();
  const updated = await prisma.crmMeetingParticipant.update({
    where: { id: participantId },
    data: {
      attendanceStatus,
      attendanceRecordedByAdminId: args.admin?.id || null,
      attendanceRecordedAt: now,
      updatedAt: now,
    },
  });

  const meeting = await prisma.crmMeeting.findUnique({
    where: { id: row.meetingId },
  });
  if (meeting?.subjectType && meeting?.subjectId) {
    await appendTimelineEvent(prisma, {
      subjectType: meeting.subjectType,
      subjectId: meeting.subjectId,
      eventType: CRM_TIMELINE_EVENT_TYPE.MEETING_ATTENDANCE_RECORDED,
      summary: `Attendance recorded: ${attendanceStatus}`,
      payload: {
        meetingId: meeting.id,
        participantId,
        attendanceStatus,
        rsvpStatus: row.rsvpStatus,
        fromRsvpAlone: false,
      },
      actorAdminId: args.admin?.id || null,
      at: now,
    });
  }

  return {
    ok: true,
    participant: serializeMeetingParticipant(updated),
    fromRsvpAlone: false,
    integrations: getMeetingIntegrationContract(),
  };
}

export async function listMeetings(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditMeetings(access) && !access.canView && !access.canViewLeads) {
    return { ok: false, forbidden: true, reason: 'crm_meeting_list_forbidden' };
  }

  if (!hasCrmMeetingModel(prisma)) {
    return { ok: false, error: 'crm_meeting_model_unavailable', status: 'UNAVAILABLE' };
  }

  const where = {};
  if (args.status) where.status = String(args.status).trim().toUpperCase();
  if (args.subjectId) where.subjectId = String(args.subjectId).trim();
  if (args.ownerAdminId) where.ownerAdminId = String(args.ownerAdminId).trim();

  let rows = [];
  try {
    rows = await prisma.crmMeeting.findMany({ where });
  } catch {
    rows = [];
  }

  return {
    ok: true,
    meetings: (rows || []).map(serializeMeeting),
    integrations: getMeetingIntegrationContract(),
  };
}
