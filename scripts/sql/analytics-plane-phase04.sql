-- Phase 4 analytics plane (PostgreSQL). Apply when prisma db push is locked.
-- Safe to re-run with IF NOT EXISTS where supported.

CREATE TABLE IF NOT EXISTS "AnalyticsOutbox" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT,
  "aggregateType" TEXT NOT NULL,
  "aggregateId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1',
  "payload" JSONB NOT NULL,
  "payloadChecksum" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
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
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AnalyticsEvent" (
  "id" TEXT PRIMARY KEY,
  "eventType" TEXT NOT NULL,
  "schemaVersion" TEXT NOT NULL DEFAULT '1',
  "tenantId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "privacyClass" TEXT NOT NULL DEFAULT 'INTERNAL',
  "actorType" TEXT,
  "actorId" TEXT,
  "correlationId" TEXT,
  "requestId" TEXT,
  "payload" JSONB NOT NULL,
  "outboxId" TEXT
);

CREATE TABLE IF NOT EXISTS "AnalyticsConsumerCheckpoint" (
  "id" TEXT PRIMARY KEY,
  "consumerName" TEXT NOT NULL UNIQUE,
  "lastEventId" TEXT,
  "lastOccurredAt" TIMESTAMP(3),
  "cursor" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AnalyticsDeadLetter" (
  "id" TEXT PRIMARY KEY,
  "outboxId" TEXT,
  "eventId" TEXT,
  "eventType" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT NOT NULL,
  "payload" JSONB,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);

CREATE TABLE IF NOT EXISTS "AnalyticsFactPlatformBilling" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AnalyticsFactSubscription" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "planCode" TEXT,
  "amount" DECIMAL(18,2),
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AnalyticsFactTenantActivity" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "AnalyticsDailySnapshot" (
  "id" TEXT PRIMARY KEY,
  "snapshotDate" DATE NOT NULL,
  "metricKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT '',
  "valueNumeric" DECIMAL(18,4),
  "valueJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("snapshotDate", "metricKey", "tenantId")
);

CREATE TABLE IF NOT EXISTS "AnalyticsMonthlySnapshot" (
  "id" TEXT PRIMARY KEY,
  "yearMonth" TEXT NOT NULL,
  "metricKey" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL DEFAULT '',
  "valueNumeric" DECIMAL(18,4),
  "valueJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rebuiltAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("yearMonth", "metricKey", "tenantId")
);

CREATE TABLE IF NOT EXISTS "AnalyticsDataFreshness" (
  "id" TEXT PRIMARY KEY,
  "sourceKey" TEXT NOT NULL UNIQUE,
  "lastSuccessAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "lagSeconds" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "detail" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS "AnalyticsReconciliationRun" (
  "id" TEXT PRIMARY KEY,
  "checkKey" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "expected" INTEGER NOT NULL,
  "actual" INTEGER NOT NULL,
  "variance" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "detail" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
