-- MRA EIS Phase 8 — configuration synchronization foundation
-- Additive. No Sale/Journal/Stock mutations. No credential plaintext columns.

ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "trigger" TEXT;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "requestedConfigurationTypes" JSONB;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "currentVersionSummary" JSONB;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "serviceIdentity" TEXT;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "snapshotsCreated" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "snapshotsUnchanged" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "conflictsFound" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "validationFailures" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "mappingConflicts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "attemptCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "claimOwner" TEXT;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "claimExpiresAt" TIMESTAMP(3);
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "safeErrorSummary" TEXT;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "businessDate" TEXT;
ALTER TABLE "MraEisSyncRun" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS "MraEisSyncRun_status_nextAttemptAt_idx" ON "MraEisSyncRun"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "MraEisSyncRun_claimExpiresAt_idx" ON "MraEisSyncRun"("claimExpiresAt");

CREATE TABLE IF NOT EXISTS "MraEisConfigFetchAttempt" (
  "id" TEXT NOT NULL,
  "syncRunId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "configurationType" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "endpointKey" TEXT NOT NULL,
  "requestContractVersion" TEXT NOT NULL DEFAULT '1',
  "requestChecksum" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "httpStatus" INTEGER,
  "mraApplicationStatus" TEXT,
  "responseChecksum" TEXT,
  "outcome" TEXT,
  "retryClassification" TEXT,
  "safeErrorCode" TEXT,
  "safeErrorSummary" TEXT,
  "sanitizedResponse" JSONB,
  "requestId" TEXT,
  "correlationId" TEXT,
  "workerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisConfigFetchAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisConfigFetchAttempt_run_type_attempt_key"
  ON "MraEisConfigFetchAttempt"("syncRunId","configurationType","attemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisConfigFetchAttempt_terminal_type_idx"
  ON "MraEisConfigFetchAttempt"("terminalId","configurationType","startedAt");

CREATE TABLE IF NOT EXISTS "MraEisExternalTaxDefinition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "environment" TEXT NOT NULL,
  "configurationSnapshotId" TEXT NOT NULL,
  "externalTaxId" TEXT NOT NULL,
  "externalTaxCode" TEXT,
  "name" TEXT,
  "description" TEXT,
  "rate" DECIMAL(18,6),
  "chargeMode" TEXT,
  "category" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "sourceChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisExternalTaxDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisExternalTaxDefinition_snap_tax_key"
  ON "MraEisExternalTaxDefinition"("configurationSnapshotId","externalTaxId");
CREATE INDEX IF NOT EXISTS "MraEisExternalTaxDefinition_scope_idx"
  ON "MraEisExternalTaxDefinition"("tenantId","businessId","environment");

CREATE TABLE IF NOT EXISTS "MraEisExternalLevyDefinition" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "environment" TEXT NOT NULL,
  "configurationSnapshotId" TEXT NOT NULL,
  "externalLevyId" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT,
  "description" TEXT,
  "rate" DECIMAL(18,6),
  "chargeMode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "sourceChecksum" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisExternalLevyDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisExternalLevyDefinition_snap_levy_key"
  ON "MraEisExternalLevyDefinition"("configurationSnapshotId","externalLevyId");

CREATE TABLE IF NOT EXISTS "MraEisConfigurationPolicy" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "globalConfigurationSnapshotId" TEXT,
  "terminalConfigurationSnapshotId" TEXT,
  "taxpayerConfigurationSnapshotId" TEXT,
  "activeVersionSummary" JSONB,
  "taxDefinitionVersion" TEXT,
  "levyDefinitionVersion" TEXT,
  "offlineAllowedByMra" BOOLEAN NOT NULL DEFAULT false,
  "offlineMaximumAmount" DECIMAL(18,2),
  "offlineMaximumAgeHours" INTEGER,
  "receiptPolicyVersion" TEXT,
  "terminalBlocked" BOOLEAN NOT NULL DEFAULT false,
  "nextRequiredSyncAt" TIMESTAMP(3),
  "configurationEffectiveFrom" TIMESTAMP(3),
  "configurationEffectiveTo" TIMESTAMP(3),
  "mappingRevalidationRequired" BOOLEAN NOT NULL DEFAULT false,
  "policyChecksum" TEXT NOT NULL,
  "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisConfigurationPolicy_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisConfigurationPolicy_terminalId_key" ON "MraEisConfigurationPolicy"("terminalId");
CREATE INDEX IF NOT EXISTS "MraEisConfigurationPolicy_scope_idx"
  ON "MraEisConfigurationPolicy"("tenantId","businessId","environment");
