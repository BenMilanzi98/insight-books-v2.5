-- Phase 16 Wave 1 — Conversion request / plan / dry-run / durable orchestrator spine (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Dry-run = zero operational side effects.
-- Closed Won via Phase 12 only at durable start; retained on later failure.
-- Never creates Customer / Tenant / Subscription / Invoice in Wave 1.

CREATE TABLE IF NOT EXISTS "CrmConversionRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "source" TEXT,
  "conversionType" TEXT,
  "acceptanceId" TEXT,
  "handoffId" TEXT,
  "opportunityId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "documentVersionId" TEXT,
  "checksumSha256" TEXT,
  "currency" TEXT,
  "payloadJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "currentPlanId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionRequest_requestNumber_key" ON "CrmConversionRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionRequest_idempotencyKey_key" ON "CrmConversionRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_status_createdAt_idx" ON "CrmConversionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_acceptanceId_idx" ON "CrmConversionRequest"("acceptanceId");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_handoffId_idx" ON "CrmConversionRequest"("handoffId");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_opportunityId_idx" ON "CrmConversionRequest"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_owner_status_idx" ON "CrmConversionRequest"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmConversionRequest_source_idx" ON "CrmConversionRequest"("source");

CREATE TABLE IF NOT EXISTS "CrmConversionRequestStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionRequestStatusHistory_request_at_idx"
  ON "CrmConversionRequestStatusHistory"("requestId", "at");
CREATE INDEX IF NOT EXISTS "CrmConversionRequestStatusHistory_changedBy_idx"
  ON "CrmConversionRequestStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmConversionPlan" (
  "id" TEXT PRIMARY KEY,
  "conversionRequestId" TEXT NOT NULL,
  "latestVersionNumber" INTEGER NOT NULL DEFAULT 0,
  "currentVersionId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionPlan_conversionRequestId_key"
  ON "CrmConversionPlan"("conversionRequestId");
CREATE INDEX IF NOT EXISTS "CrmConversionPlan_createdBy_idx" ON "CrmConversionPlan"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmConversionPlanVersion" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "planChecksum" TEXT,
  "contentJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "notes" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionPlanVersion_plan_version_key"
  ON "CrmConversionPlanVersion"("planId", "versionNumber");
CREATE INDEX IF NOT EXISTS "CrmConversionPlanVersion_checksum_idx"
  ON "CrmConversionPlanVersion"("planChecksum");

CREATE TABLE IF NOT EXISTS "CrmConversionDryRun" (
  "id" TEXT PRIMARY KEY,
  "conversionRequestId" TEXT NOT NULL,
  "conversionPlanVersionId" TEXT NOT NULL,
  "previewJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionDryRun_request_createdAt_idx"
  ON "CrmConversionDryRun"("conversionRequestId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmConversionDryRun_planVersion_idx"
  ON "CrmConversionDryRun"("conversionPlanVersionId");

CREATE TABLE IF NOT EXISTS "CrmConversion" (
  "id" TEXT PRIMARY KEY,
  "conversionNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'LOCKED',
  "conversionRequestId" TEXT NOT NULL,
  "conversionPlanVersionId" TEXT,
  "opportunityId" TEXT,
  "acceptanceId" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "closedWonAt" TIMESTAMP(3),
  "closedWonRetained" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversion_conversionNumber_key" ON "CrmConversion"("conversionNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversion_idempotencyKey_key" ON "CrmConversion"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversion_request_status_idx" ON "CrmConversion"("conversionRequestId", "status");
CREATE INDEX IF NOT EXISTS "CrmConversion_opportunityId_idx" ON "CrmConversion"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmConversion_acceptanceId_idx" ON "CrmConversion"("acceptanceId");
CREATE INDEX IF NOT EXISTS "CrmConversion_inputHash_idx" ON "CrmConversion"("inputHash");
CREATE INDEX IF NOT EXISTS "CrmConversion_status_createdAt_idx" ON "CrmConversion"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmConversionStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionStatusHistory_conversion_at_idx"
  ON "CrmConversionStatusHistory"("conversionId", "at");

CREATE TABLE IF NOT EXISTS "CrmConversionStep" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "stepCode" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "inputHash" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "outputJson" JSONB,
  "errorCode" TEXT,
  "retryable" BOOLEAN NOT NULL DEFAULT FALSE,
  "compensationState" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionStep_conversion_step_key"
  ON "CrmConversionStep"("conversionId", "stepCode");
CREATE INDEX IF NOT EXISTS "CrmConversionStep_conversion_order_idx"
  ON "CrmConversionStep"("conversionId", "stepOrder");
CREATE INDEX IF NOT EXISTS "CrmConversionStep_status_idx" ON "CrmConversionStep"("status");

CREATE TABLE IF NOT EXISTS "CrmConversionAttempt" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "stepId" TEXT,
  "stepCode" TEXT,
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "inputHash" TEXT,
  "status" TEXT,
  "outputJson" JSONB,
  "errorCode" TEXT,
  "actorAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionAttempt_conversion_step_idx"
  ON "CrmConversionAttempt"("conversionId", "stepCode");
CREATE INDEX IF NOT EXISTS "CrmConversionAttempt_stepId_idx" ON "CrmConversionAttempt"("stepId");

CREATE TABLE IF NOT EXISTS "CrmConversionFailure" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT,
  "conversionRequestId" TEXT,
  "errorCode" TEXT NOT NULL,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionFailure_conversionId_idx" ON "CrmConversionFailure"("conversionId");
CREATE INDEX IF NOT EXISTS "CrmConversionFailure_requestId_idx" ON "CrmConversionFailure"("conversionRequestId");
CREATE INDEX IF NOT EXISTS "CrmConversionFailure_errorCode_idx" ON "CrmConversionFailure"("errorCode");
