-- Business Setup Wizard — Setup Run aggregate (Slice 1).

CREATE TABLE IF NOT EXISTS "BusinessSetupRun" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "setupVersion" INTEGER NOT NULL DEFAULT 1,
  "setupType" TEXT NOT NULL DEFAULT 'NEW_BUSINESS',
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "currentStepId" TEXT NOT NULL DEFAULT 'profile',
  "openingBalanceDate" TIMESTAMP(3),
  "cutoverDate" TIMESTAMP(3),
  "financialYearLabel" TEXT,
  "accountingPeriodId" TEXT,
  "baseCurrency" TEXT,
  "timezone" TEXT,
  "completionPercent" INTEGER NOT NULL DEFAULT 0,
  "draftVersion" INTEGER NOT NULL DEFAULT 1,
  "activityClassification" TEXT,
  "conversionApprovedAt" TIMESTAMP(3),
  "conversionApprovedBy" TEXT,
  "sourceChecksum" TEXT,
  "openingBalanceBatchId" TEXT,
  "journalEntryId" TEXT,
  "reopenReason" TEXT,
  "reversalReference" TEXT,
  "createdById" TEXT,
  "lastUpdatedById" TEXT,
  "submittedById" TEXT,
  "reviewedById" TEXT,
  "approvedById" TEXT,
  "postedById" TEXT,
  "submittedAt" TIMESTAMP(3),
  "reviewedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "postedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSetupRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSetupRun_tenantId_setupVersion_key"
  ON "BusinessSetupRun"("tenantId", "setupVersion");

CREATE INDEX IF NOT EXISTS "BusinessSetupRun_tenantId_status_idx"
  ON "BusinessSetupRun"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "BusinessSetupRun_tenantId_updatedAt_idx"
  ON "BusinessSetupRun"("tenantId", "updatedAt");

CREATE TABLE IF NOT EXISTS "BusinessSetupStep" (
  "id" TEXT NOT NULL,
  "setupRunId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "stepId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "optional" BOOLEAN NOT NULL DEFAULT false,
  "payload" JSONB,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "blockerCount" INTEGER NOT NULL DEFAULT 0,
  "lastSavedAt" TIMESTAMP(3),
  "lastSavedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BusinessSetupStep_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BusinessSetupStep_setupRunId_stepId_key"
  ON "BusinessSetupStep"("setupRunId", "stepId");

CREATE INDEX IF NOT EXISTS "BusinessSetupStep_tenantId_stepId_idx"
  ON "BusinessSetupStep"("tenantId", "stepId");

CREATE INDEX IF NOT EXISTS "BusinessSetupStep_setupRunId_status_idx"
  ON "BusinessSetupStep"("setupRunId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BusinessSetupStep_setupRunId_fkey'
  ) THEN
    ALTER TABLE "BusinessSetupStep"
      ADD CONSTRAINT "BusinessSetupStep_setupRunId_fkey"
      FOREIGN KEY ("setupRunId") REFERENCES "BusinessSetupRun"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
