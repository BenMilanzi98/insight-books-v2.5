-- Phase 10 — Bank Reconciliation (additive)

CREATE TABLE IF NOT EXISTS "BankRecConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "coaAccountId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "dateToleranceDays" INTEGER NOT NULL DEFAULT 3,
    "amountToleranceMinor" INTEGER NOT NULL DEFAULT 0,
    "autoMatchMinConfidence" TEXT NOT NULL DEFAULT 'HIGH',
    "requireSeparateApprover" BOOLEAN NOT NULL DEFAULT true,
    "staleOutstandingDays" INTEGER NOT NULL DEFAULT 30,
    "defaultProfileId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "BankRecConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecConfiguration_paymentAccountId_key" ON "BankRecConfiguration"("paymentAccountId");
CREATE INDEX IF NOT EXISTS "BankRecConfiguration_tenantId_idx" ON "BankRecConfiguration"("tenantId");
CREATE INDEX IF NOT EXISTS "BankRecConfiguration_coaAccountId_idx" ON "BankRecConfiguration"("coaAccountId");

CREATE TABLE IF NOT EXISTS "BankRecStatementProfile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "columnMap" JSONB NOT NULL,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    CONSTRAINT "BankRecStatementProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecStatementProfile_tenantId_name_version_key" ON "BankRecStatementProfile"("tenantId", "name", "version");
CREATE INDEX IF NOT EXISTS "BankRecStatementProfile_tenantId_status_idx" ON "BankRecStatementProfile"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "BankRecImportBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "reconciliationId" TEXT,
    "profileId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateRowCount" INTEGER NOT NULL DEFAULT 0,
    "statementOpening" DECIMAL(18,2),
    "statementClosing" DECIMAL(18,2),
    "periodStart" DATE,
    "periodEnd" DATE,
    "balanceValid" BOOLEAN,
    "errorSummary" TEXT,
    "parseWarnings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "confirmedBy" TEXT,
    CONSTRAINT "BankRecImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecImportBatch_tenantId_paymentAccountId_fileHash_key" ON "BankRecImportBatch"("tenantId", "paymentAccountId", "fileHash");
CREATE INDEX IF NOT EXISTS "BankRecImportBatch_tenantId_paymentAccountId_status_idx" ON "BankRecImportBatch"("tenantId", "paymentAccountId", "status");
CREATE INDEX IF NOT EXISTS "BankRecImportBatch_reconciliationId_idx" ON "BankRecImportBatch"("reconciliationId");

CREATE TABLE IF NOT EXISTS "BankRecStatementTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "reconciliationId" TEXT,
    "lineNumber" INTEGER NOT NULL,
    "transactionDate" DATE NOT NULL,
    "valueDate" DATE,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "referenceNormalized" TEXT,
    "payee" TEXT,
    "signedAmountMinor" INTEGER NOT NULL,
    "signedAmount" DECIMAL(18,2) NOT NULL,
    "runningBalance" DECIMAL(18,2),
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "rowFingerprint" TEXT NOT NULL,
    "matchingStatus" TEXT NOT NULL DEFAULT 'UNMATCHED',
    "classification" TEXT,
    "remainingAmountMinor" INTEGER NOT NULL,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecStatementTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecStatementTransaction_importBatchId_lineNumber_key" ON "BankRecStatementTransaction"("importBatchId", "lineNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "BankRecStatementTransaction_tenantId_paymentAccountId_rowFingerprint_key" ON "BankRecStatementTransaction"("tenantId", "paymentAccountId", "rowFingerprint");
CREATE INDEX IF NOT EXISTS "BankRecStatementTransaction_tenantId_paymentAccountId_matchingStatus_idx" ON "BankRecStatementTransaction"("tenantId", "paymentAccountId", "matchingStatus");
CREATE INDEX IF NOT EXISTS "BankRecStatementTransaction_tenantId_transactionDate_idx" ON "BankRecStatementTransaction"("tenantId", "transactionDate");
CREATE INDEX IF NOT EXISTS "BankRecStatementTransaction_referenceNormalized_idx" ON "BankRecStatementTransaction"("referenceNormalized");
CREATE INDEX IF NOT EXISTS "BankRecStatementTransaction_signedAmountMinor_idx" ON "BankRecStatementTransaction"("signedAmountMinor");
CREATE INDEX IF NOT EXISTS "BankRecStatementTransaction_reconciliationId_idx" ON "BankRecStatementTransaction"("reconciliationId");

CREATE TABLE IF NOT EXISTS "BankRecReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentAccountId" TEXT NOT NULL,
    "coaAccountId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "statementDate" DATE NOT NULL,
    "periodStart" DATE,
    "periodEnd" DATE,
    "statementOpeningBalance" DECIMAL(18,2),
    "statementClosingBalance" DECIMAL(18,2) NOT NULL,
    "bookBalance" DECIMAL(18,2),
    "clearedBookBalance" DECIMAL(18,2),
    "outstandingPayments" DECIMAL(18,2),
    "depositsInTransit" DECIMAL(18,2),
    "adjustmentsTotal" DECIMAL(18,2),
    "differenceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "preparedBy" TEXT,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "completedBy" TEXT,
    "preparedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reopenedFromId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankRecReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecReconciliation_tenantId_paymentAccountId_statementDate_version_key" ON "BankRecReconciliation"("tenantId", "paymentAccountId", "statementDate", "version");
