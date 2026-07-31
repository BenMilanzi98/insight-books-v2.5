-- Phase 10 Wave 3 — SupportSlaPolicy, SupportSlaCalendar, SupportSlaClock, SupportSlaEvent
-- (PostgreSQL). Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine,
-- or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. Ensure Wave 1–2 tables exist
--   2. psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave3.sql
--   3. App guards: hasSupportSlaClockModel
--   4. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- Support Ticket ≠ CsCase ≠ PlatformSupportAccess.
-- Breach events are append-only — do not DELETE/UPDATE breach facts in app code.

CREATE TABLE IF NOT EXISTS "SupportSlaPolicy" (
  "id" TEXT PRIMARY KEY,
  "versionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "ackCountsAsFirstResponse" BOOLEAN NOT NULL DEFAULT FALSE,
  "resolutionStartsOn" TEXT NOT NULL DEFAULT 'CREATE',
  "stopResolutionOnClosed" BOOLEAN NOT NULL DEFAULT TRUE,
  "pauseOnWaitingForCustomer" BOOLEAN NOT NULL DEFAULT TRUE,
  "pauseOnWaitingForInternalTeam" BOOLEAN NOT NULL DEFAULT TRUE,
  "pauseOnWaitingForVendor" BOOLEAN NOT NULL DEFAULT TRUE,
  "targetsJson" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportSlaPolicy_versionId_key"
  ON "SupportSlaPolicy"("versionId");
CREATE INDEX IF NOT EXISTS "SupportSlaPolicy_active_idx"
  ON "SupportSlaPolicy"("active");

CREATE TABLE IF NOT EXISTS "SupportSlaCalendar" (
  "id" TEXT PRIMARY KEY,
  "versionId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "definitionJson" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportSlaCalendar_versionId_key"
  ON "SupportSlaCalendar"("versionId");
CREATE INDEX IF NOT EXISTS "SupportSlaCalendar_active_idx"
  ON "SupportSlaCalendar"("active");

CREATE TABLE IF NOT EXISTS "SupportSlaClock" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "clockType" TEXT NOT NULL,
  "state" TEXT NOT NULL DEFAULT 'RUNNING',
  "policyVersion" TEXT NOT NULL,
  "calendarVersion" TEXT NOT NULL,
  "targetBusinessMs" INTEGER NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "pausedMs" INTEGER NOT NULL DEFAULT 0,
  "stoppedAt" TIMESTAMP(3),
  "breachedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportSlaClock_ticketId_clockType_idx"
  ON "SupportSlaClock"("ticketId", "clockType");
CREATE INDEX IF NOT EXISTS "SupportSlaClock_ticketId_state_idx"
  ON "SupportSlaClock"("ticketId", "state");
CREATE INDEX IF NOT EXISTS "SupportSlaClock_state_dueAt_idx"
  ON "SupportSlaClock"("state", "dueAt");
CREATE INDEX IF NOT EXISTS "SupportSlaClock_policyVersion_idx"
  ON "SupportSlaClock"("policyVersion");
CREATE INDEX IF NOT EXISTS "SupportSlaClock_calendarVersion_idx"
  ON "SupportSlaClock"("calendarVersion");

CREATE TABLE IF NOT EXISTS "SupportSlaEvent" (
  "id" TEXT PRIMARY KEY,
  "clockId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metaJson" TEXT
);

CREATE INDEX IF NOT EXISTS "SupportSlaEvent_clockId_at_idx"
  ON "SupportSlaEvent"("clockId", "at");
CREATE INDEX IF NOT EXISTS "SupportSlaEvent_clockId_eventType_idx"
  ON "SupportSlaEvent"("clockId", "eventType");
CREATE INDEX IF NOT EXISTS "SupportSlaEvent_eventType_at_idx"
  ON "SupportSlaEvent"("eventType", "at");

-- Foreign keys (idempotent; matches prisma/schema.prisma Support* onDelete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportSlaPolicy_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportSlaPolicy"
      ADD CONSTRAINT "SupportSlaPolicy_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportSlaCalendar_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportSlaCalendar"
      ADD CONSTRAINT "SupportSlaCalendar_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportSlaClock_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportSlaClock"
      ADD CONSTRAINT "SupportSlaClock_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportSlaEvent_clockId_fkey'
  ) THEN
    ALTER TABLE "SupportSlaEvent"
      ADD CONSTRAINT "SupportSlaEvent_clockId_fkey"
      FOREIGN KEY ("clockId") REFERENCES "SupportSlaClock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
