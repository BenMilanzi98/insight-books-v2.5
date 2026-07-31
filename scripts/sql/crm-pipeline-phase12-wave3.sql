-- Phase 12 Wave 3 — win/loss close fields + Opportunity risks.
-- Apply when `prisma db push` / migrate hits Windows EPERM on the Prisma engine DLL.
-- Safe to re-run (IF NOT EXISTS / DO $$ guards).
--
-- After apply:
--   1. Retry `npx prisma generate` when the engine file is unlocked
--   2. App code uses hasCrmOpportunity*Model guards until client methods exist
--
-- Never provisions Tenant / Subscription / Invoice. Weighted UI remains dark (Phase 16).

ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "winReason" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "lossReason" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "decisionDate" TIMESTAMP(3);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closeEvidence" JSONB;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closedByAdminId" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closeApprovalStatus" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "reopenReason" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "reopenedByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "CrmOpportunity_closedAt_idx"
  ON "CrmOpportunity"("closedAt");

CREATE TABLE IF NOT EXISTS "CrmOpportunityRisk" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "detail" TEXT,
  "signalSource" TEXT NOT NULL DEFAULT 'DETERMINISTIC',
  "evidenceJson" JSONB,
  "createdByAdminId" TEXT,
  "mitigatedAt" TIMESTAMP(3),
  "mitigationNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunityRisk_opportunityId_code_key"
  ON "CrmOpportunityRisk"("opportunityId", "code");
CREATE INDEX IF NOT EXISTS "CrmOpportunityRisk_opportunityId_status_idx"
  ON "CrmOpportunityRisk"("opportunityId", "status");
CREATE INDEX IF NOT EXISTS "CrmOpportunityRisk_severity_status_idx"
  ON "CrmOpportunityRisk"("severity", "status");
CREATE INDEX IF NOT EXISTS "CrmOpportunityRisk_createdByAdminId_idx"
  ON "CrmOpportunityRisk"("createdByAdminId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunity_closedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunity"
      ADD CONSTRAINT "CrmOpportunity_closedByAdminId_fkey"
      FOREIGN KEY ("closedByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunity_reopenedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunity"
      ADD CONSTRAINT "CrmOpportunity_reopenedByAdminId_fkey"
      FOREIGN KEY ("reopenedByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityRisk_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityRisk"
      ADD CONSTRAINT "CrmOpportunityRisk_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityRisk_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityRisk"
      ADD CONSTRAINT "CrmOpportunityRisk_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
