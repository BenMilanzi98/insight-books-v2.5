-- Phase 8 Wave 1 — CustomerHealthDefinition + CustomerHealthSnapshot (PostgreSQL).
-- Prefer: npx prisma db push (or migrate). Use this when prisma db push hits Windows EPERM
-- on the query engine, or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Snapshots are immutable: rebuild creates a new row (never lib/admin/health/snapshots.js).

CREATE TABLE IF NOT EXISTS "CustomerHealthDefinition" (
  "id" TEXT PRIMARY KEY,
  "version" TEXT NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB NOT NULL,
  "activatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CustomerHealthDefinition_version_key"
  ON "CustomerHealthDefinition"("version");

CREATE INDEX IF NOT EXISTS "CustomerHealthDefinition_isActive_activatedAt_idx"
  ON "CustomerHealthDefinition"("isActive", "activatedAt");

CREATE TABLE IF NOT EXISTS "CustomerHealthSnapshot" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "definitionVersion" TEXT NOT NULL,
  "score" DOUBLE PRECISION,
  "band" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "asOf" TIMESTAMP(3) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerHealthSnapshot_tenantId_createdAt_idx"
  ON "CustomerHealthSnapshot"("tenantId", "createdAt");

CREATE INDEX IF NOT EXISTS "CustomerHealthSnapshot_band_createdAt_idx"
  ON "CustomerHealthSnapshot"("band", "createdAt");

CREATE INDEX IF NOT EXISTS "CustomerHealthSnapshot_definitionVersion_idx"
  ON "CustomerHealthSnapshot"("definitionVersion");

CREATE INDEX IF NOT EXISTS "CustomerHealthSnapshot_asOf_idx"
  ON "CustomerHealthSnapshot"("asOf");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerHealthSnapshot_tenantId_fkey'
  ) THEN
    ALTER TABLE "CustomerHealthSnapshot"
      ADD CONSTRAINT "CustomerHealthSnapshot_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN duplicate_object THEN
    NULL;
END $$;
