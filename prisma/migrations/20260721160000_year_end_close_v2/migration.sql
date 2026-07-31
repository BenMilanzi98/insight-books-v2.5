-- Phase 12: Year-End / Month-End Closing Framework (CloseV2*)
-- Additive, business-scoped. Continuous GL: no opening-balance reset tables.

CREATE TABLE IF NOT EXISTS "CloseV2Configuration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "closeMethod" TEXT NOT NULL DEFAULT 'INCOME_SUMMARY_TO_RETAINED_EARNINGS',
    "monthlyCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "yearEndCloseEnabled" BOOLEAN NOT NULL DEFAULT true,
    "incomeSummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "incomeSummaryAccountId" TEXT,
    "currentYearEarningsAccountId" TEXT,
    "retainedEarningsAccountId" TEXT,
    "ownerCapitalAccountId" TEXT,
    "partnerCapitalAllocationMethod" TEXT,
    "drawingsCloseMethod" TEXT NOT NULL DEFAULT 'TO_OWNER_CAPITAL',
    "dividendCloseMethod" TEXT NOT NULL DEFAULT 'RETAINED_EARNINGS_AT_DECLARATION',
    "automaticNextYearCreation" BOOLEAN NOT NULL DEFAULT true,
    "automaticPeriodGeneration" BOOLEAN NOT NULL DEFAULT true,
    "annualSnapshotRequired" BOOLEAN NOT NULL DEFAULT true,
    "postClosingTrialBalanceRequired" BOOLEAN NOT NULL DEFAULT true,
    "closeChecklistTemplateId" TEXT NOT NULL DEFAULT 'STANDARD_YEAR_END_CLOSE',
    "architectureVersion" TEXT NOT NULL DEFAULT 'CLOSE_V2',
    "effectiveFrom" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseV2Configuration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2Configuration_tenantId_key" ON "CloseV2Configuration"("tenantId");
CREATE INDEX IF NOT EXISTS "CloseV2Configuration_status_idx" ON "CloseV2Configuration"("status");

CREATE TABLE IF NOT EXISTS "CloseV2YearEndCloseRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeNumber" INTEGER NOT NULL DEFAULT 1,
    "closeVersion" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "checklistTemplateId" TEXT NOT NULL,
    "checklistTemplateVersion" TEXT NOT NULL,
    "closingMethod" TEXT NOT NULL,
    "startedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "completedBy" TEXT,
    "reopenedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reopenedAt" TIMESTAMP(3),
    "expectedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "blockedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "warningTaskCount" INTEGER NOT NULL DEFAULT 0,
    "adjustmentJournalCount" INTEGER NOT NULL DEFAULT 0,
    "closingJournalCount" INTEGER NOT NULL DEFAULT 0,
    "adjustedTrialBalanceStatus" TEXT,
    "postClosingTrialBalanceStatus" TEXT,
    "financialReportStatus" TEXT,
    "equityReconciliationStatus" TEXT,
    "finalProfitOrLossMinor" BIGINT,
    "transferDestinationAccountId" TEXT,
    "annualSnapshotReference" JSONB,
    "closeChecksum" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseV2YearEndCloseRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2YearEndCloseRun_tenantId_financialYearId_closeVersion_key"
  ON "CloseV2YearEndCloseRun"("tenantId", "financialYearId", "closeVersion");
CREATE INDEX IF NOT EXISTS "CloseV2YearEndCloseRun_tenantId_status_idx" ON "CloseV2YearEndCloseRun"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CloseV2YearEndCloseRun_tenantId_financialYearId_idx" ON "CloseV2YearEndCloseRun"("tenantId", "financialYearId");

CREATE TABLE IF NOT EXISTS "CloseV2CloseStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "executedBy" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "CloseV2CloseStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CloseV2CloseStatusHistory_tenantId_closeRunId_idx" ON "CloseV2CloseStatusHistory"("tenantId", "closeRunId");
CREATE INDEX IF NOT EXISTS "CloseV2CloseStatusHistory_tenantId_financialYearId_idx" ON "CloseV2CloseStatusHistory"("tenantId", "financialYearId");

CREATE TABLE IF NOT EXISTS "CloseV2YearEndCloseTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "kind" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "evidence" JSONB,
    "comment" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseV2YearEndCloseTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2YearEndCloseTask_closeRunId_taskKey_key" ON "CloseV2YearEndCloseTask"("closeRunId", "taskKey");
CREATE INDEX IF NOT EXISTS "CloseV2YearEndCloseTask_tenantId_closeRunId_idx" ON "CloseV2YearEndCloseTask"("tenantId", "closeRunId");

CREATE TABLE IF NOT EXISTS "CloseV2YearEndCloseException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT,
    "taskId" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "amountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "proposedResolution" TEXT,
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "disclosureRequired" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseV2YearEndCloseException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CloseV2YearEndCloseException_tenantId_financialYearId_status_idx"
  ON "CloseV2YearEndCloseException"("tenantId", "financialYearId", "status");
