-- Phase 14 Wave 1 — CrmDemoRequest + CrmDemo + participants + status history (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Demo ≠ Meeting; convert ≠ Opportunity create; RSVP ≠ attendance.
-- Never alias MRA EIS sandbox as Demo Environment.

CREATE TABLE IF NOT EXISTS "CrmDemoRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "leadId" TEXT,
  "opportunityId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "title" TEXT,
  "notes" TEXT,
  "source" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "convertedDemoId" TEXT,
  "convertIdempotencyKey" TEXT,
  "rejectedReason" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoRequest_requestNumber_key" ON "CrmDemoRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoRequest_convertIdempotencyKey_key" ON "CrmDemoRequest"("convertIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoRequest_idempotencyKey_key" ON "CrmDemoRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoRequest_status_createdAt_idx" ON "CrmDemoRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmDemoRequest_leadId_idx" ON "CrmDemoRequest"("leadId");
CREATE INDEX IF NOT EXISTS "CrmDemoRequest_opportunityId_idx" ON "CrmDemoRequest"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmDemoRequest_contactId_idx" ON "CrmDemoRequest"("contactId");
CREATE INDEX IF NOT EXISTS "CrmDemoRequest_owner_status_idx" ON "CrmDemoRequest"("ownerAdminId", "status");

CREATE TABLE IF NOT EXISTS "CrmDemo" (
  "id" TEXT PRIMARY KEY,
  "demoNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "readinessStatus" TEXT NOT NULL DEFAULT 'NOT_READY',
  "readinessJson" JSONB,
  "requestId" TEXT,
  "leadId" TEXT,
  "opportunityId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "meetingId" TEXT,
  "calendarEventId" TEXT,
  "title" TEXT,
  "notes" TEXT,
  "timezone" TEXT,
  "startsAtUtc" TIMESTAMP(3),
  "endsAtUtc" TIMESTAMP(3),
  "startsAtOriginal" TEXT,
  "endsAtOriginal" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "convertIdempotencyKey" TEXT,
  "scheduleIdempotencyKey" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemo_demoNumber_key" ON "CrmDemo"("demoNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemo_convertIdempotencyKey_key" ON "CrmDemo"("convertIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemo_scheduleIdempotencyKey_key" ON "CrmDemo"("scheduleIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemo_idempotencyKey_key" ON "CrmDemo"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemo_status_createdAt_idx" ON "CrmDemo"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmDemo_readinessStatus_idx" ON "CrmDemo"("readinessStatus");
CREATE INDEX IF NOT EXISTS "CrmDemo_leadId_idx" ON "CrmDemo"("leadId");
CREATE INDEX IF NOT EXISTS "CrmDemo_opportunityId_idx" ON "CrmDemo"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmDemo_requestId_idx" ON "CrmDemo"("requestId");
CREATE INDEX IF NOT EXISTS "CrmDemo_meetingId_idx" ON "CrmDemo"("meetingId");
CREATE INDEX IF NOT EXISTS "CrmDemo_owner_status_idx" ON "CrmDemo"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemo_contactId_idx" ON "CrmDemo"("contactId");

CREATE TABLE IF NOT EXISTS "CrmDemoParticipant" (
  "id" TEXT PRIMARY KEY,
  "demoId" TEXT NOT NULL,
  "participantType" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'REQUIRED',
  "rsvpStatus" TEXT NOT NULL DEFAULT 'PENDING',
  "attendanceStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "invitationStatus" TEXT NOT NULL DEFAULT 'NOT_SENT',
  "eligibilityJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoParticipant_demo_participant_role_key"
  ON "CrmDemoParticipant"("demoId", "participantType", "participantId", "role");
CREATE INDEX IF NOT EXISTS "CrmDemoParticipant_demoId_idx" ON "CrmDemoParticipant"("demoId");
CREATE INDEX IF NOT EXISTS "CrmDemoParticipant_participant_idx"
  ON "CrmDemoParticipant"("participantType", "participantId");
CREATE INDEX IF NOT EXISTS "CrmDemoParticipant_role_idx" ON "CrmDemoParticipant"("role");

CREATE TABLE IF NOT EXISTS "CrmDemoStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "demoId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmDemoStatusHistory_demo_at_idx" ON "CrmDemoStatusHistory"("demoId", "at");
CREATE INDEX IF NOT EXISTS "CrmDemoStatusHistory_changedBy_idx" ON "CrmDemoStatusHistory"("changedByAdminId");
