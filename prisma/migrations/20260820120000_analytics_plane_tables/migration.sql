-- Analytics plane tables (BI outbox + derived stores).
-- Additive only: CREATE IF NOT EXISTS. Safe on DBs that already have some of these.

CREATE TABLE IF NOT EXISTS "AnalyticsOutbox" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "payload" JSONB NOT NULL,
    "payloadChecksum" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "processedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "lastError" TEXT,
    "correlationId" TEXT,
    "requestId" TEXT,
    "privacyClass" TEXT NOT NULL DEFAULT 'INTERNAL',
    "actorType" TEXT,
    "actorId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsOutbox_idempotencyKey_key" ON "AnalyticsOutbox"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsOutbox_status_availableAt_idx" ON "AnalyticsOutbox"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "AnalyticsOutbox_tenantId_eventType_idx" ON "AnalyticsOutbox"("tenantId", "eventType");
CREATE INDEX IF NOT EXISTS "AnalyticsOutbox_aggregateType_aggregateId_idx" ON "AnalyticsOutbox"("aggregateType", "aggregateId");

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "schemaVersion" TEXT NOT NULL DEFAULT '1',
    "tenantId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "privacyClass" TEXT NOT NULL DEFAULT 'INTERNAL',
    "actorType" TEXT,
    "actorId" TEXT,
    "correlationId" TEXT,
    "requestId" TEXT,
    "payload" JSONB NOT NULL,
    "outboxId" TEXT,
    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsEvent_idempotencyKey_key" ON "AnalyticsEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_eventType_occurredAt_idx" ON "AnalyticsEvent"("eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_tenantId_occurredAt_idx" ON "AnalyticsEvent"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sourceType_sourceId_idx" ON "AnalyticsEvent"("sourceType", "sourceId");

