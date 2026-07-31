/**
 * Demo attendance — Phase 14 Wave 4.
 * Source-backed only; RSVP ≠ attendance; never invent from ACCEPTED.
 */

import {
  CRM_DEMO_ATTENDANCE_SOURCE,
  CRM_DEMO_ATTENDANCE_STATUS,
  CRM_MEETING_ATTENDANCE,
  CRM_SUBJECT_TYPE,
  CRM_TIMELINE_EVENT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { appendTimelineEvent } from '../timeline.js';
import {
  getDemoDomainContract,
  isValidDemoAttendanceSource,
  isValidDemoAttendanceStatus,
} from './catalogue.js';
import {
  hasCrmDemoParticipantModel,
  serializeDemoParticipant,
} from './model.js';
import { canEditDemos, canViewDemos, loadDemo } from './service.js';

export function hasCrmDemoAttendanceModel(prisma) {
  return typeof prisma?.crmDemoAttendance?.create === 'function';
}

export function serializeDemoAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    demoId: row.demoId,
    participantRecordId: row.participantRecordId || null,
    participantType: row.participantType,
    participantId: row.participantId,
    attendanceStatus: row.attendanceStatus,
    source: row.source,
    meetingParticipantId: row.meetingParticipantId || null,
    recordedByAdminId: row.recordedByAdminId || null,
    recordedAt: row.recordedAt ? new Date(row.recordedAt).toISOString() : null,
    notes: row.notes || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
    rsvpEqualsAttendance: false,
  };
}

/**
 * Authorised attendance confirmation — never from RSVP alone.
 */
