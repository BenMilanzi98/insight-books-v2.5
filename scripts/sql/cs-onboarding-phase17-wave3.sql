-- Phase 17 Wave 3 — Readiness, migration/MRA/training coordination, testing/defects,
-- go-live → stabilisation → handover → completion certificate + health/progress.
-- Prefer: npx prisma db push + npx prisma generate.
-- Use when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- UNKNOWN readiness ≠ READY. Critical defects block go-live.
-- Successful go-live → STABILISATION (not COMPLETED).
-- Migration COMPLETED requires reconciliation. Training COMPLETED requires Phase 18 source.
-- Completion certificate checksum; exact retry returns same certificate.
-- No journals / OB / stock from onboarding. Document metadata only (no credentials).

CREATE TABLE IF NOT EXISTS "CustomerOnboardingReadinessEvaluation" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "overallStatus" TEXT NOT NULL,
  "dimensionsJson" JSONB,
  "rulesVersion" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingReadinessEvaluation_project_created_idx"
  ON "CustomerOnboardingReadinessEvaluation"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingReadinessEvaluation_overallStatus_idx"
  ON "CustomerOnboardingReadinessEvaluation"("overallStatus");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingMigration" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "reconciliationStatus" TEXT,
  "fileInventoryJson" JSONB,
  "securityFlagsJson" JSONB,
  "engineStatus" TEXT DEFAULT 'NOT_AVAILABLE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingMigration_status_idx"
  ON "CustomerOnboardingMigration"("status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingMraEis" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "credentialStatus" TEXT DEFAULT 'UNKNOWN',
  "testApprovalRef" TEXT,
  "productionApprovalRef" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingMraEis_status_idx"
  ON "CustomerOnboardingMraEis"("status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTraining" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "sourceDomain" TEXT,
  "trainingDomainSource" TEXT,
  "trainingDomainStatus" TEXT DEFAULT 'UNKNOWN',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTraining_status_idx"
  ON "CustomerOnboardingTraining"("status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTestPlan" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "casesJson" JSONB,
  "resultsJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTestPlan_project_status_idx"
  ON "CustomerOnboardingTestPlan"("projectId", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingDefect" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingDefect_project_sev_status_idx"
  ON "CustomerOnboardingDefect"("projectId", "severity", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingGoLive" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "outcome" TEXT,
  "windowStart" TIMESTAMP(3),
  "windowEnd" TIMESTAMP(3),
  "participantsJson" JSONB,
  "preflightJson" JSONB,
  "customerAcknowledged" BOOLEAN NOT NULL DEFAULT FALSE,
  "rollbackDecision" TEXT,
  "idempotencyKey" TEXT UNIQUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingGoLive_project_status_idx"
  ON "CustomerOnboardingGoLive"("projectId", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingGoLiveApproval" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "approvalRole" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingGoLiveApproval_project_role_idx"
  ON "CustomerOnboardingGoLiveApproval"("projectId", "approvalRole", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingStabilisation" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "checksJson" JSONB,
  "exitCriteriaJson" JSONB,
  "exitApprovedAt" TIMESTAMP(3),
  "exitApprovedByAdminId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingStabilisation_status_idx"
  ON "CustomerOnboardingStabilisation"("status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingHandover" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "recipientsJson" JSONB,
  "openItemsJson" JSONB,
  "acceptedAt" TIMESTAMP(3),
  "acceptedByAdminId" TEXT,
  "idempotencyKey" TEXT UNIQUE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingHandover_project_status_idx"
  ON "CustomerOnboardingHandover"("projectId", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingCompletion" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL UNIQUE,
  "customerSignOffAt" TIMESTAMP(3),
  "customerSignOffByContactId" TEXT,
  "internalSignOffAt" TIMESTAMP(3),
  "internalSignOffByAdminId" TEXT,
  "reconciliationStatus" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CustomerOnboardingCompletionCertificate" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "payloadJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingCompletionCertificate_project_idx"
  ON "CustomerOnboardingCompletionCertificate"("projectId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingCompletionCertificate_checksum_idx"
  ON "CustomerOnboardingCompletionCertificate"("checksumSha256");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingRisk" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingRisk_project_status_idx"
  ON "CustomerOnboardingRisk"("projectId", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingIssue" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingIssue_project_status_idx"
  ON "CustomerOnboardingIssue"("projectId", "status");

-- Document metadata only — never store credentials; no public URLs for migration files
CREATE TABLE IF NOT EXISTS "CustomerOnboardingDocument" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "classification" TEXT NOT NULL DEFAULT 'CUSTOMER_SAFE',
  "mimeType" TEXT,
  "sizeBytes" INTEGER,
  "storageRef" TEXT,
  "publicUrl" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingDocument_project_class_idx"
  ON "CustomerOnboardingDocument"("projectId", "classification");
