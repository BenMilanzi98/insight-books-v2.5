-- Phase 19 — MRA EIS migration source registry, runs, and record lineage

CREATE TABLE IF NOT EXISTS "MraEisMigrationSourceSystem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "systemVersion" TEXT,
    "databaseEngine" TEXT,
    "schemaVersion" TEXT,
    "environmentClassification" TEXT NOT NULL,
    "tenantScope" TEXT,
    "businessScope" TEXT,
    "locationReference" TEXT,
    "credentialReference" TEXT,
    "readOnlyVerified" BOOLEAN NOT NULL DEFAULT false,
    "extractionMethod" TEXT,
    "sourceTimezone" TEXT,
    "sourceCurrency" TEXT,
    "dataPeriodStart" TIMESTAMP(3),
    "dataPeriodEnd" TIMESTAMP(3),
    "sourceOwner" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisMigrationSourceSystem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisMigrationSourceSystem_status_idx"
  ON "MraEisMigrationSourceSystem"("status");
CREATE INDEX IF NOT EXISTS "MraEisMigrationSourceSystem_sourceType_environmentClassification_idx"
  ON "MraEisMigrationSourceSystem"("sourceType", "environmentClassification");

CREATE TABLE IF NOT EXISTS "MraEisMigrationRun" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "sourceSystemId" TEXT,
    "tenantId" TEXT,
    "businessId" TEXT,
    "environment" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "manifestId" TEXT,
    "manifestChecksum" TEXT,
    "dryRunChecksum" TEXT,
    "resultChecksum" TEXT,
    "transformationVersion" TEXT NOT NULL,
    "startedBy" TEXT,
    "approvedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "assessedRecords" INTEGER NOT NULL DEFAULT 0,
    "eligibleRecords" INTEGER NOT NULL DEFAULT 0,
    "migratedRecords" INTEGER NOT NULL DEFAULT 0,
    "linkedRecords" INTEGER NOT NULL DEFAULT 0,
    "quarantinedRecords" INTEGER NOT NULL DEFAULT 0,
    "failedRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "rollbackEligible" BOOLEAN NOT NULL DEFAULT true,
    "rollbackState" TEXT,
    "summaryJson" JSONB,
    "correlationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisMigrationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisMigrationRun_tenantId_businessId_state_idx"
  ON "MraEisMigrationRun"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRun_cohortId_environment_idx"
  ON "MraEisMigrationRun"("cohortId", "environment");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRun_mode_state_idx"
  ON "MraEisMigrationRun"("mode", "state");

CREATE TABLE IF NOT EXISTS "MraEisMigrationRecord" (
    "id" TEXT NOT NULL,
    "migrationRunId" TEXT NOT NULL,
    "sourceSystemId" TEXT,
    "sourceEntityType" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "sourceNaturalKey" TEXT NOT NULL,
    "sourceChecksum" TEXT NOT NULL,
    "lineageKey" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessId" TEXT,
    "environment" TEXT,
    "decision" TEXT NOT NULL,
    "integrityScore" INTEGER,
    "integrityBand" TEXT,
    "saleClassification" TEXT,
    "targetEntityType" TEXT,
    "targetRecordId" TEXT,
    "targetChecksum" TEXT,
    "transformationVersion" TEXT,
    "state" TEXT NOT NULL,
    "blockersJson" JSONB,
    "warningsJson" JSONB,
    "manualReviewCaseId" TEXT,
    "rollbackState" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisMigrationRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisMigrationRecord_lineageKey_key"
  ON "MraEisMigrationRecord"("lineageKey");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRecord_migrationRunId_state_idx"
  ON "MraEisMigrationRecord"("migrationRunId", "state");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRecord_tenantId_businessId_idx"
  ON "MraEisMigrationRecord"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRecord_sourceNaturalKey_idx"
  ON "MraEisMigrationRecord"("sourceNaturalKey");
CREATE INDEX IF NOT EXISTS "MraEisMigrationRecord_decision_state_idx"
  ON "MraEisMigrationRecord"("decision", "state");

DO $$ BEGIN
  ALTER TABLE "MraEisMigrationRecord"
    ADD CONSTRAINT "MraEisMigrationRecord_migrationRunId_fkey"
    FOREIGN KEY ("migrationRunId") REFERENCES "MraEisMigrationRun"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
