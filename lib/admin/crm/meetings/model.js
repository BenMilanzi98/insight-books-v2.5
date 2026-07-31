/**
 * CrmMeeting model guards + serialize — Phase 13 Wave 3.
 * RSVP ≠ attendance; never invent ATTENDED from ACCEPTED.
 */

import {
  CRM_MEETING_ATTENDANCE,
  CRM_MEETING_INVITATION_STATUS,
  CRM_MEETING_RSVP,
} from '../catalogue.js';
import { getMeetingIntegrationContract } from './catalogue.js';

export function hasCrmMeetingModel(prisma) {
  return typeof prisma?.crmMeeting?.create === 'function';
}

export function hasCrmMeetingParticipantModel(prisma) {
  return typeof prisma?.crmMeetingParticipant?.create === 'function';
}

export function hasCrmMeetingRescheduleHistoryModel(prisma) {
  return typeof prisma?.crmMeetingRescheduleHistory?.create === 'function';
}

export function serializeMeeting(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingNumber: row.meetingNumber,
    activityId: row.activityId || null,
    status: row.status,
    title: row.title || null,
    outcome: row.outcome || null,
    subjectType: row.subjectType || null,
    subjectId: row.subjectId || null,
    contactId: row.contactId || null,
    startsAtUtc: row.startsAtUtc ? new Date(row.startsAtUtc).toISOString() : null,
    endsAtUtc: row.endsAtUtc ? new Date(row.endsAtUtc).toISOString() : null,
    timezone: row.timezone || null,
    startsAtOriginal: row.startsAtOriginal || null,
    endsAtOriginal: row.endsAtOriginal || null,
    location: row.location || null,
    notes: row.notes || null,
    visibility: row.visibility || 'PUBLIC',
    consentBlocked: Boolean(row.consentBlocked),
    eligibilityJson: row.eligibilityJson ?? null,
    ownerAdminId: row.ownerAdminId || null,
    createdByAdminId: row.createdByAdminId || null,
    idempotencyKey: row.idempotencyKey || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeMeetingParticipant(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meetingId,
    participantType: row.participantType,
    participantId: row.participantId,
    role: row.role || 'REQUIRED',
    rsvpStatus: row.rsvpStatus || CRM_MEETING_RSVP.PENDING,
    /** Attendance never inferred from RSVP */
    attendanceStatus: row.attendanceStatus || CRM_MEETING_ATTENDANCE.UNKNOWN,
    attendanceRecordedByAdminId: row.attendanceRecordedByAdminId || null,
    attendanceRecordedAt: row.attendanceRecordedAt
      ? new Date(row.attendanceRecordedAt).toISOString()
      : null,
    invitationStatus: row.invitationStatus || CRM_MEETING_INVITATION_STATUS.NOT_SENT,
    eligibilityJson: row.eligibilityJson ?? null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export function serializeRescheduleHistory(row) {
  if (!row) return null;
  return {
    id: row.id,
    meetingId: row.meetingId,
    fromStartsAtUtc: row.fromStartsAtUtc
      ? new Date(row.fromStartsAtUtc).toISOString()
      : null,
    fromEndsAtUtc: row.fromEndsAtUtc ? new Date(row.fromEndsAtUtc).toISOString() : null,
    fromTimezone: row.fromTimezone || null,
    toStartsAtUtc: row.toStartsAtUtc ? new Date(row.toStartsAtUtc).toISOString() : null,
    toEndsAtUtc: row.toEndsAtUtc ? new Date(row.toEndsAtUtc).toISOString() : null,
    toTimezone: row.toTimezone || null,
    reason: row.reason || null,
    changedByAdminId: row.changedByAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

export { getMeetingIntegrationContract };
