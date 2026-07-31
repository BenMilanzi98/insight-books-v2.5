-- Phase 10 Wave 2 — SupportMessage, SupportAttachment, SupportQueue, SupportTeam,
-- SupportTeamMembership, SupportAssignmentHistory (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine,
-- or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. Ensure Wave 1 tables exist (scripts/sql/support-ops-phase10-wave1.sql)
--   2. psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave2.sql
--   3. App guards: hasSupportMessageModel / hasSupportAttachmentModel /
--      hasSupportQueueModel / hasSupportAssignmentHistoryModel
--   4. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- Storage: attachment bytes live under storage/support-attachments/ (gitignored),
-- opaque storageKey in DB — never public/uploads.
-- Support Ticket ≠ CsCase ≠ PlatformSupportAccess.

CREATE TABLE IF NOT EXISTS "SupportMessage" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "authorAdminId" TEXT,
  "visibility" TEXT,
  "systemEventCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_createdAt_idx"
  ON "SupportMessage"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportMessage_ticketId_type_idx"
  ON "SupportMessage"("ticketId", "type");
CREATE INDEX IF NOT EXISTS "SupportMessage_authorAdminId_idx"
  ON "SupportMessage"("authorAdminId");

CREATE TABLE IF NOT EXISTS "SupportAttachment" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storageKey" TEXT NOT NULL,
  "scanState" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
  "uploadedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "scannedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportAttachment_storageKey_key"
  ON "SupportAttachment"("storageKey");
CREATE INDEX IF NOT EXISTS "SupportAttachment_ticketId_scanState_idx"
  ON "SupportAttachment"("ticketId", "scanState");
CREATE INDEX IF NOT EXISTS "SupportAttachment_scanState_idx"
  ON "SupportAttachment"("scanState");
CREATE INDEX IF NOT EXISTS "SupportAttachment_uploadedByAdminId_idx"
  ON "SupportAttachment"("uploadedByAdminId");

CREATE TABLE IF NOT EXISTS "SupportQueue" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "typicalOwnership" TEXT,
  "liveStatus" TEXT NOT NULL DEFAULT 'NOT_FOUND',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportQueue_code_key"
  ON "SupportQueue"("code");
CREATE INDEX IF NOT EXISTS "SupportQueue_active_idx"
  ON "SupportQueue"("active");

CREATE TABLE IF NOT EXISTS "SupportTeam" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "queueCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTeam_code_key"
  ON "SupportTeam"("code");
CREATE INDEX IF NOT EXISTS "SupportTeam_active_idx"
  ON "SupportTeam"("active");

CREATE TABLE IF NOT EXISTS "SupportTeamMembership" (
  "id" TEXT PRIMARY KEY,
  "teamCode" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTeamMembership_teamCode_adminId_key"
  ON "SupportTeamMembership"("teamCode", "adminId");
CREATE INDEX IF NOT EXISTS "SupportTeamMembership_adminId_idx"
  ON "SupportTeamMembership"("adminId");

CREATE TABLE IF NOT EXISTS "SupportAssignmentHistory" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "fromAssigneeAdminId" TEXT,
  "toAssigneeAdminId" TEXT,
  "fromQueueCode" TEXT,
  "toQueueCode" TEXT,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportAssignmentHistory_ticketId_at_idx"
  ON "SupportAssignmentHistory"("ticketId", "at");
CREATE INDEX IF NOT EXISTS "SupportAssignmentHistory_changedByAdminId_idx"
  ON "SupportAssignmentHistory"("changedByAdminId");
CREATE INDEX IF NOT EXISTS "SupportAssignmentHistory_toAssigneeAdminId_idx"
  ON "SupportAssignmentHistory"("toAssigneeAdminId");

-- Foreign keys (idempotent; matches prisma/schema.prisma Support* onDelete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportMessage_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportMessage"
      ADD CONSTRAINT "SupportMessage_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportMessage_authorAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportMessage"
      ADD CONSTRAINT "SupportMessage_authorAdminId_fkey"
      FOREIGN KEY ("authorAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportAttachment_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportAttachment"
      ADD CONSTRAINT "SupportAttachment_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportAttachment_uploadedByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportAttachment"
      ADD CONSTRAINT "SupportAttachment_uploadedByAdminId_fkey"
      FOREIGN KEY ("uploadedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTeamMembership_teamCode_fkey'
  ) THEN
    ALTER TABLE "SupportTeamMembership"
      ADD CONSTRAINT "SupportTeamMembership_teamCode_fkey"
      FOREIGN KEY ("teamCode") REFERENCES "SupportTeam"("code") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTeamMembership_adminId_fkey'
  ) THEN
    ALTER TABLE "SupportTeamMembership"
      ADD CONSTRAINT "SupportTeamMembership_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportAssignmentHistory_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportAssignmentHistory"
      ADD CONSTRAINT "SupportAssignmentHistory_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportAssignmentHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportAssignmentHistory"
      ADD CONSTRAINT "SupportAssignmentHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- Optional seed of queue catalogue (definitions only; liveStatus = NOT_FOUND)
INSERT INTO "SupportQueue" ("id", "code", "name", "typicalOwnership", "liveStatus", "active")
VALUES
  (md5(random()::text || clock_timestamp()::text), 'GENERAL_SUPPORT', 'GENERAL_SUPPORT', 'Support', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'ACCOUNT_ACCESS', 'ACCOUNT_ACCESS', 'Support/Technical', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'BILLING', 'BILLING', 'Support/Finance', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'MRA_EIS', 'MRA_EIS', 'EIS specialists', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'PRODUCT', 'PRODUCT', 'Product/Support', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'TECHNICAL', 'TECHNICAL', 'Technical', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'ANDROID', 'ANDROID', 'Mobile', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'SECURITY', 'SECURITY', 'Security', 'NOT_FOUND', TRUE),
  (md5(random()::text || clock_timestamp()::text), 'ESCALATIONS', 'ESCALATIONS', 'Managers', 'NOT_FOUND', TRUE)
ON CONFLICT ("code") DO NOTHING;