CREATE INDEX IF NOT EXISTS "BankRecReconciliation_tenantId_paymentAccountId_status_idx" ON "BankRecReconciliation"("tenantId", "paymentAccountId", "status");
CREATE INDEX IF NOT EXISTS "BankRecReconciliation_tenantId_status_statementDate_idx" ON "BankRecReconciliation"("tenantId", "status", "statementDate");

CREATE TABLE IF NOT EXISTS "BankRecStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "reason" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecStatusHistory_reconciliationId_createdAt_idx" ON "BankRecStatusHistory"("reconciliationId", "createdAt");

CREATE TABLE IF NOT EXISTS "BankRecMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "confidence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUGGESTED',
    "statementTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "bookTotalMinor" INTEGER NOT NULL DEFAULT 0,
    "differenceMinor" INTEGER NOT NULL DEFAULT 0,
    "ruleKey" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "acceptedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    CONSTRAINT "BankRecMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecMatch_tenantId_reconciliationId_status_idx" ON "BankRecMatch"("tenantId", "reconciliationId", "status");
CREATE INDEX IF NOT EXISTS "BankRecMatch_confidence_idx" ON "BankRecMatch"("confidence");

CREATE TABLE IF NOT EXISTS "BankRecMatchLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "statementTransactionId" TEXT,
    "journalEntryLineId" TEXT,
    "journalEntryId" TEXT,
    "allocatedAmountMinor" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecMatchLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecMatchLink_matchId_idx" ON "BankRecMatchLink"("matchId");
CREATE INDEX IF NOT EXISTS "BankRecMatchLink_statementTransactionId_idx" ON "BankRecMatchLink"("statementTransactionId");
CREATE INDEX IF NOT EXISTS "BankRecMatchLink_journalEntryLineId_idx" ON "BankRecMatchLink"("journalEntryLineId");
CREATE INDEX IF NOT EXISTS "BankRecMatchLink_tenantId_journalEntryLineId_idx" ON "BankRecMatchLink"("tenantId", "journalEntryLineId");

CREATE TABLE IF NOT EXISTS "BankRecMatchingRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '*',
    "ruleKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "matchType" TEXT NOT NULL DEFAULT 'ONE_TO_ONE',
    "confidence" TEXT NOT NULL DEFAULT 'HIGH',
    "criteria" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BankRecMatchingRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecMatchingRule_tenantId_ruleKey_version_key" ON "BankRecMatchingRule"("tenantId", "ruleKey", "version");
CREATE INDEX IF NOT EXISTS "BankRecMatchingRule_enabled_priority_idx" ON "BankRecMatchingRule"("enabled", "priority");

CREATE TABLE IF NOT EXISTS "BankRecOutstandingItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "itemType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "itemDate" DATE,
    "journalEntryLineId" TEXT,
    "statementTransactionId" TEXT,
    "agingDays" INTEGER NOT NULL DEFAULT 0,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecOutstandingItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecOutstandingItem_reconciliationId_itemType_idx" ON "BankRecOutstandingItem"("reconciliationId", "itemType");

CREATE TABLE IF NOT EXISTS "BankRecException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "message" TEXT NOT NULL,
    "evidence" JSONB,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecException_reconciliationId_status_idx" ON "BankRecException"("reconciliationId", "status");

CREATE TABLE IF NOT EXISTS "BankRecApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecApproval_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecApproval_reconciliationId_action_idx" ON "BankRecApproval"("reconciliationId", "action");

CREATE TABLE IF NOT EXISTS "BankRecSnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "BankRecSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BankRecSnapshot_reconciliationId_version_key" ON "BankRecSnapshot"("reconciliationId", "version");
CREATE INDEX IF NOT EXISTS "BankRecSnapshot_tenantId_createdAt_idx" ON "BankRecSnapshot"("tenantId", "createdAt");

CREATE TABLE IF NOT EXISTS "BankRecAdjustmentLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "statementTransactionId" TEXT,
    "adjustmentType" TEXT NOT NULL,
    "eventRegistryId" TEXT,
    "journalEntryId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BankRecAdjustmentLink_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BankRecAdjustmentLink_reconciliationId_idx" ON "BankRecAdjustmentLink"("reconciliationId");
CREATE INDEX IF NOT EXISTS "BankRecAdjustmentLink_journalEntryId_idx" ON "BankRecAdjustmentLink"("journalEntryId");
CREATE INDEX IF NOT EXISTS "BankRecAdjustmentLink_eventRegistryId_idx" ON "BankRecAdjustmentLink"("eventRegistryId");

-- FKs
ALTER TABLE "BankRecStatementTransaction" ADD CONSTRAINT "BankRecStatementTransaction_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "BankRecImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecStatusHistory" ADD CONSTRAINT "BankRecStatusHistory_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecMatch" ADD CONSTRAINT "BankRecMatch_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecMatchLink" ADD CONSTRAINT "BankRecMatchLink_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "BankRecMatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecMatchLink" ADD CONSTRAINT "BankRecMatchLink_statementTransactionId_fkey" FOREIGN KEY ("statementTransactionId") REFERENCES "BankRecStatementTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankRecOutstandingItem" ADD CONSTRAINT "BankRecOutstandingItem_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecException" ADD CONSTRAINT "BankRecException_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecApproval" ADD CONSTRAINT "BankRecApproval_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BankRecSnapshot" ADD CONSTRAINT "BankRecSnapshot_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankRecAdjustmentLink" ADD CONSTRAINT "BankRecAdjustmentLink_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "BankRecReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
