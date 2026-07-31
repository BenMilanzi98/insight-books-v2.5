-- Phase 9 Wave 2 — product usage facts / first-value / adoption history (PostgreSQL).
-- Safe to re-run with IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "AnalyticsFactProductUsage" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "featureCode" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_tenantId_featureCode_occurredAt_idx"
  ON "AnalyticsFactProductUsage" ("tenantId", "featureCode", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_tenantId_eventType_occurredAt_idx"
  ON "AnalyticsFactProductUsage" ("tenantId", "eventType", "occurredAt");
CREATE INDEX IF NOT EXISTS "AnalyticsFactProductUsage_featureCode_occurredAt_idx"
  ON "AnalyticsFactProductUsage" ("featureCode", "occurredAt");

CREATE TABLE IF NOT EXISTS "ProductFirstValueFact" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "featureCode" TEXT NOT NULL,
  "ruleVersion" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "ProductFirstValueFact_tenantId_featureCode_ruleVersion_key"
  ON "ProductFirstValueFact" ("tenantId", "featureCode", "ruleVersion");
CREATE INDEX IF NOT EXISTS "ProductFirstValueFact_tenantId_featureCode_idx"
  ON "ProductFirstValueFact" ("tenantId", "featureCode");

CREATE TABLE IF NOT EXISTS "ProductAdoptionStateHistory" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "featureCode" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "previousState" TEXT,
  "ruleVersion" TEXT NOT NULL,
  "definitionVersion" TEXT NOT NULL,
  "reasonCode" TEXT,
  "evidence" JSONB,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "ProductAdoptionStateHistory_tenantId_featureCode_observedAt_idx"
  ON "ProductAdoptionStateHistory" ("tenantId", "featureCode", "observedAt");
CREATE INDEX IF NOT EXISTS "ProductAdoptionStateHistory_tenantId_featureCode_state_idx"
  ON "ProductAdoptionStateHistory" ("tenantId", "featureCode", "state");