CREATE TABLE IF NOT EXISTS "AnalyticsConsumerCheckpoint" (
    "id" TEXT NOT NULL,
    "consumerName" TEXT NOT NULL,
    "lastEventId" TEXT,
    "lastOccurredAt" TIMESTAMP(3),
    "cursor" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsConsumerCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsConsumerCheckpoint_consumerName_key" ON "AnalyticsConsumerCheckpoint"("consumerName");

CREATE TABLE IF NOT EXISTS "AnalyticsDeadLetter" (
    "id" TEXT NOT NULL,
    "outboxId" TEXT,
    "eventId" TEXT,
    "eventType" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "payload" JSONB,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    CONSTRAINT "AnalyticsDeadLetter_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsDeadLetter_createdAt_idx" ON "AnalyticsDeadLetter"("createdAt");
CREATE INDEX IF NOT EXISTS "AnalyticsDeadLetter_eventType_idx" ON "AnalyticsDeadLetter"("eventType");

CREATE TABLE IF NOT EXISTS "AnalyticsFactPlatformBilling" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsFactPlatformBilling_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsFactPlatformBilling_idempotencyKey_key" ON "AnalyticsFactPlatformBilling"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsFactPlatformBilling_tenantId_occurredAt_idx" ON "AnalyticsFactPlatformBilling"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactPlatformBilling_eventType_occurredAt_idx" ON "AnalyticsFactPlatformBilling"("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS "AnalyticsFactSubscription" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "planCode" TEXT,
    "amount" DECIMAL(18,2),
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsFactSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsFactSubscription_idempotencyKey_key" ON "AnalyticsFactSubscription"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsFactSubscription_tenantId_occurredAt_idx" ON "AnalyticsFactSubscription"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactSubscription_subscriptionId_idx" ON "AnalyticsFactSubscription"("subscriptionId");

CREATE TABLE IF NOT EXISTS "AnalyticsFactTenantActivity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsFactTenantActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsFactTenantActivity_idempotencyKey_key" ON "AnalyticsFactTenantActivity"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsFactTenantActivity_tenantId_occurredAt_idx" ON "AnalyticsFactTenantActivity"("tenantId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactTenantActivity_eventType_occurredAt_idx" ON "AnalyticsFactTenantActivity"("eventType", "occurredAt");

CREATE TABLE IF NOT EXISTS "AnalyticsFactProductUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureCode" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsFactProductUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_idempotencyKey_key" ON "AnalyticsFactProductUsage"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_tenantId_featureCode_occurredAt_idx" ON "AnalyticsFactProductUsage"("tenantId", "featureCode", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_tenantId_eventType_occurredAt_idx" ON "AnalyticsFactProductUsage"("tenantId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_featureCode_occurredAt_idx" ON "AnalyticsFactProductUsage"("featureCode", "occurredAt");

CREATE TABLE IF NOT EXISTS "ProductFirstValueFact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureCode" TEXT NOT NULL,
    "ruleVersion" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceEventId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductFirstValueFact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFirstValueFact_idempotencyKey_key" ON "ProductFirstValueFact"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ProductFirstValueFact_tenantId_featureCode_ruleVersion_key" ON "ProductFirstValueFact"("tenantId", "featureCode", "ruleVersion");
CREATE INDEX IF NOT EXISTS "ProductFirstValueFact_tenantId_featureCode_idx" ON "ProductFirstValueFact"("tenantId", "featureCode");

CREATE TABLE IF NOT EXISTS "ProductAdoptionStateHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "featureCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "previousState" TEXT,
    "ruleVersion" TEXT NOT NULL,
    "definitionVersion" TEXT NOT NULL,
    "reasonCode" TEXT,
    "evidence" JSONB,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductAdoptionStateHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ProductAdoptionStateHistory_tenantId_featureCode_observedAt_idx" ON "ProductAdoptionStateHistory"("tenantId", "featureCode", "observedAt");
CREATE INDEX IF NOT EXISTS "ProductAdoptionStateHistory_tenantId_featureCode_state_idx" ON "ProductAdoptionStateHistory"("tenantId", "featureCode", "state");

CREATE TABLE IF NOT EXISTS "AnalyticsDailySnapshot" (
    "id" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "valueNumeric" DECIMAL(18,4),
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsDailySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsDailySnapshot_snapshotDate_metricKey_tenantId_key" ON "AnalyticsDailySnapshot"("snapshotDate", "metricKey", "tenantId");
CREATE INDEX IF NOT EXISTS "AnalyticsDailySnapshot_metricKey_snapshotDate_idx" ON "AnalyticsDailySnapshot"("metricKey", "snapshotDate");

CREATE TABLE IF NOT EXISTS "AnalyticsMonthlySnapshot" (
    "id" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT '',
    "valueNumeric" DECIMAL(18,4),
    "valueJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsMonthlySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsMonthlySnapshot_yearMonth_metricKey_tenantId_key" ON "AnalyticsMonthlySnapshot"("yearMonth", "metricKey", "tenantId");
CREATE INDEX IF NOT EXISTS "AnalyticsMonthlySnapshot_metricKey_yearMonth_idx" ON "AnalyticsMonthlySnapshot"("metricKey", "yearMonth");

CREATE TABLE IF NOT EXISTS "AnalyticsDataFreshness" (
    "id" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "lastSuccessAt" TIMESTAMP(3),
    "lastAttemptAt" TIMESTAMP(3),
    "lagSeconds" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "detail" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AnalyticsDataFreshness_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsDataFreshness_sourceKey_key" ON "AnalyticsDataFreshness"("sourceKey");

CREATE TABLE IF NOT EXISTS "AnalyticsReconciliationRun" (
    "id" TEXT NOT NULL,
    "checkKey" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "expected" INTEGER NOT NULL,
    "actual" INTEGER NOT NULL,
    "variance" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalyticsReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AnalyticsReconciliationRun_checkKey_createdAt_idx" ON "AnalyticsReconciliationRun"("checkKey", "createdAt");
