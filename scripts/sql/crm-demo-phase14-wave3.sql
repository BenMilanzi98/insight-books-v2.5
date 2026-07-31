-- Phase 14 Wave 3 — Logical Demo Environment + data packs + checklist/rehearsal
-- Safe to re-run (IF NOT EXISTS). Apply when prisma generate hits EPERM.

ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "requiresLogicalEnvironment" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "requiresChecklist" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "requiresRehearsal" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "environmentId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "pinnedChecklistId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "latestChecklistExecutionId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "latestRehearsalId" TEXT;
CREATE INDEX IF NOT EXISTS "CrmDemo_environmentId_idx" ON "CrmDemo"("environmentId");
CREATE INDEX IF NOT EXISTS "CrmDemo_pinnedChecklistId_idx" ON "CrmDemo"("pinnedChecklistId");
CREATE INDEX IF NOT EXISTS "CrmDemo_latestChecklistExecutionId_idx" ON "CrmDemo"("latestChecklistExecutionId");
CREATE INDEX IF NOT EXISTS "CrmDemo_latestRehearsalId_idx" ON "CrmDemo"("latestRehearsalId");

CREATE TABLE IF NOT EXISTS "CrmDemoDataPack" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "sourceKind" TEXT NOT NULL DEFAULT 'SYNTHETIC',
  "checksum" TEXT,
  "payloadJson" JSONB,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoDataPack_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoDataPack_code_version_key" ON "CrmDemoDataPack"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoDataPack_code_status_idx" ON "CrmDemoDataPack"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoDataPack_status_idx" ON "CrmDemoDataPack"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoDataPack_sourceKind_idx" ON "CrmDemoDataPack"("sourceKind");
CREATE INDEX IF NOT EXISTS "CrmDemoDataPack_authoredByAdminId_idx" ON "CrmDemoDataPack"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoDataPack_approvedByAdminId_idx" ON "CrmDemoDataPack"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoEnvironment" (
  "id" TEXT NOT NULL,
  "envNumber" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "healthStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "healthJson" JSONB,
  "dataPackId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "demoBannerVisible" BOOLEAN NOT NULL DEFAULT true,
  "cloudProvisionStatus" TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
  "mraEisSandboxAliased" BOOLEAN NOT NULL DEFAULT false,
  "productionConnections" BOOLEAN NOT NULL DEFAULT false,
  "connectionGuardsJson" JSONB,
  "logicalProvisionToken" TEXT,
  "provisionedAt" TIMESTAMP(3),
  "lastHealthAt" TIMESTAMP(3),
  "deprovisionedAt" TIMESTAMP(3),
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "requestIdempotencyKey" TEXT,
  "provisionIdempotencyKey" TEXT,
  "resetIdempotencyKey" TEXT,
  "deprovisionIdempotencyKey" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoEnvironment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoEnvironment_envNumber_key" ON "CrmDemoEnvironment"("envNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoEnvironment_requestIdempotencyKey_key" ON "CrmDemoEnvironment"("requestIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoEnvironment_provisionIdempotencyKey_key" ON "CrmDemoEnvironment"("provisionIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoEnvironment_resetIdempotencyKey_key" ON "CrmDemoEnvironment"("resetIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoEnvironment_deprovisionIdempotencyKey_key" ON "CrmDemoEnvironment"("deprovisionIdempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_demoId_status_idx" ON "CrmDemoEnvironment"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_status_expiresAt_idx" ON "CrmDemoEnvironment"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_healthStatus_idx" ON "CrmDemoEnvironment"("healthStatus");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_dataPackId_idx" ON "CrmDemoEnvironment"("dataPackId");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_requestedByAdminId_idx" ON "CrmDemoEnvironment"("requestedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoEnvironment_approvedByAdminId_idx" ON "CrmDemoEnvironment"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoChecklist" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "itemsJson" JSONB,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoChecklist_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoChecklist_code_version_key" ON "CrmDemoChecklist"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklist_code_status_idx" ON "CrmDemoChecklist"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklist_status_idx" ON "CrmDemoChecklist"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklist_authoredByAdminId_idx" ON "CrmDemoChecklist"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklist_approvedByAdminId_idx" ON "CrmDemoChecklist"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoChecklistExecution" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "checklistId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "resultsJson" JSONB,
  "criticalFailed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "executedByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoChecklistExecution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoChecklistExecution_idempotencyKey_key" ON "CrmDemoChecklistExecution"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklistExecution_demoId_status_idx" ON "CrmDemoChecklistExecution"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklistExecution_checklistId_idx" ON "CrmDemoChecklistExecution"("checklistId");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklistExecution_criticalFailed_idx" ON "CrmDemoChecklistExecution"("criticalFailed");
CREATE INDEX IF NOT EXISTS "CrmDemoChecklistExecution_executedByAdminId_idx" ON "CrmDemoChecklistExecution"("executedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoRehearsal" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "checklistExecutionId" TEXT,
  "outcome" TEXT NOT NULL,
  "issuesJson" JSONB,
  "criticalIssueCount" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoRehearsal_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoRehearsal_idempotencyKey_key" ON "CrmDemoRehearsal"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoRehearsal_demoId_outcome_idx" ON "CrmDemoRehearsal"("demoId", "outcome");
CREATE INDEX IF NOT EXISTS "CrmDemoRehearsal_checklistExecutionId_idx" ON "CrmDemoRehearsal"("checklistExecutionId");
CREATE INDEX IF NOT EXISTS "CrmDemoRehearsal_criticalIssueCount_idx" ON "CrmDemoRehearsal"("criticalIssueCount");
CREATE INDEX IF NOT EXISTS "CrmDemoRehearsal_performedByAdminId_idx" ON "CrmDemoRehearsal"("performedByAdminId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoEnvironment_demoId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoEnvironment"
      ADD CONSTRAINT "CrmDemoEnvironment_demoId_fkey"
      FOREIGN KEY ("demoId") REFERENCES "CrmDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoEnvironment_dataPackId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoEnvironment"
      ADD CONSTRAINT "CrmDemoEnvironment_dataPackId_fkey"
      FOREIGN KEY ("dataPackId") REFERENCES "CrmDemoDataPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoChecklistExecution_demoId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoChecklistExecution"
      ADD CONSTRAINT "CrmDemoChecklistExecution_demoId_fkey"
      FOREIGN KEY ("demoId") REFERENCES "CrmDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoChecklistExecution_checklistId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoChecklistExecution"
      ADD CONSTRAINT "CrmDemoChecklistExecution_checklistId_fkey"
      FOREIGN KEY ("checklistId") REFERENCES "CrmDemoChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoRehearsal_demoId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoRehearsal"
      ADD CONSTRAINT "CrmDemoRehearsal_demoId_fkey"
      FOREIGN KEY ("demoId") REFERENCES "CrmDemo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDemoRehearsal_checklistExecutionId_fkey'
  ) THEN
    ALTER TABLE "CrmDemoRehearsal"
      ADD CONSTRAINT "CrmDemoRehearsal_checklistExecutionId_fkey"
      FOREIGN KEY ("checklistExecutionId") REFERENCES "CrmDemoChecklistExecution"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
