-- Phase 12 Wave 4 — EXPANSION/MRA_EIS seeds, Opportunity import/merge fields,
-- Opportunity duplicates, Pipeline report schedules/runs.
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use when Windows EPERM on query engine.
-- Safe to re-run (IF NOT EXISTS / DO $$ guards).
--
-- After apply:
--   1. Retry `npx prisma generate` when the engine file is unlocked
--   2. App uses hasCrm*Model guards until client methods exist
--
-- Weighted UI remains dark (Phase 16). Closed Won ≠ provision.

ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "importIdempotencyKey" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "mergedIntoOpportunityId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunity_importIdempotencyKey_key"
  ON "CrmOpportunity"("importIdempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_mergedIntoOpportunityId_idx"
  ON "CrmOpportunity"("mergedIntoOpportunityId");

CREATE TABLE IF NOT EXISTS "CrmOpportunityDuplicateCandidate" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "candidateOpportunityId" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "matchValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "confidence" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunityDuplicateCandidate_opportunityId_candidateOpportunityId_matchType_key"
  ON "CrmOpportunityDuplicateCandidate"("opportunityId", "candidateOpportunityId", "matchType");
CREATE INDEX IF NOT EXISTS "CrmOpportunityDuplicateCandidate_status_createdAt_idx"
  ON "CrmOpportunityDuplicateCandidate"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmOpportunityDuplicateCandidate_opportunityId_idx"
  ON "CrmOpportunityDuplicateCandidate"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmOpportunityDuplicateCandidate_candidateOpportunityId_idx"
  ON "CrmOpportunityDuplicateCandidate"("candidateOpportunityId");
CREATE INDEX IF NOT EXISTS "CrmOpportunityDuplicateCandidate_reviewedByAdminId_idx"
  ON "CrmOpportunityDuplicateCandidate"("reviewedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmPipelineReportSchedule" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "pipelineCode" TEXT,
  "cronExpression" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmPipelineReportSchedule_status_createdAt_idx"
  ON "CrmPipelineReportSchedule"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmPipelineReportSchedule_pipelineCode_idx"
  ON "CrmPipelineReportSchedule"("pipelineCode");
CREATE INDEX IF NOT EXISTS "CrmPipelineReportSchedule_createdByAdminId_idx"
  ON "CrmPipelineReportSchedule"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmPipelineReportRun" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT,
  "status" TEXT NOT NULL,
  "summaryJson" JSONB,
  "runByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmPipelineReportRun_at_idx"
  ON "CrmPipelineReportRun"("at");
CREATE INDEX IF NOT EXISTS "CrmPipelineReportRun_scheduleId_at_idx"
  ON "CrmPipelineReportRun"("scheduleId", "at");
CREATE INDEX IF NOT EXISTS "CrmPipelineReportRun_status_at_idx"
  ON "CrmPipelineReportRun"("status", "at");
CREATE INDEX IF NOT EXISTS "CrmPipelineReportRun_runByAdminId_idx"
  ON "CrmPipelineReportRun"("runByAdminId");

-- Optional ACTIVE catalogue seeds for EXPANSION + MRA_EIS (idempotent by code).
INSERT INTO "CrmPipeline" ("id", "code", "name", "status", "createdAt", "updatedAt")
SELECT 'pipeline-expansion-seed', 'EXPANSION', 'Expansion', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CrmPipeline" WHERE "code" = 'EXPANSION');

INSERT INTO "CrmPipeline" ("id", "code", "name", "status", "createdAt", "updatedAt")
SELECT 'pipeline-mra-eis-seed', 'MRA_EIS', 'MRA / EIS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "CrmPipeline" WHERE "code" = 'MRA_EIS');

INSERT INTO "CrmPipelineVersion" ("id", "pipelineId", "versionId", "version", "status", "createdAt", "updatedAt")
SELECT
  'pipeline-expansion-v1',
  p."id",
  'crm-pipeline-expansion-v1-2026-07-30',
  'crm-pipeline-expansion-v1-2026-07-30',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CrmPipeline" p
WHERE p."code" = 'EXPANSION'
  AND NOT EXISTS (
    SELECT 1 FROM "CrmPipelineVersion" v
    WHERE v."pipelineId" = p."id" AND v."versionId" = 'crm-pipeline-expansion-v1-2026-07-30'
  );

INSERT INTO "CrmPipelineVersion" ("id", "pipelineId", "versionId", "version", "status", "createdAt", "updatedAt")
SELECT
  'pipeline-mra-eis-v1',
  p."id",
  'crm-pipeline-mra-eis-v1-2026-07-30',
  'crm-pipeline-mra-eis-v1-2026-07-30',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CrmPipeline" p
WHERE p."code" = 'MRA_EIS'
  AND NOT EXISTS (
    SELECT 1 FROM "CrmPipelineVersion" v
    WHERE v."pipelineId" = p."id" AND v."versionId" = 'crm-pipeline-mra-eis-v1-2026-07-30'
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityDuplicateCandidate_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityDuplicateCandidate"
      ADD CONSTRAINT "CrmOpportunityDuplicateCandidate_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityDuplicateCandidate_candidateOpportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityDuplicateCandidate"
      ADD CONSTRAINT "CrmOpportunityDuplicateCandidate_candidateOpportunityId_fkey"
      FOREIGN KEY ("candidateOpportunityId") REFERENCES "CrmOpportunity"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityDuplicateCandidate_reviewedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityDuplicateCandidate"
      ADD CONSTRAINT "CrmOpportunityDuplicateCandidate_reviewedByAdminId_fkey"
      FOREIGN KEY ("reviewedByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPipelineReportSchedule_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmPipelineReportSchedule"
      ADD CONSTRAINT "CrmPipelineReportSchedule_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPipelineReportRun_scheduleId_fkey'
  ) THEN
    ALTER TABLE "CrmPipelineReportRun"
      ADD CONSTRAINT "CrmPipelineReportRun_scheduleId_fkey"
      FOREIGN KEY ("scheduleId") REFERENCES "CrmPipelineReportSchedule"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPipelineReportRun_runByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmPipelineReportRun"
      ADD CONSTRAINT "CrmPipelineReportRun_runByAdminId_fkey"
      FOREIGN KEY ("runByAdminId") REFERENCES "Admin"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
