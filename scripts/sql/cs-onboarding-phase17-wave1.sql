-- Phase 17 Wave 1 — Customer Onboarding Request + Project spine (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Handoff ≠ Request ≠ Project. Never fabricates onboarding complete.
-- Numbers: ONR-YYYY-###### / ONB-YYYY-###### via CrmNumberSeq (prefixes ONR, ONB).
-- Seed ACTIVE STANDARD template version for Project pin (materialisation deferred Wave 2).

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTemplateVersion" (
  "id" TEXT PRIMARY KEY,
  "templateCode" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "onboardingType" TEXT NOT NULL DEFAULT 'STANDARD',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingTemplateVersion_code_version_key"
  ON "CustomerOnboardingTemplateVersion"("templateCode", "versionNumber");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTemplateVersion_type_status_idx"
  ON "CustomerOnboardingTemplateVersion"("onboardingType", "status");

INSERT INTO "CustomerOnboardingTemplateVersion" (
  "id", "templateCode", "versionNumber", "onboardingType", "status", "contentJson", "immutable", "createdAt", "updatedAt"
)
SELECT
  'tmplv-standard-wave1-v1',
  'STANDARD_WAVE1',
  1,
  'STANDARD',
  'ACTIVE',
  '{"wave":1,"materialisation":"DEFERRED_TO_WAVE_2","workstreams":[],"milestones":[],"tasks":[]}'::jsonb,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "CustomerOnboardingTemplateVersion"
  WHERE "templateCode" = 'STANDARD_WAVE1' AND "versionNumber" = 1
);

CREATE TABLE IF NOT EXISTS "CustomerOnboardingRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "onboardingType" TEXT,
  "handoffId" TEXT,
  "conversionId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "payloadJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "projectId" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingRequest_requestNumber_key"
  ON "CustomerOnboardingRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingRequest_idempotencyKey_key"
  ON "CustomerOnboardingRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_status_createdAt_idx"
  ON "CustomerOnboardingRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_handoffId_idx"
  ON "CustomerOnboardingRequest"("handoffId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_customer_tenant_idx"
  ON "CustomerOnboardingRequest"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_subscriptionId_idx"
  ON "CustomerOnboardingRequest"("subscriptionId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_conversionId_idx"
  ON "CustomerOnboardingRequest"("conversionId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequest_source_idx"
  ON "CustomerOnboardingRequest"("source");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingRequestStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequestStatusHistory_request_at_idx"
  ON "CustomerOnboardingRequestStatusHistory"("requestId", "at");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRequestStatusHistory_changedBy_idx"
  ON "CustomerOnboardingRequestStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingProject" (
  "id" TEXT PRIMARY KEY,
  "onboardingNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "onboardingType" TEXT,
  "onboardingRequestId" TEXT NOT NULL,
  "handoffId" TEXT,
  "conversionId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "templateVersionId" TEXT NOT NULL,
  "targetKickoffDate" TIMESTAMP(3),
  "targetGoLiveDate" TIMESTAMP(3),
  "ownerAssignmentsJson" JSONB,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingProject_onboardingNumber_key"
  ON "CustomerOnboardingProject"("onboardingNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingProject_idempotencyKey_key"
  ON "CustomerOnboardingProject"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingProject_onboardingRequestId_key"
  ON "CustomerOnboardingProject"("onboardingRequestId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_status_createdAt_idx"
  ON "CustomerOnboardingProject"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_customer_tenant_idx"
  ON "CustomerOnboardingProject"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_templateVersionId_idx"
  ON "CustomerOnboardingProject"("templateVersionId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_conversionId_idx"
  ON "CustomerOnboardingProject"("conversionId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingProjectStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProjectStatusHistory_project_at_idx"
  ON "CustomerOnboardingProjectStatusHistory"("projectId", "at");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProjectStatusHistory_changedBy_idx"
  ON "CustomerOnboardingProjectStatusHistory"("changedByAdminId");

-- Ensure CrmNumberSeq can allocate ONR / ONB (rows created lazily by allocateCrmNumber).
-- Optional seed for current UTC year:
-- INSERT INTO "CrmNumberSeq" ("prefix", "year", "lastIssued", "updatedAt")
-- VALUES ('ONR', EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::int, 0, CURRENT_TIMESTAMP)
-- ON CONFLICT DO NOTHING;
