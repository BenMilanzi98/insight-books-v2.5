-- Phase 10 Wave 4 — SupportHandoff, SupportReconciliationRun, SupportExportAudit
-- (PostgreSQL). Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine,
-- or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. Ensure Wave 1–3 tables exist
--   2. psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave4.sql
--   3. App guards: hasSupportHandoffModel / hasSupportReconciliationRunModel
--   4. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- Support Ticket ≠ CsCase ≠ PlatformSupportAccess.
-- Handoffs are link-only — never mutate billing / MRA fiscal / Tenant GL / CsCase status.

CREATE TABLE IF NOT EXISTS "SupportHandoff" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "summary" TEXT,
  "targetRefId" TEXT,
  "featureCode" TEXT,
  "payload" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportHandoff_ticketId_createdAt_idx"
  ON "SupportHandoff"("ticketId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportHandoff_tenantId_targetType_idx"
  ON "SupportHandoff"("tenantId", "targetType");
CREATE INDEX IF NOT EXISTS "SupportHandoff_targetType_status_idx"
  ON "SupportHandoff"("targetType", "status");
CREATE INDEX IF NOT EXISTS "SupportHandoff_createdByAdminId_idx"
  ON "SupportHandoff"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "SupportReconciliationRun" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "summaryJson" TEXT NOT NULL,
  "runByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportReconciliationRun_status_createdAt_idx"
  ON "SupportReconciliationRun"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportReconciliationRun_runByAdminId_idx"
  ON "SupportReconciliationRun"("runByAdminId");

CREATE TABLE IF NOT EXISTS "SupportExportAudit" (
  "id" TEXT PRIMARY KEY,
  "adminId" TEXT,
  "dataset" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "rowCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportExportAudit_adminId_createdAt_idx"
  ON "SupportExportAudit"("adminId", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportExportAudit_dataset_createdAt_idx"
  ON "SupportExportAudit"("dataset", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportHandoff_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportHandoff"
      ADD CONSTRAINT "SupportHandoff_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportHandoff_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportHandoff"
      ADD CONSTRAINT "SupportHandoff_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportReconciliationRun_runByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportReconciliationRun"
      ADD CONSTRAINT "SupportReconciliationRun_runByAdminId_fkey"
      FOREIGN KEY ("runByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportExportAudit_adminId_fkey'
  ) THEN
    ALTER TABLE "SupportExportAudit"
      ADD CONSTRAINT "SupportExportAudit_adminId_fkey"
      FOREIGN KEY ("adminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
