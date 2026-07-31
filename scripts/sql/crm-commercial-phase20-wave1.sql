-- Phase 20 Wave 1 — CrmCommercialAcceptance.authorityStatus (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- authorityStatus is persisted (not mock-only). Role string alone ≠ VERIFIED.
-- Default UNKNOWN for backfill; accept path writes VERIFIED after recipient authority check.

ALTER TABLE "CrmCommercialAcceptance"
  ADD COLUMN IF NOT EXISTS "authorityStatus" TEXT NOT NULL DEFAULT 'UNKNOWN';

CREATE INDEX IF NOT EXISTS "CrmCommercialAcceptance_authorityStatus_idx"
  ON "CrmCommercialAcceptance"("authorityStatus");
