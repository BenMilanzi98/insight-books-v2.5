-- Phase 18 Wave 2 — Participants, trainers, cohorts, Sessions, attendance, materials.
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Session ↔ Phase 13 CrmMeeting. RSVP ≠ attendance. Invitation/calendar/link ≠ attendance.
-- Numbers: COH-YYYY-###### / TRS-YYYY-###### via CrmNumberSeq.

CREATE TABLE IF NOT EXISTS "CustomerTrainingCohort" (
  "id" TEXT PRIMARY KEY,
  "cohortNumber" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "name" TEXT,
  "language" TEXT,
  "deliveryMode" TEXT,
  "timezone" TEXT,
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCohort_cohortNumber_key"
  ON "CustomerTrainingCohort"("cohortNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCohort_idempotencyKey_key"
  ON "CustomerTrainingCohort"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingCohort_program_status_idx"
  ON "CustomerTrainingCohort"("programId", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingParticipant" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "contactId" TEXT,
  "tenantUserId" TEXT,
  "externalId" TEXT,
  "identityType" TEXT,
  "identityKey" TEXT NOT NULL,
  "verificationState" TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION',
  "displayName" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingParticipant_program_identity_key"
  ON "CustomerTrainingParticipant"("programId", "identityKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingParticipant_program_verification_idx"
  ON "CustomerTrainingParticipant"("programId", "verificationState");
CREATE INDEX IF NOT EXISTS "CustomerTrainingParticipant_contactId_idx"
  ON "CustomerTrainingParticipant"("contactId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingParticipant_tenantUserId_idx"
  ON "CustomerTrainingParticipant"("tenantUserId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingEnrolment" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "cohortId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ENROLLED',
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingEnrolment_idempotencyKey_key"
  ON "CustomerTrainingEnrolment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingEnrolment_program_participant_key"
  ON "CustomerTrainingEnrolment"("programId", "participantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingEnrolment_cohort_status_idx"
  ON "CustomerTrainingEnrolment"("cohortId", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingTrainer" (
  "id" TEXT PRIMARY KEY,
  "adminId" TEXT,
  "displayName" TEXT,
  "skillsJson" JSONB,
  "languagesJson" JSONB,
  "deliveryModesJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingTrainer_adminId_idx"
  ON "CustomerTrainingTrainer"("adminId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingTrainer_status_idx"
  ON "CustomerTrainingTrainer"("status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingSession" (
  "id" TEXT PRIMARY KEY,
  "sessionNumber" TEXT NOT NULL,
  "programId" TEXT NOT NULL,
  "cohortId" TEXT,
  "crmMeetingId" TEXT,
  "timezone" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "conflictState" TEXT,
  "sessionDelivered" BOOLEAN NOT NULL DEFAULT FALSE,
  "rsvpSummaryJson" JSONB,
  "attendanceSummaryJson" JSONB,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingSession_sessionNumber_key"
  ON "CustomerTrainingSession"("sessionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingSession_idempotencyKey_key"
  ON "CustomerTrainingSession"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingSession_program_status_idx"
  ON "CustomerTrainingSession"("programId", "status");
CREATE INDEX IF NOT EXISTS "CustomerTrainingSession_cohortId_idx"
  ON "CustomerTrainingSession"("cohortId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingSession_crmMeetingId_idx"
  ON "CustomerTrainingSession"("crmMeetingId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingTrainerAssignment" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "trainerId" TEXT NOT NULL,
  "conflictState" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingTrainerAssignment_idempotencyKey_key"
  ON "CustomerTrainingTrainerAssignment"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingTrainerAssignment_session_trainer_key"
  ON "CustomerTrainingTrainerAssignment"("sessionId", "trainerId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingTrainerAssignment_trainerId_idx"
  ON "CustomerTrainingTrainerAssignment"("trainerId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingTrainerAssignment_programId_idx"
  ON "CustomerTrainingTrainerAssignment"("programId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAttendance" (
  "id" TEXT PRIMARY KEY,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT,
  "originalStatus" TEXT,
  "correctsAttendanceId" TEXT,
  "supersededById" TEXT,
  "correctionReason" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingAttendance_idempotencyKey_key"
  ON "CustomerTrainingAttendance"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAttendance_session_participant_idx"
  ON "CustomerTrainingAttendance"("sessionId", "participantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAttendance_corrects_idx"
  ON "CustomerTrainingAttendance"("correctsAttendanceId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingMaterial" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "title" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
  "storageRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingMaterial_program_class_idx"
  ON "CustomerTrainingMaterial"("programId", "classification");

CREATE TABLE IF NOT EXISTS "CustomerTrainingConflict" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT,
  "sessionId" TEXT,
  "trainerId" TEXT,
  "conflictState" TEXT NOT NULL,
  "reasonsJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingConflict_session_state_idx"
  ON "CustomerTrainingConflict"("sessionId", "conflictState");
CREATE INDEX IF NOT EXISTS "CustomerTrainingConflict_programId_idx"
  ON "CustomerTrainingConflict"("programId");

-- Ensure CrmNumberSeq can allocate COH / TRS (rows created lazily by allocateCrmNumber).
