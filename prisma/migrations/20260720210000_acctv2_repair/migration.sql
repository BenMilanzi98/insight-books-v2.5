-- Phase 6 — Historical accounting repair framework (additive only).
-- Anomaly registry, repair evidence, repair batches, idempotent repair
-- actions, before/after snapshots, exception register.

CREATE TABLE IF NOT EXISTS "AcctV2HistoricalAnomaly" (
    "id" TEXT NOT NULL,
    "findingCode" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearLabel" TEXT,
    "accountingPeriodId" TEXT,
    "module" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "journalEntryId" TEXT,
    "journalLineId" TEXT,
    "transactionId" TEXT,
    "accountId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "anomalyType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM_CONFIDENCE',
    "financialImpactMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "expectedCondition" TEXT,
    "actualCondition" TEXT,
    "rootCause" TEXT,
    "detectionKey" TEXT NOT NULL,
    "discoveredBy" TEXT,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'DETECTED',
    "assignedTo" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "proposedRepairType" TEXT,
    "proposedRepairData" JSONB,
    "approvalStatus" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "repairBatchId" TEXT,
    "repairedAt" TIMESTAMP(3),
    "verificationStatus" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "exceptionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcctV2HistoricalAnomaly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_tenantId_detectionKey_key" ON "AcctV2HistoricalAnomaly"("tenantId", "detectionKey");
CREATE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_tenantId_status_idx" ON "AcctV2HistoricalAnomaly"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_tenantId_anomalyType_idx" ON "AcctV2HistoricalAnomaly"("tenantId", "anomalyType");
CREATE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_tenantId_severity_idx" ON "AcctV2HistoricalAnomaly"("tenantId", "severity");
CREATE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_tenantId_accountId_idx" ON "AcctV2HistoricalAnomaly"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "AcctV2HistoricalAnomaly_repairBatchId_idx" ON "AcctV2HistoricalAnomaly"("repairBatchId");

CREATE TABLE IF NOT EXISTS "AcctV2RepairEvidence" (
    "id" TEXT NOT NULL,
    "anomalyId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "evidenceType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "payload" JSONB,
    "reference" TEXT,
    "strength" TEXT NOT NULL DEFAULT 'MEDIUM_CONFIDENCE',
    "recordedBy" TEXT,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AcctV2RepairEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AcctV2RepairEvidence_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "AcctV2HistoricalAnomaly"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AcctV2RepairEvidence_anomalyId_idx" ON "AcctV2RepairEvidence"("anomalyId");
CREATE INDEX IF NOT EXISTS "AcctV2RepairEvidence_tenantId_idx" ON "AcctV2RepairEvidence"("tenantId");

CREATE TABLE IF NOT EXISTS "AcctV2RepairBatch" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearLabel" TEXT,
    "accountingPeriodId" TEXT,
    "repairCategory" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "requestedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "executedBy" TEXT,
    "verifiedBy" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "expectedDebitMinor" BIGINT NOT NULL DEFAULT 0,
    "expectedCreditMinor" BIGINT NOT NULL DEFAULT 0,
    "actualDebitMinor" BIGINT NOT NULL DEFAULT 0,
    "actualCreditMinor" BIGINT NOT NULL DEFAULT 0,
    "backupReference" TEXT,
    "rollbackPlan" TEXT,
    "checksum" TEXT,
    "errorSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcctV2RepairBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2RepairBatch_tenantId_batchNumber_key" ON "AcctV2RepairBatch"("tenantId", "batchNumber");
CREATE INDEX IF NOT EXISTS "AcctV2RepairBatch_tenantId_status_idx" ON "AcctV2RepairBatch"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "AcctV2RepairAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "anomalyId" TEXT NOT NULL,
    "repairType" TEXT NOT NULL,
    "repairVersion" INTEGER NOT NULL DEFAULT 1,
    "commandHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT NOT NULL,
    "approvalReference" TEXT,
    "approvedBy" TEXT,
    "executedBy" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "previousValues" JSONB,
    "newValues" JSONB,
    "journalEntryIds" JSONB,
    "resultSummary" JSONB,
    "errorMessage" TEXT,
    "rolledBackAt" TIMESTAMP(3),
    "rolledBackBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcctV2RepairAction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AcctV2RepairAction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AcctV2RepairBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AcctV2RepairAction_anomalyId_fkey" FOREIGN KEY ("anomalyId") REFERENCES "AcctV2HistoricalAnomaly"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2RepairAction_tenantId_anomalyId_repairType_repairVers_key" ON "AcctV2RepairAction"("tenantId", "anomalyId", "repairType", "repairVersion");
CREATE INDEX IF NOT EXISTS "AcctV2RepairAction_batchId_idx" ON "AcctV2RepairAction"("batchId");
CREATE INDEX IF NOT EXISTS "AcctV2RepairAction_tenantId_status_idx" ON "AcctV2RepairAction"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "AcctV2RepairSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "journalCount" INTEGER NOT NULL,
    "lineCount" INTEGER NOT NULL,
    "totalDebitMinor" BIGINT NOT NULL,
    "totalCreditMinor" BIGINT NOT NULL,
    "balances" JSONB NOT NULL,
    "integrityFindingCount" INTEGER NOT NULL DEFAULT 0,
    "checksum" TEXT NOT NULL,
    CONSTRAINT "AcctV2RepairSnapshot_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AcctV2RepairSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AcctV2RepairBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2RepairSnapshot_batchId_phase_key" ON "AcctV2RepairSnapshot"("batchId", "phase");
CREATE INDEX IF NOT EXISTS "AcctV2RepairSnapshot_tenantId_idx" ON "AcctV2RepairSnapshot"("tenantId");

CREATE TABLE IF NOT EXISTS "AcctV2RepairException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "anomalyId" TEXT NOT NULL,
    "module" TEXT,
    "accountingPeriodId" TEXT,
    "amountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "anomalyType" TEXT NOT NULL,
    "evidenceGap" TEXT NOT NULL,
    "reasonBlocked" TEXT NOT NULL,
    "statementImpact" TEXT,
    "risk" TEXT NOT NULL DEFAULT 'MEDIUM',
    "requiredInformation" TEXT,
    "responsibleOwner" TEXT,
    "targetReviewDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "disclosureRequired" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AcctV2RepairException_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AcctV2RepairException_anomalyId_key" ON "AcctV2RepairException"("anomalyId");
CREATE INDEX IF NOT EXISTS "AcctV2RepairException_tenantId_status_idx" ON "AcctV2RepairException"("tenantId", "status");
