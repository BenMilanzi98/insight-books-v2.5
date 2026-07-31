-- Phase 18 Wave 1 — Customer Training Request + Program spine (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Handoff ≠ Request ≠ Program. Never fabricates trainingCompleted.
-- Numbers: TRQ-YYYY-###### / TRN-YYYY-###### via CrmNumberSeq (prefixes TRQ, TRN).
-- Seed ACTIVE CUSTOMER_ONBOARDING curriculum version for Program pin (Sessions deferred Wave 2).

CREATE TABLE IF NOT EXISTS "CustomerTrainingCurriculum" (
  "id" TEXT PRIMARY KEY,
  "curriculumCode" TEXT NOT NULL,
  "name" TEXT,
  "trainingType" TEXT NOT NULL DEFAULT 'CUSTOMER_ONBOARDING',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCurriculum_curriculumCode_key"
  ON "CustomerTrainingCurriculum"("curriculumCode");
CREATE INDEX IF NOT EXISTS "CustomerTrainingCurriculum_type_status_idx"
  ON "CustomerTrainingCurriculum"("trainingType", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingCurriculumVersion" (
  "id" TEXT PRIMARY KEY,
  "curriculumId" TEXT,
  "curriculumCode" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "trainingType" TEXT NOT NULL DEFAULT 'CUSTOMER_ONBOARDING',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCurriculumVersion_code_version_key"
  ON "CustomerTrainingCurriculumVersion"("curriculumCode", "versionNumber");
CREATE INDEX IF NOT EXISTS "CustomerTrainingCurriculumVersion_type_status_idx"
  ON "CustomerTrainingCurriculumVersion"("trainingType", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingModule" (
  "id" TEXT PRIMARY KEY,
  "moduleCode" TEXT NOT NULL,
  "name" TEXT,
  "curriculumId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingModule_moduleCode_key"
  ON "CustomerTrainingModule"("moduleCode");
CREATE INDEX IF NOT EXISTS "CustomerTrainingModule_curriculumId_idx"
  ON "CustomerTrainingModule"("curriculumId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingModuleVersion" (
  "id" TEXT PRIMARY KEY,
  "moduleId" TEXT,
  "moduleCode" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "curriculumVersionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingModuleVersion_code_version_key"
  ON "CustomerTrainingModuleVersion"("moduleCode", "versionNumber");
CREATE INDEX IF NOT EXISTS "CustomerTrainingModuleVersion_curriculumVersionId_idx"
  ON "CustomerTrainingModuleVersion"("curriculumVersionId");

INSERT INTO "CustomerTrainingCurriculum" (
  "id", "curriculumCode", "name", "trainingType", "status", "createdAt", "updatedAt"
)
SELECT
  'curr-onboarding-wave1',
  'CUSTOMER_ONBOARDING_WAVE1',
  'Customer Onboarding Training (Wave 1)',
  'CUSTOMER_ONBOARDING',
  'ACTIVE',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "CustomerTrainingCurriculum"
  WHERE "curriculumCode" = 'CUSTOMER_ONBOARDING_WAVE1'
);

INSERT INTO "CustomerTrainingCurriculumVersion" (
  "id", "curriculumId", "curriculumCode", "versionNumber", "trainingType", "status",
  "contentJson", "immutable", "createdAt", "updatedAt"
)
SELECT
  'currv-onboarding-wave1-v1',
  'curr-onboarding-wave1',
  'CUSTOMER_ONBOARDING_WAVE1',
  1,
  'CUSTOMER_ONBOARDING',
  'ACTIVE',
  '{"wave":1,"sessionsDeferred":true,"modules":[],"assessments":[]}'::jsonb,
  TRUE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "CustomerTrainingCurriculumVersion"
  WHERE "curriculumCode" = 'CUSTOMER_ONBOARDING_WAVE1' AND "versionNumber" = 1
);

CREATE TABLE IF NOT EXISTS "CustomerTrainingRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "trainingType" TEXT,
  "handoffId" TEXT,
  "conversionId" TEXT,
  "onboardingProjectId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "payloadJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "programId" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingRequest_requestNumber_key"
  ON "CustomerTrainingRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingRequest_idempotencyKey_key"
  ON "CustomerTrainingRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_status_createdAt_idx"
  ON "CustomerTrainingRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_handoffId_idx"
  ON "CustomerTrainingRequest"("handoffId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_customer_tenant_idx"
  ON "CustomerTrainingRequest"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_subscriptionId_idx"
  ON "CustomerTrainingRequest"("subscriptionId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_conversionId_idx"
  ON "CustomerTrainingRequest"("conversionId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_source_idx"
  ON "CustomerTrainingRequest"("source");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequest_onboardingProjectId_idx"
  ON "CustomerTrainingRequest"("onboardingProjectId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingRequestStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequestStatusHistory_request_at_idx"
  ON "CustomerTrainingRequestStatusHistory"("requestId", "at");
CREATE INDEX IF NOT EXISTS "CustomerTrainingRequestStatusHistory_changedBy_idx"
  ON "CustomerTrainingRequestStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingProgram" (
  "id" TEXT PRIMARY KEY,
  "programNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "trainingType" TEXT,
  "trainingRequestId" TEXT NOT NULL,
  "handoffId" TEXT,
  "conversionId" TEXT,
  "onboardingProjectId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "subscriptionId" TEXT,
  "curriculumVersionId" TEXT NOT NULL,
  "targetStartDate" TIMESTAMP(3),
  "targetCompletionDate" TIMESTAMP(3),
  "ownerAssignmentsJson" JSONB,
  "csOwnerAdminId" TEXT,
  "ownerAdminId" TEXT,
  "inputHash" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingProgram_programNumber_key"
  ON "CustomerTrainingProgram"("programNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingProgram_idempotencyKey_key"
  ON "CustomerTrainingProgram"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingProgram_trainingRequestId_key"
  ON "CustomerTrainingProgram"("trainingRequestId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_status_createdAt_idx"
  ON "CustomerTrainingProgram"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_customer_tenant_idx"
  ON "CustomerTrainingProgram"("customerId", "tenantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_curriculumVersionId_idx"
  ON "CustomerTrainingProgram"("curriculumVersionId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_conversionId_idx"
  ON "CustomerTrainingProgram"("conversionId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_csOwnerAdminId_idx"
  ON "CustomerTrainingProgram"("csOwnerAdminId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgram_ownerAdminId_idx"
  ON "CustomerTrainingProgram"("ownerAdminId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingProgramStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgramStatusHistory_program_at_idx"
  ON "CustomerTrainingProgramStatusHistory"("programId", "at");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgramStatusHistory_changedBy_idx"
  ON "CustomerTrainingProgramStatusHistory"("changedByAdminId");

-- Ensure CrmNumberSeq can allocate TRQ / TRN (rows created lazily by allocateCrmNumber).
-- Optional seed for current UTC year:
-- INSERT INTO "CrmNumberSeq" ("prefix", "year", "lastIssued", "updatedAt")
-- VALUES ('TRQ', EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::int, 0, CURRENT_TIMESTAMP)
-- ON CONFLICT DO NOTHING;