export async function recordDemoAttendance(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_attendance_forbidden' };
  }
  if (!hasCrmDemoAttendanceModel(prisma)) {
    return {
      ok: false,
      error: 'crm_demo_attendance_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };

  const attendanceStatus = String(args.attendanceStatus || '')
    .trim()
    .toUpperCase();
  if (!isValidDemoAttendanceStatus(attendanceStatus)) {
    return { ok: false, error: 'invalid_attendance_status' };
  }
  if (attendanceStatus === CRM_DEMO_ATTENDANCE_STATUS.UNKNOWN) {
    return { ok: false, error: 'attendance_status_must_be_confirmed' };
  }

  const source = String(
    args.source || CRM_DEMO_ATTENDANCE_SOURCE.AUTHORISED_CONFIRMATION
  )
    .trim()
    .toUpperCase();
  if (!isValidDemoAttendanceSource(source)) {
    return { ok: false, error: 'invalid_attendance_source' };
  }

  // Explicitly reject inventing from RSVP
  if (
    args.fromRsvp === true ||
    String(args.source || '').toUpperCase() === 'RSVP' ||
    String(args.source || '').toUpperCase() === 'RSVP_ACCEPTED'
  ) {
    return {
      ok: false,
      error: 'rsvp_equals_attendance_forbidden',
      domain: getDemoDomainContract(),
    };
  }

  let participantType = args.participantType
    ? String(args.participantType).trim().toUpperCase()
    : null;
  let participantId = args.participantId
    ? String(args.participantId).trim()
    : null;
  let participantRecordId = args.participantRecordId
    ? String(args.participantRecordId).trim()
    : null;

  if (participantRecordId && hasCrmDemoParticipantModel(prisma)) {
    const participant = await prisma.crmDemoParticipant.findUnique({
      where: { id: participantRecordId },
    });
    if (!participant || participant.demoId !== demo.id) {
      return { ok: false, notFound: true, error: 'participant_not_found' };
    }
    participantType = participant.participantType;
    participantId = participant.participantId;
  }

  if (!participantType || !participantId) {
    return { ok: false, error: 'participant_required' };
  }

  const idempotencyKey = args.idempotencyKey
    ? String(args.idempotencyKey).trim()
    : `demo-attendance:${demo.id}:${participantType}:${participantId}`;

  const existing = await prisma.crmDemoAttendance.findUnique({
    where: { idempotencyKey },
  });
  if (existing) {
    return {
      ok: true,
      attendance: serializeDemoAttendance(existing),
      idempotentReplay: true,
      domain: getDemoDomainContract(),
    };
  }

  const now = args.now || new Date();
  const row = await prisma.crmDemoAttendance.create({
    data: {
      demoId: demo.id,
      participantRecordId,
      participantType,
      participantId,
      attendanceStatus,
      source,
      meetingParticipantId: args.meetingParticipantId
        ? String(args.meetingParticipantId).trim()
        : null,
      recordedByAdminId: args.admin?.id || null,
      recordedAt: now,
      notes: args.notes != null ? String(args.notes).trim() : null,
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    },
  });

  if (participantRecordId && hasCrmDemoParticipantModel(prisma)) {
    try {
      await prisma.crmDemoParticipant.update({
        where: { id: participantRecordId },
        data: { attendanceStatus, updatedAt: now },
      });
    } catch {
      // best-effort projection onto participant
    }
  }

  await appendTimelineEvent(prisma, {
    subjectType: CRM_SUBJECT_TYPE.DEMO,
    subjectId: demo.id,
    eventType: CRM_TIMELINE_EVENT_TYPE.DEMO_ATTENDANCE_RECORDED,
    summary: `Demo attendance: ${attendanceStatus} (${source})`,
    payload: {
      attendanceStatus,
      source,
      participantType,
      participantId,
      rsvpEqualsAttendance: false,
    },
    actorAdminId: args.admin?.id || null,
    at: now,
  });

  return {
    ok: true,
    attendance: serializeDemoAttendance(row),
    domain: getDemoDomainContract(),
  };
}

/**
 * Project from authorised Meeting attendance when Demo is linked.
 * RSVP ACCEPTED alone never projects ATTENDED.
 */
export async function projectAttendanceFromMeeting(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canEditDemos(access)) {
    return { ok: false, forbidden: true, reason: 'crm_demo_attendance_forbidden' };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found' };
  if (!demo.meetingId) {
    return { ok: false, error: 'demo_meeting_required' };
  }

  if (typeof prisma?.crmMeetingParticipant?.findMany !== 'function') {
    return {
      ok: false,
      error: 'crm_meeting_participant_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  let meetingParticipants = [];
  try {
    meetingParticipants = await prisma.crmMeetingParticipant.findMany({
      where: { meetingId: demo.meetingId },
    });
  } catch {
    return { ok: false, error: 'meeting_participant_query_failed' };
  }

  const results = [];
  for (const mp of meetingParticipants) {
    const att = String(mp.attendanceStatus || CRM_MEETING_ATTENDANCE.UNKNOWN)
      .trim()
      .toUpperCase();
    if (
      att !== CRM_MEETING_ATTENDANCE.ATTENDED &&
      att !== CRM_MEETING_ATTENDANCE.NO_SHOW &&
      att !== CRM_MEETING_ATTENDANCE.EXCUSED
    ) {
      // RSVP alone — skip (never invent)
      continue;
    }

    const mapped =
      att === CRM_MEETING_ATTENDANCE.ATTENDED
        ? CRM_DEMO_ATTENDANCE_STATUS.ATTENDED
        : att === CRM_MEETING_ATTENDANCE.NO_SHOW
          ? CRM_DEMO_ATTENDANCE_STATUS.NO_SHOW
          : CRM_DEMO_ATTENDANCE_STATUS.EXCUSED;

    const recorded = await recordDemoAttendance(prisma, {
      admin: args.admin,
      demoId: demo.id,
      participantType: mp.participantType || 'CONTACT',
      participantId: mp.participantId || mp.contactId || mp.id,
      attendanceStatus: mapped,
      source: CRM_DEMO_ATTENDANCE_SOURCE.MEETING_ATTENDANCE_PROJECTION,
      meetingParticipantId: mp.id,
      idempotencyKey: `demo-attendance-meeting:${demo.id}:${mp.id}`,
      now: args.now,
    });
    results.push(recorded);
  }

  return {
    ok: true,
    projected: results.filter((r) => r.ok).map((r) => r.attendance),
    skippedRsvpOnly: true,
    domain: getDemoDomainContract(),
  };
}

export async function listDemoAttendance(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!canViewDemos(access)) {
    return {
      ok: false,
      forbidden: true,
      reason: 'crm_demo_attendance_view_forbidden',
      items: [],
    };
  }
  if (!hasCrmDemoAttendanceModel(prisma)) {
    return {
      ok: true,
      items: [],
      meta: { unavailable: true, status: 'UNAVAILABLE' },
    };
  }

  const demo = await loadDemo(prisma, args.demoId);
  if (!demo) return { ok: false, notFound: true, error: 'demo_not_found', items: [] };

  const rows = await prisma.crmDemoAttendance.findMany({
    where: { demoId: demo.id },
    orderBy: { recordedAt: 'desc' },
    take: Math.min(100, Number(args.limit) || 50),
  });

  return {
    ok: true,
    items: (rows || []).map(serializeDemoAttendance),
    meta: {
      count: (rows || []).length,
      rsvpEqualsAttendance: false,
      inventAttendanceForbidden: true,
    },
  };
}

export { serializeDemoParticipant };
