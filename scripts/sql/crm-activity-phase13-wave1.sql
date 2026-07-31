-- Phase 13 Wave 1 — CrmActivity spine + Task/Note link + Follow-Up (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Activity ≠ Audit Event ≠ Analytics Event.
-- Task ≠ Call ≠ Meeting ≠ Demo; Note ≠ outbound; never alias CsTask.
-- One Activity; many timeline projections.

ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "activityId" TEXT;
ALTER TABLE "CrmTask" ADD COLUMN IF NOT EXISTS "taskNumber" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_taskNumber_key" ON "CrmTask"("taskNumber");
CREATE INDEX IF NOT EXISTS "CrmTask_activityId_idx" ON "CrmTask"("activityId");

ALTER TABLE "CrmNote" ADD COLUMN IF NOT EXISTS "activityId" TEXT;
CREATE INDEX IF NOT EXISTS "CrmNote_activityId_idx" ON "CrmNote"("activityId");

CREATE TABLE IF NOT EXISTS "CrmActivity" (
  "id" TEXT PRIMARY KEY,
  "activityNumber" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "direction" TEXT NOT NULL DEFAULT 'INTERNAL',
  "title" TEXT,
  "outcome" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "timezone" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "primarySubjectType" TEXT,
  "primarySubjectId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivity_activityNumber_key" ON "CrmActivity"("activityNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivity_idempotencyKey_key" ON "CrmActivity"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmActivity_type_status_idx" ON "CrmActivity"("type", "status");
CREATE INDEX IF NOT EXISTS "CrmActivity_owner_status_idx" ON "CrmActivity"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmActivity_primary_subject_idx"
  ON "CrmActivity"("primarySubjectType", "primarySubjectId");
CREATE INDEX IF NOT EXISTS "CrmActivity_status_dueAt_idx" ON "CrmActivity"("status", "dueAt");

CREATE TABLE IF NOT EXISTS "CrmActivityStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmActivityStatusHistory_activity_at_idx"
  ON "CrmActivityStatusHistory"("activityId", "at");

CREATE TABLE IF NOT EXISTS "CrmActivityRelation" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT NOT NULL,
  "relatedType" TEXT NOT NULL,
  "relatedId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'PRIMARY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivityRelation_unique"
  ON "CrmActivityRelation"("activityId", "relatedType", "relatedId", "role");
CREATE INDEX IF NOT EXISTS "CrmActivityRelation_related_idx"
  ON "CrmActivityRelation"("relatedType", "relatedId");

CREATE TABLE IF NOT EXISTS "CrmActivityParticipant" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'ASSIGNEE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivityParticipant_unique"
  ON "CrmActivityParticipant"("activityId", "participantType", "participantId", "role");
CREATE INDEX IF NOT EXISTS "CrmActivityParticipant_participant_idx"
  ON "CrmActivityParticipant"("participantType", "participantId");

CREATE TABLE IF NOT EXISTS "CrmFollowUp" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "title" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "channel" TEXT,
  "contactId" TEXT,
  "purpose" TEXT,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "consentBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "eligibilityJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmFollowUp_subject_status_idx"
  ON "CrmFollowUp"("subjectType", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "CrmFollowUp_activityId_idx" ON "CrmFollowUp"("activityId");
CREATE INDEX IF NOT EXISTS "CrmFollowUp_status_dueAt_idx" ON "CrmFollowUp"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmFollowUp_owner_status_idx" ON "CrmFollowUp"("ownerAdminId", "status");

CREATE TABLE IF NOT EXISTS "CrmFollowUpHistory" (
  "id" TEXT PRIMARY KEY,
  "followUpId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "dueAt" TIMESTAMP(3),
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmFollowUpHistory_followUp_at_idx"
  ON "CrmFollowUpHistory"("followUpId", "at");
