-- Phase 8 Wave 3 — CsCase, CsTask, CsIntervention, CsRenewalWorkspace (PostgreSQL).
-- Prefer: npx prisma db push (or migrate). Use this when prisma db push hits Windows EPERM
-- on the query engine, or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- CS actions never mutate AccountSubscription / PlatformInvoice / EIS source facts.

CREATE TABLE IF NOT EXISTS "CsCase" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "portfolioId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "severity" TEXT,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "triggerType" TEXT NOT NULL,
  "triggerCode" TEXT,
  "definitionVersion" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "signalId" TEXT,
  "snapshotId" TEXT,
  "ownerAdminId" TEXT,
  "openedByAdminId" TEXT,
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Drop legacy forever-unique key (blocks re-open after close).
DROP INDEX IF EXISTS "CsCase_idempotencyKey_key";
-- Idempotency: at most one OPEN/IN_PROGRESS case per key; closed/resolved may reuse.
CREATE UNIQUE INDEX IF NOT EXISTS "CsCase_open_idempotencyKey_key"
  ON "CsCase"("idempotencyKey")
  WHERE "status" IN ('OPEN', 'IN_PROGRESS');
CREATE INDEX IF NOT EXISTS "CsCase_idempotencyKey_idx"
  ON "CsCase"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CsCase_tenantId_status_idx"
  ON "CsCase"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsCase_status_openedAt_idx"
  ON "CsCase"("status", "openedAt");
CREATE INDEX IF NOT EXISTS "CsCase_triggerType_triggerCode_idx"
  ON "CsCase"("triggerType", "triggerCode");
CREATE INDEX IF NOT EXISTS "CsCase_ownerAdminId_status_idx"
  ON "CsCase"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CsCase_portfolioId_idx"
  ON "CsCase"("portfolioId");

