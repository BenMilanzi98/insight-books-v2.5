-- Phase 19 Wave 1 — Customer Adoption Request + Plan spine (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Training Program COMPLETED → Request (ADR). Handover attach ≠ invent COMPLETED.
-- Numbers: ADR-YYYY-###### / ADP-YYYY-###### via CrmNumberSeq (prefixes ADR, ADP).
-- Seed ACTIVE default plan template version for Plan pin (milestones deferred Wave 2).

CREATE TABLE IF NOT EXISTS "CustomerAdoptionPlanTemplate" (
  "id" TEXT PRIMARY KEY,
  "templateCode" TEXT NOT NULL,
  "name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionPlanTemplate_templateCode_key"
  ON "CustomerAdoptionPlanTemplate"("templateCode");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlanTemplate_status_idx"
  ON "CustomerAdoptionPlanTemplate"("status");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionPlanTemplateVersion" (
  "id" TEXT PRIMARY KEY,
  "templateId" TEXT,
  "templateCode" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionPlanTemplateVersion_code_version_key"
  ON "CustomerAdoptionPlanTemplateVersion"("templateCode", "versionNumber");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlanTemplateVersion_status_idx"
  ON "CustomerAdoptionPlanTemplateVersion"("status");

INSERT INTO "CustomerAdoptionPlanTemplate" (
  "id", "templateCode", "name", "status", "createdAt", "updatedAt"
)
SELECT
  'adpt-default-wave1',
  'CUSTOMER_ADOPTION_DEFAULT_WAVE1',
  'Customer Adoption Default (Wave 1)',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "CustomerAdoptionPlanTemplate"
  WHERE "templateCode" = 'CUSTOMER_ADOPTION_DEFAULT_WAVE1'
);

INSERT INTO "CustomerAdoptionPlanTemplateVersion" (
  "id", "templateId", "templateCode", "versionNumber", "status",
  "contentJson", "immutable", "createdAt", "updatedAt"
)
SELECT
  'adptv-default-wave1-v1',
  'adpt-default-wave1',
  'CUSTOMER_ADOPTION_DEFAULT_WAVE1',
  1,
  'ACTIVE',
  '{"wave":1,"milestonesDeferred":true,"valueOutcomesDeferred":true}'::jsonb,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "CustomerAdoptionPlanTemplateVersion"
  WHERE "templateCode" = 'CUSTOMER_ADOPTION_DEFAULT_WAVE1' AND "versionNumber" = 1
);

CREATE TABLE IF NOT EXISTS "CustomerAdoptionRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "trainingProgramId" TEXT,
  "onboardingProjectId" TEXT,
  "onboardingHandoverId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "targetRolesJson" JSONB,
  "payloadJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "planId" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionRequest_requestNumber_key"
  ON "CustomerAdoptionRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionRequest_idempotencyKey_key"
  ON "CustomerAdoptionRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_status_createdAt_idx"
  ON "CustomerAdoptionRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_trainingProgramId_idx"
  ON "CustomerAdoptionRequest"("trainingProgramId");
-- One auto ADR per Training Program (PHASE_18_TRAINING_COMPLETED only).
-- Partial unique so manual/other sources may still pin the same program id.
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionRequest_trainingProgramId_auto_source_key"
  ON "CustomerAdoptionRequest"("trainingProgramId")
  WHERE "trainingProgramId" IS NOT NULL
    AND "source" = 'PHASE_18_TRAINING_COMPLETED';
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_customer_tenant_idx"
  ON "CustomerAdoptionRequest"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_subscriptionId_idx"
  ON "CustomerAdoptionRequest"("subscriptionId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_source_idx"
  ON "CustomerAdoptionRequest"("source");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_onboardingHandoverId_idx"
  ON "CustomerAdoptionRequest"("onboardingHandoverId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequest_onboardingProjectId_idx"
  ON "CustomerAdoptionRequest"("onboardingProjectId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionRequestStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequestStatusHistory_request_at_idx"
  ON "CustomerAdoptionRequestStatusHistory"("requestId", "at");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionRequestStatusHistory_changedBy_idx"
  ON "CustomerAdoptionRequestStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionPlan" (
  "id" TEXT PRIMARY KEY,
  "planNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "adoptionRequestId" TEXT NOT NULL,
  "trainingProgramId" TEXT,
  "onboardingProjectId" TEXT,
  "onboardingHandoverId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "planTemplateVersionId" TEXT NOT NULL,
  "successPlanId" TEXT,
  "ownerAssignmentsJson" JSONB,
  "csOwnerAdminId" TEXT,
  "ownerAdminId" TEXT,
  "healthStatus" TEXT,
  "valueReviewState" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionPlan_planNumber_key"
  ON "CustomerAdoptionPlan"("planNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionPlan_idempotencyKey_key"
  ON "CustomerAdoptionPlan"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionPlan_adoptionRequestId_key"
  ON "CustomerAdoptionPlan"("adoptionRequestId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_status_createdAt_idx"
  ON "CustomerAdoptionPlan"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_customer_tenant_idx"
  ON "CustomerAdoptionPlan"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_planTemplateVersionId_idx"
  ON "CustomerAdoptionPlan"("planTemplateVersionId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_trainingProgramId_idx"
  ON "CustomerAdoptionPlan"("trainingProgramId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_csOwnerAdminId_idx"
  ON "CustomerAdoptionPlan"("csOwnerAdminId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlan_ownerAdminId_idx"
  ON "CustomerAdoptionPlan"("ownerAdminId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionPlanStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlanStatusHistory_plan_at_idx"
  ON "CustomerAdoptionPlanStatusHistory"("planId", "at");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionPlanStatusHistory_changedBy_idx"
  ON "CustomerAdoptionPlanStatusHistory"("changedByAdminId");

-- Ensure CrmNumberSeq can allocate ADR / ADP (rows created lazily by allocateCrmNumber).
-- Optional seed for current UTC year:
-- INSERT INTO "CrmNumberSeq" ("prefix", "year", "lastIssued", "updatedAt")
-- VALUES ('ADR', EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::int, 0, CURRENT_TIMESTAMP)
-- ON CONFLICT DO NOTHING;
