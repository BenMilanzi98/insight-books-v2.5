-- Phase 12 Wave 1 — CrmPipeline*, CrmOpportunity*, stage history (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. psql "$DATABASE_URL" -f scripts/sql/crm-pipeline-phase12-wave1.sql
--   2. Ensure app code uses hasCrmOpportunityModel / hasCrmPipelineModel guards
--   3. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- CrmOpportunity ≠ Lead ≠ Customer ≠ Subscription ≠ Invoice.
-- OPP numbers use existing CrmNumberSeq (prefix OPP).

CREATE TABLE IF NOT EXISTS "CrmPipeline" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmPipeline_code_key"
  ON "CrmPipeline"("code");
CREATE INDEX IF NOT EXISTS "CrmPipeline_status_idx"
  ON "CrmPipeline"("status");

CREATE TABLE IF NOT EXISTS "CrmPipelineVersion" (
  "id" TEXT PRIMARY KEY,
  "pipelineId" TEXT NOT NULL,
  "versionId" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmPipelineVersion_pipelineId_versionId_key"
  ON "CrmPipelineVersion"("pipelineId", "versionId");
CREATE INDEX IF NOT EXISTS "CrmPipelineVersion_pipelineId_status_idx"
  ON "CrmPipelineVersion"("pipelineId", "status");
CREATE INDEX IF NOT EXISTS "CrmPipelineVersion_status_idx"
  ON "CrmPipelineVersion"("status");

CREATE TABLE IF NOT EXISTS "CrmPipelineStage" (
  "id" TEXT PRIMARY KEY,
  "pipelineVersionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "terminal" BOOLEAN NOT NULL DEFAULT FALSE,
  "defaultProbability" INTEGER,
  "entryCriteria" JSONB,
  "exitCriteria" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmPipelineStage_pipelineVersionId_code_key"
  ON "CrmPipelineStage"("pipelineVersionId", "code");
CREATE INDEX IF NOT EXISTS "CrmPipelineStage_pipelineVersionId_sortOrder_idx"
  ON "CrmPipelineStage"("pipelineVersionId", "sortOrder");

CREATE TABLE IF NOT EXISTS "CrmOpportunity" (
  "id" TEXT PRIMARY KEY,
  "opportunityNumber" TEXT NOT NULL,
  "pipelineCode" TEXT NOT NULL DEFAULT 'NEW_BUSINESS',
  "pipelineVersionId" TEXT,
  "stageCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "leadId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "title" TEXT NOT NULL,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "handoffIdempotencyKey" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunity_opportunityNumber_key"
  ON "CrmOpportunity"("opportunityNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunity_handoffIdempotencyKey_key"
  ON "CrmOpportunity"("handoffIdempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_stageCode_createdAt_idx"
  ON "CrmOpportunity"("stageCode", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_status_createdAt_idx"
  ON "CrmOpportunity"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_leadId_idx"
  ON "CrmOpportunity"("leadId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_accountId_idx"
  ON "CrmOpportunity"("accountId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_contactId_idx"
  ON "CrmOpportunity"("contactId");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_ownerAdminId_status_idx"
  ON "CrmOpportunity"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_pipelineCode_stageCode_idx"
  ON "CrmOpportunity"("pipelineCode", "stageCode");

CREATE TABLE IF NOT EXISTS "CrmOpportunityStageHistory" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "fromStageCode" TEXT,
  "toStageCode" TEXT NOT NULL,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "evidenceReferences" JSONB,
  "idempotencyKey" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunityStageHistory_opportunityId_idempotencyKey_key"
  ON "CrmOpportunityStageHistory"("opportunityId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmOpportunityStageHistory_opportunityId_at_idx"
  ON "CrmOpportunityStageHistory"("opportunityId", "at");
CREATE INDEX IF NOT EXISTS "CrmOpportunityStageHistory_changedByAdminId_idx"
  ON "CrmOpportunityStageHistory"("changedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmOpportunityStageHistory_toStageCode_at_idx"
  ON "CrmOpportunityStageHistory"("toStageCode", "at");

-- Seed ACTIVE NEW_BUSINESS Pipeline + version + stages (idempotent)
INSERT INTO "CrmPipeline" ("id", "code", "name", "status", "createdAt", "updatedAt")
VALUES (
  'pipeline-new-business',
  'NEW_BUSINESS',
  'New Business',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "CrmPipelineVersion" ("id", "pipelineId", "versionId", "version", "status", "createdAt", "updatedAt")
SELECT
  'pipeline-ver-new-business-v1',
  p."id",
  'crm-pipeline-new-business-v1-2026-07-30',
  'crm-pipeline-new-business-v1-2026-07-30',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CrmPipeline" p
WHERE p."code" = 'NEW_BUSINESS'
ON CONFLICT ("pipelineId", "versionId") DO NOTHING;

INSERT INTO "CrmPipelineStage" ("id", "pipelineVersionId", "code", "name", "sortOrder", "terminal", "defaultProbability", "createdAt", "updatedAt")
VALUES
  ('stage-nb-1', 'pipeline-ver-new-business-v1', 'OPPORTUNITY_IDENTIFIED', 'Opportunity Identified', 1, FALSE, 10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-2', 'pipeline-ver-new-business-v1', 'DISCOVERY', 'Discovery', 2, FALSE, 20, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-3', 'pipeline-ver-new-business-v1', 'NEED_CONFIRMED', 'Need Confirmed', 3, FALSE, 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-4', 'pipeline-ver-new-business-v1', 'SOLUTION_FIT', 'Solution Fit', 4, FALSE, 40, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-5', 'pipeline-ver-new-business-v1', 'COMMERCIAL_SCOPING', 'Commercial Scoping', 5, FALSE, 50, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-6', 'pipeline-ver-new-business-v1', 'DECISION_PROCESS', 'Decision Process', 6, FALSE, 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-7', 'pipeline-ver-new-business-v1', 'PROPOSAL_READY', 'Proposal Ready', 7, FALSE, 70, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-8', 'pipeline-ver-new-business-v1', 'CUSTOMER_DECISION', 'Customer Decision', 8, FALSE, 80, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-9', 'pipeline-ver-new-business-v1', 'CLOSED_WON', 'Closed Won', 9, TRUE, 100, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('stage-nb-10', 'pipeline-ver-new-business-v1', 'CLOSED_LOST', 'Closed Lost', 10, TRUE, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("pipelineVersionId", "code") DO NOTHING;

-- Foreign keys (idempotent DO $$ parity with Phase 11)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPipelineVersion_pipelineId_fkey'
  ) THEN
    ALTER TABLE "CrmPipelineVersion"
      ADD CONSTRAINT "CrmPipelineVersion_pipelineId_fkey"
      FOREIGN KEY ("pipelineId") REFERENCES "CrmPipeline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmPipelineStage_pipelineVersionId_fkey'
  ) THEN
    ALTER TABLE "CrmPipelineStage"
      ADD CONSTRAINT "CrmPipelineStage_pipelineVersionId_fkey"
      FOREIGN KEY ("pipelineVersionId") REFERENCES "CrmPipelineVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunity_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunity"
      ADD CONSTRAINT "CrmOpportunity_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunity_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunity"
      ADD CONSTRAINT "CrmOpportunity_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityStageHistory_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityStageHistory"
      ADD CONSTRAINT "CrmOpportunityStageHistory_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityStageHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityStageHistory"
      ADD CONSTRAINT "CrmOpportunityStageHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
