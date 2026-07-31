-- CreateTable
CREATE TABLE "AcctV2Configuration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'MWK',
    "accountingArchitectureVersion" TEXT NOT NULL DEFAULT 'LEGACY_V1',
    "defaultPostingMode" TEXT NOT NULL DEFAULT 'LEGACY',
    "strictPeriodControl" BOOLEAN NOT NULL DEFAULT false,
    "requireJournalApproval" BOOLEAN NOT NULL DEFAULT false,
    "requireReversalApproval" BOOLEAN NOT NULL DEFAULT false,
    "useNewLedgerQueries" BOOLEAN NOT NULL DEFAULT false,
    "enableShadowAccounting" BOOLEAN NOT NULL DEFAULT false,
    "enableIntegrityMonitoring" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2FeatureFlag" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '*',
    "flagKey" TEXT NOT NULL,
    "moduleKey" TEXT NOT NULL DEFAULT '*',
    "eventType" TEXT NOT NULL DEFAULT '*',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2EventRegistry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceModule" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "commandHash" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "requestedPostingDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "amount" DECIMAL(18,2),
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "postingMode" TEXT NOT NULL DEFAULT 'LEGACY',
    "architectureVersion" TEXT NOT NULL DEFAULT 'TRANSITION_V2',
    "correlationId" TEXT,
    "requestId" TEXT,
    "externalReference" TEXT,
    "importBatchId" TEXT,
    "webhookEventId" TEXT,
    "journalEntryId" TEXT,
    "legacyTransactionId" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "AcctV2EventRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2PostingAttempt" (
    "id" TEXT NOT NULL,
    "eventRegistryId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'STARTED',
    "workerId" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "transactionId" TEXT,
    "failureCode" TEXT,
    "sanitizedFailureMessage" TEXT,
    "retryable" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "metadata" JSONB,

    CONSTRAINT "AcctV2PostingAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2Outbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "correlationId" TEXT,

    CONSTRAINT "AcctV2Outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2ShadowJournal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventRegistryId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "exchangeRate" DECIMAL(18,8) NOT NULL DEFAULT 1,
    "totalDebit" DECIMAL(18,2) NOT NULL,
    "totalCredit" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "architectureVersion" TEXT NOT NULL DEFAULT 'TRANSITION_V2',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2ShadowJournal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2ShadowJournalLine" (
    "id" TEXT NOT NULL,
    "shadowJournalId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "dimensions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2ShadowJournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2ShadowComparison" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "shadowJournalId" TEXT NOT NULL,
    "eventRegistryId" TEXT,
    "legacyTransactionId" TEXT,
    "legacyJournalEntryId" TEXT,
    "legacyDebit" DECIMAL(18,2),
    "legacyCredit" DECIMAL(18,2),
    "proposedDebit" DECIMAL(18,2) NOT NULL,
    "proposedCredit" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFORMATIONAL',
    "differences" JSONB,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2ShadowComparison_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2Configuration_tenantId_key" ON "AcctV2Configuration"("tenantId");

-- CreateIndex
CREATE INDEX "AcctV2FeatureFlag_flagKey_enabled_idx" ON "AcctV2FeatureFlag"("flagKey", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2FeatureFlag_tenantId_flagKey_moduleKey_eventType_key" ON "AcctV2FeatureFlag"("tenantId", "flagKey", "moduleKey", "eventType");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2EventRegistry_idempotencyKey_key" ON "AcctV2EventRegistry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AcctV2EventRegistry_tenantId_status_idx" ON "AcctV2EventRegistry"("tenantId", "status");

-- CreateIndex
CREATE INDEX "AcctV2EventRegistry_tenantId_transactionDate_idx" ON "AcctV2EventRegistry"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "AcctV2EventRegistry_tenantId_sourceType_sourceId_idx" ON "AcctV2EventRegistry"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "AcctV2EventRegistry_correlationId_idx" ON "AcctV2EventRegistry"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2EventRegistry_tenantId_sourceModule_sourceType_source_key" ON "AcctV2EventRegistry"("tenantId", "sourceModule", "sourceType", "sourceId", "eventType", "eventVersion");

-- CreateIndex
CREATE INDEX "AcctV2PostingAttempt_status_startedAt_idx" ON "AcctV2PostingAttempt"("status", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2PostingAttempt_eventRegistryId_attemptNumber_key" ON "AcctV2PostingAttempt"("eventRegistryId", "attemptNumber");

-- CreateIndex
CREATE INDEX "AcctV2Outbox_status_occurredAt_idx" ON "AcctV2Outbox"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "AcctV2Outbox_tenantId_aggregateType_aggregateId_idx" ON "AcctV2Outbox"("tenantId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "AcctV2ShadowJournal_tenantId_transactionDate_idx" ON "AcctV2ShadowJournal"("tenantId", "transactionDate");

-- CreateIndex
CREATE INDEX "AcctV2ShadowJournal_eventRegistryId_idx" ON "AcctV2ShadowJournal"("eventRegistryId");

-- CreateIndex
CREATE INDEX "AcctV2ShadowJournalLine_shadowJournalId_idx" ON "AcctV2ShadowJournalLine"("shadowJournalId");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2ShadowComparison_shadowJournalId_key" ON "AcctV2ShadowComparison"("shadowJournalId");

-- CreateIndex
CREATE INDEX "AcctV2ShadowComparison_tenantId_status_idx" ON "AcctV2ShadowComparison"("tenantId", "status");

-- AddForeignKey
ALTER TABLE "AcctV2PostingAttempt" ADD CONSTRAINT "AcctV2PostingAttempt_eventRegistryId_fkey" FOREIGN KEY ("eventRegistryId") REFERENCES "AcctV2EventRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctV2ShadowJournal" ADD CONSTRAINT "AcctV2ShadowJournal_eventRegistryId_fkey" FOREIGN KEY ("eventRegistryId") REFERENCES "AcctV2EventRegistry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctV2ShadowJournalLine" ADD CONSTRAINT "AcctV2ShadowJournalLine_shadowJournalId_fkey" FOREIGN KEY ("shadowJournalId") REFERENCES "AcctV2ShadowJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcctV2ShadowComparison" ADD CONSTRAINT "AcctV2ShadowComparison_shadowJournalId_fkey" FOREIGN KEY ("shadowJournalId") REFERENCES "AcctV2ShadowJournal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

