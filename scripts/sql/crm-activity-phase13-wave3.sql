-- Phase 13 Wave 3 — CrmMeeting + participants + reschedule history + CrmCalendarEvent (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- RSVP ≠ attendance; Google/Outlook NOT_CONNECTED; ICS export is application-layer.
-- Never alias Demo management or SupportSlaCalendar as Sales Meeting/Calendar.

CREATE TABLE IF NOT EXISTS "CrmMeeting" (
  "id" TEXT PRIMARY KEY,
  "meetingNumber" TEXT NOT NULL,
  "activityId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "title" TEXT,
  "outcome" TEXT,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "contactId" TEXT,
  "startsAtUtc" TIMESTAMP(3) NOT NULL,
  "endsAtUtc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "startsAtOriginal" TEXT,
  "endsAtOriginal" TEXT,
  "location" TEXT,
  "notes" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "consentBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "eligibilityJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmMeeting_meetingNumber_key" ON "CrmMeeting"("meetingNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmMeeting_idempotencyKey_key" ON "CrmMeeting"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmMeeting_activityId_idx" ON "CrmMeeting"("activityId");
CREATE INDEX IF NOT EXISTS "CrmMeeting_subject_status_idx"
  ON "CrmMeeting"("subjectType", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "CrmMeeting_status_startsAtUtc_idx"
  ON "CrmMeeting"("status", "startsAtUtc");
CREATE INDEX IF NOT EXISTS "CrmMeeting_owner_status_starts_idx"
  ON "CrmMeeting"("ownerAdminId", "status", "startsAtUtc");
CREATE INDEX IF NOT EXISTS "CrmMeeting_contactId_idx" ON "CrmMeeting"("contactId");

CREATE TABLE IF NOT EXISTS "CrmMeetingParticipant" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'REQUIRED',
  "rsvpStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "attendanceStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "attendanceRecordedByAdminId" TEXT,
  "attendanceRecordedAt" TIMESTAMP(3),
  "invitationStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  "eligibilityJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmMeetingParticipant_meeting_participant_role_key"
  ON "CrmMeetingParticipant"("meetingId", "participantType", "participantId", "role");
CREATE INDEX IF NOT EXISTS "CrmMeetingParticipant_meetingId_idx"
  ON "CrmMeetingParticipant"("meetingId");
CREATE INDEX IF NOT EXISTS "CrmMeetingParticipant_participant_idx"
  ON "CrmMeetingParticipant"("participantType", "participantId");
CREATE INDEX IF NOT EXISTS "CrmMeetingParticipant_rsvpStatus_idx"
  ON "CrmMeetingParticipant"("rsvpStatus");
CREATE INDEX IF NOT EXISTS "CrmMeetingParticipant_attendanceStatus_idx"
  ON "CrmMeetingParticipant"("attendanceStatus");

CREATE TABLE IF NOT EXISTS "CrmMeetingRescheduleHistory" (
  "id" TEXT PRIMARY KEY,
  "meetingId" TEXT NOT NULL,
  "fromStartsAtUtc" TIMESTAMP(3) NOT NULL,
  "fromEndsAtUtc" TIMESTAMP(3) NOT NULL,
  "fromTimezone" TEXT,
  "toStartsAtUtc" TIMESTAMP(3) NOT NULL,
  "toEndsAtUtc" TIMESTAMP(3) NOT NULL,
  "toTimezone" TEXT,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmMeetingRescheduleHistory_meeting_at_idx"
  ON "CrmMeetingRescheduleHistory"("meetingId", "at");
CREATE INDEX IF NOT EXISTS "CrmMeetingRescheduleHistory_changedBy_idx"
  ON "CrmMeetingRescheduleHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCalendarEvent" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT,
  "meetingId" TEXT,
  "title" TEXT,
  "startsAtUtc" TIMESTAMP(3) NOT NULL,
  "endsAtUtc" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL,
  "ownerAdminId" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "location" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_activityId_idx" ON "CrmCalendarEvent"("activityId");
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_meetingId_idx" ON "CrmCalendarEvent"("meetingId");
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_owner_starts_idx"
  ON "CrmCalendarEvent"("ownerAdminId", "startsAtUtc");
CREATE INDEX IF NOT EXISTS "CrmCalendarEvent_status_range_idx"
  ON "CrmCalendarEvent"("status", "startsAtUtc", "endsAtUtc");