CREATE TABLE IF NOT EXISTS "CsTask" (
  "id" TEXT PRIMARY KEY,
  "caseId" TEXT,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigneeAdminId" TEXT,
  "dueAt" TIMESTAMP(3),
  "stepId" TEXT,
  "executionId" TEXT,
  "idempotencyKey" TEXT,
  "notes" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CsTask_idempotencyKey_key"
  ON "CsTask"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CsTask_tenantId_status_idx"
  ON "CsTask"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsTask_caseId_status_idx"
  ON "CsTask"("caseId", "status");
CREATE INDEX IF NOT EXISTS "CsTask_assigneeAdminId_status_idx"
  ON "CsTask"("assigneeAdminId", "status");
CREATE INDEX IF NOT EXISTS "CsTask_executionId_stepId_idx"
  ON "CsTask"("executionId", "stepId");

CREATE TABLE IF NOT EXISTS "CsIntervention" (
  "id" TEXT PRIMARY KEY,
  "caseId" TEXT,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "notes" TEXT,
  "channel" TEXT,
  "performedByAdminId" TEXT,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsIntervention_tenantId_performedAt_idx"
  ON "CsIntervention"("tenantId", "performedAt");
CREATE INDEX IF NOT EXISTS "CsIntervention_caseId_performedAt_idx"
  ON "CsIntervention"("caseId", "performedAt");
CREATE INDEX IF NOT EXISTS "CsIntervention_type_idx"
  ON "CsIntervention"("type");

CREATE TABLE IF NOT EXISTS "CsRenewalWorkspace" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "periodKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "outcome" TEXT,
  "outcomeAt" TIMESTAMP(3),
  "outcomeByAdminId" TEXT,
  "subscriptionId" TEXT,
  "evidenceNote" TEXT,
  "notes" TEXT,
  "openedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CsRenewalWorkspace_tenantId_periodKey_key"
  ON "CsRenewalWorkspace"("tenantId", "periodKey");
CREATE INDEX IF NOT EXISTS "CsRenewalWorkspace_tenantId_status_idx"
  ON "CsRenewalWorkspace"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsRenewalWorkspace_outcome_idx"
  ON "CsRenewalWorkspace"("outcome");
CREATE INDEX IF NOT EXISTS "CsRenewalWorkspace_periodKey_idx"
  ON "CsRenewalWorkspace"("periodKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsCase_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsCase"
      ADD CONSTRAINT "CsCase_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsTask_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsTask"
      ADD CONSTRAINT "CsTask_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsTask_caseId_fkey'
  ) THEN
    ALTER TABLE "CsTask"
      ADD CONSTRAINT "CsTask_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "CsCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsIntervention_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsIntervention"
      ADD CONSTRAINT "CsIntervention_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsIntervention_caseId_fkey'
  ) THEN
    ALTER TABLE "CsIntervention"
      ADD CONSTRAINT "CsIntervention_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "CsCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsRenewalWorkspace_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsRenewalWorkspace"
      ADD CONSTRAINT "CsRenewalWorkspace_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Phase 8 Wave 4 — playbooks, plans, handoffs, foundation stubs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "CsPlaybook" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "steps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CsPlaybook_key_version_key"
  ON "CsPlaybook"("key", "version");
CREATE INDEX IF NOT EXISTS "CsPlaybook_status_key_idx"
  ON "CsPlaybook"("status", "key");

CREATE TABLE IF NOT EXISTS "CsPlaybookExecution" (
  "id" TEXT PRIMARY KEY,
  "playbookId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "caseId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "playbookVersion" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "startedByAdminId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CsPlaybookExecution_idempotencyKey_key"
  ON "CsPlaybookExecution"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CsPlaybookExecution_tenantId_status_idx"
  ON "CsPlaybookExecution"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsPlaybookExecution_playbookId_startedAt_idx"
  ON "CsPlaybookExecution"("playbookId", "startedAt");
CREATE INDEX IF NOT EXISTS "CsPlaybookExecution_caseId_idx"
  ON "CsPlaybookExecution"("caseId");

CREATE TABLE IF NOT EXISTS "CsSuccessPlan" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "summary" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "startedAt" TIMESTAMP(3),
  "targetAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsSuccessPlan_tenantId_status_idx"
  ON "CsSuccessPlan"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsSuccessPlan_ownerAdminId_status_idx"
  ON "CsSuccessPlan"("ownerAdminId", "status");

CREATE TABLE IF NOT EXISTS "CsSuccessGoal" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "targetNote" TEXT,
  "dueAt" TIMESTAMP(3),
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsSuccessGoal_planId_status_idx"
  ON "CsSuccessGoal"("planId", "status");
CREATE INDEX IF NOT EXISTS "CsSuccessGoal_planId_sortOrder_idx"
  ON "CsSuccessGoal"("planId", "sortOrder");

CREATE TABLE IF NOT EXISTS "CsExpansionHandoff" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reason" TEXT,
  "notes" TEXT,
  "recommendedAction" TEXT NOT NULL DEFAULT 'OTHER',
  "createdByAdminId" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsExpansionHandoff_tenantId_status_idx"
  ON "CsExpansionHandoff"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsExpansionHandoff_recommendedAction_idx"
  ON "CsExpansionHandoff"("recommendedAction");
CREATE INDEX IF NOT EXISTS "CsExpansionHandoff_createdAt_idx"
  ON "CsExpansionHandoff"("createdAt");

CREATE TABLE IF NOT EXISTS "CsOnboardingRecord" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "checklistKey" TEXT,
  "status" TEXT,
  "completedAt" TIMESTAMP(3),
  "sourceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsOnboardingRecord_tenantId_status_idx"
  ON "CsOnboardingRecord"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsOnboardingRecord_checklistKey_idx"
  ON "CsOnboardingRecord"("checklistKey");

CREATE TABLE IF NOT EXISTS "CsTrainingRecord" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "moduleKey" TEXT,
  "status" TEXT,
  "completedAt" TIMESTAMP(3),
  "sourceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsTrainingRecord_tenantId_status_idx"
  ON "CsTrainingRecord"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsTrainingRecord_moduleKey_idx"
  ON "CsTrainingRecord"("moduleKey");

CREATE TABLE IF NOT EXISTS "CsSurveyResponse" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "surveyKey" TEXT,
  "status" TEXT,
  "score" INTEGER,
  "completedAt" TIMESTAMP(3),
  "sourceNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CsSurveyResponse_tenantId_status_idx"
  ON "CsSurveyResponse"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CsSurveyResponse_surveyKey_idx"
  ON "CsSurveyResponse"("surveyKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsPlaybookExecution_playbookId_fkey'
  ) THEN
    ALTER TABLE "CsPlaybookExecution"
      ADD CONSTRAINT "CsPlaybookExecution_playbookId_fkey"
      FOREIGN KEY ("playbookId") REFERENCES "CsPlaybook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsPlaybookExecution_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsPlaybookExecution"
      ADD CONSTRAINT "CsPlaybookExecution_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsSuccessPlan_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsSuccessPlan"
      ADD CONSTRAINT "CsSuccessPlan_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsSuccessGoal_planId_fkey'
  ) THEN
    ALTER TABLE "CsSuccessGoal"
      ADD CONSTRAINT "CsSuccessGoal_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "CsSuccessPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsExpansionHandoff_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsExpansionHandoff"
      ADD CONSTRAINT "CsExpansionHandoff_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsOnboardingRecord_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsOnboardingRecord"
      ADD CONSTRAINT "CsOnboardingRecord_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsTrainingRecord_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsTrainingRecord"
      ADD CONSTRAINT "CsTrainingRecord_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CsSurveyResponse_tenantId_fkey'
  ) THEN
    ALTER TABLE "CsSurveyResponse"
      ADD CONSTRAINT "CsSurveyResponse_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