CREATE INDEX IF NOT EXISTS "CloseV2YearEndCloseException_tenantId_closeRunId_idx" ON "CloseV2YearEndCloseException"("tenantId", "closeRunId");

CREATE TABLE IF NOT EXISTS "CloseV2ClosingJournalBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "batchNumber" INTEGER NOT NULL DEFAULT 1,
    "closingMethod" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "temporaryAccountCount" INTEGER NOT NULL DEFAULT 0,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "totalDebitMinor" BIGINT NOT NULL DEFAULT 0,
    "totalCreditMinor" BIGINT NOT NULL DEFAULT 0,
    "calculatedProfitOrLossMinor" BIGINT NOT NULL DEFAULT 0,
    "destinationAccountId" TEXT,
    "previewPayload" JSONB,
    "previewChecksum" TEXT,
    "generatedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "postedBy" TEXT,
    "generatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "requestId" TEXT,
    "correlationId" TEXT,
    "checksum" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CloseV2ClosingJournalBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatch_idempotencyKey_key" ON "CloseV2ClosingJournalBatch"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatch_closeRunId_batchNumber_version_key"
  ON "CloseV2ClosingJournalBatch"("closeRunId", "batchNumber", "version");
CREATE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatch_tenantId_closeRunId_idx" ON "CloseV2ClosingJournalBatch"("tenantId", "closeRunId");
CREATE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatch_tenantId_status_idx" ON "CloseV2ClosingJournalBatch"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "CloseV2ClosingJournalBatchLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountCode" TEXT,
    "accountName" TEXT,
    "accountCategory" TEXT,
    "lineRole" TEXT NOT NULL,
    "debitMinor" BIGINT NOT NULL DEFAULT 0,
    "creditMinor" BIGINT NOT NULL DEFAULT 0,
    "description" TEXT,
    "metadata" JSONB,
    CONSTRAINT "CloseV2ClosingJournalBatchLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatchLine_batchId_sequence_key" ON "CloseV2ClosingJournalBatchLine"("batchId", "sequence");
CREATE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatchLine_tenantId_batchId_idx" ON "CloseV2ClosingJournalBatchLine"("tenantId", "batchId");
CREATE INDEX IF NOT EXISTS "CloseV2ClosingJournalBatchLine_tenantId_accountId_idx" ON "CloseV2ClosingJournalBatchLine"("tenantId", "accountId");

CREATE TABLE IF NOT EXISTS "CloseV2PostClosingTrialBalanceRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "totalDebitMinor" BIGINT NOT NULL DEFAULT 0,
    "totalCreditMinor" BIGINT NOT NULL DEFAULT 0,
    "balanced" BOOLEAN NOT NULL DEFAULT false,
    "temporaryNonZeroCount" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "checksum" TEXT,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "CloseV2PostClosingTrialBalanceRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2PostClosingTrialBalanceRun_closeRunId_key" ON "CloseV2PostClosingTrialBalanceRun"("closeRunId");
CREATE INDEX IF NOT EXISTS "CloseV2PostClosingTrialBalanceRun_tenantId_financialYearId_idx" ON "CloseV2PostClosingTrialBalanceRun"("tenantId", "financialYearId");

CREATE TABLE IF NOT EXISTS "CloseV2AnnualSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "closeVersion" INTEGER NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "checksum" TEXT,
    "generatedBy" TEXT,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "CloseV2AnnualSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CloseV2AnnualSnapshot_closeRunId_snapshotType_key" ON "CloseV2AnnualSnapshot"("closeRunId", "snapshotType");
CREATE INDEX IF NOT EXISTS "CloseV2AnnualSnapshot_tenantId_financialYearId_idx" ON "CloseV2AnnualSnapshot"("tenantId", "financialYearId");

CREATE TABLE IF NOT EXISTS "CloseV2YearReopenRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "closeRunId" TEXT,
    "reason" TEXT NOT NULL,
    "expectedCorrections" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "impactAnalysis" JSONB,
    "riskLevel" TEXT,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "CloseV2YearReopenRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CloseV2YearReopenRequest_tenantId_financialYearId_status_idx"
  ON "CloseV2YearReopenRequest"("tenantId", "financialYearId", "status");

DO $$ BEGIN
  ALTER TABLE "CloseV2CloseStatusHistory"
    ADD CONSTRAINT "CloseV2CloseStatusHistory_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2YearEndCloseTask"
    ADD CONSTRAINT "CloseV2YearEndCloseTask_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2YearEndCloseException"
    ADD CONSTRAINT "CloseV2YearEndCloseException_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2ClosingJournalBatch"
    ADD CONSTRAINT "CloseV2ClosingJournalBatch_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2ClosingJournalBatchLine"
    ADD CONSTRAINT "CloseV2ClosingJournalBatchLine_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "CloseV2ClosingJournalBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2AnnualSnapshot"
    ADD CONSTRAINT "CloseV2AnnualSnapshot_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CloseV2YearReopenRequest"
    ADD CONSTRAINT "CloseV2YearReopenRequest_closeRunId_fkey"
    FOREIGN KEY ("closeRunId") REFERENCES "CloseV2YearEndCloseRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;