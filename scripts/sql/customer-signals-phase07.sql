-- Phase 7 Wave 4 — CustomerSignal persistence (PostgreSQL).
-- Prefer: npx prisma db push (or migrate). Use this when prisma db push hits Windows EPERM
-- on the query engine, or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- When this table is missing, signal evaluation falls back to ephemeral mode
-- (documented in FINAL_PHASE_07_REPORT / signals.js).

CREATE TABLE IF NOT EXISTS "CustomerSignal" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "payload" JSONB,
  "firstDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastDetectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ruleVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerSignal_tenantId_code_key"
  ON "CustomerSignal"("tenantId", "code");

CREATE INDEX IF NOT EXISTS "CustomerSignal_tenantId_status_idx"
  ON "CustomerSignal"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "CustomerSignal_status_severity_idx"
  ON "CustomerSignal"("status", "severity");

CREATE INDEX IF NOT EXISTS "CustomerSignal_code_status_idx"
  ON "CustomerSignal"("code", "status");

CREATE INDEX IF NOT EXISTS "CustomerSignal_lastDetectedAt_idx"
  ON "CustomerSignal"("lastDetectedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerSignal_tenantId_fkey'
  ) THEN
    ALTER TABLE "CustomerSignal"
      ADD CONSTRAINT "CustomerSignal_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- Tenant table name may differ in some envs
  WHEN duplicate_object THEN
    NULL;
END $$;
