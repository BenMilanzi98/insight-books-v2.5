-- Phase 14 Loan Readiness (LrdV2*) — additive; proposed facilities never post to GL.

CREATE TABLE IF NOT EXISTS "LrdV2Configuration" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "loanReadinessEnabled" BOOLEAN NOT NULL DEFAULT true,
  "defaultBaseCurrency" TEXT NOT NULL DEFAULT 'MWK', "historicalLookbackYears" INTEGER NOT NULL DEFAULT 3,
  "provisionalActualsAllowed" BOOLEAN NOT NULL DEFAULT true, "approvedForecastRequired" BOOLEAN NOT NULL DEFAULT false,
  "covenantMonitoringEnabled" BOOLEAN NOT NULL DEFAULT true, "aiCommentaryEnabled" BOOLEAN NOT NULL DEFAULT false,
  "architectureVersion" TEXT NOT NULL DEFAULT 'LRD_V1', "effectiveFrom" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LrdV2Configuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LrdV2Configuration_tenantId_key" ON "LrdV2Configuration"("tenantId");

CREATE TABLE IF NOT EXISTS "LrdV2AssessmentCycle" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "assessmentNumber" TEXT NOT NULL, "name" TEXT NOT NULL,
  "description" TEXT, "assessmentDate" DATE NOT NULL, "forecastVersionId" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "LrdV2AssessmentCycle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LrdV2AssessmentCycle_tenantId_assessmentNumber_key" ON "LrdV2AssessmentCycle"("tenantId", "assessmentNumber");
CREATE INDEX IF NOT EXISTS "LrdV2AssessmentCycle_tenantId_status_idx" ON "LrdV2AssessmentCycle"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "LrdV2AssessmentVersion" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "assessmentCycleId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "integrityStatus" TEXT NOT NULL DEFAULT 'NOT_CALCULATED',
  "sourceActualsVersion" TEXT, "forecastVersionId" TEXT, "scoreModelVersion" TEXT NOT NULL DEFAULT 'READINESS_SCORE_V1',
  "totalReadinessScore" INTEGER, "confidence" TEXT, "resultPayload" JSONB, "checksum" TEXT,
  "preparedBy" TEXT, "reviewedBy" TEXT, "approvedBy" TEXT, "generatedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "LrdV2AssessmentVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LrdV2AssessmentVersion_assessmentCycleId_version_key" ON "LrdV2AssessmentVersion"("assessmentCycleId", "version");
CREATE INDEX IF NOT EXISTS "LrdV2AssessmentVersion_tenantId_status_idx" ON "LrdV2AssessmentVersion"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "LrdV2LoanRequest" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "requestNumber" TEXT NOT NULL, "purpose" TEXT NOT NULL,
  "requestedAmountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'MWK', "requestedTermMonths" INTEGER NOT NULL,
  "repaymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY', "expectedInterestRateBps" INTEGER NOT NULL DEFAULT 0,
  "rateType" TEXT NOT NULL DEFAULT 'FIXED', "gracePeriodMonths" INTEGER NOT NULL DEFAULT 0,
  "balloonAmountMinor" BIGINT NOT NULL DEFAULT 0, "amortizationMethod" TEXT NOT NULL DEFAULT 'EQUAL_INSTALMENT',
  "useOfFunds" JSONB, "proposedSecurityType" TEXT, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdBy" TEXT, "approvedBy" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "LrdV2LoanRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LrdV2LoanRequest_tenantId_requestNumber_key" ON "LrdV2LoanRequest"("tenantId", "requestNumber");
CREATE INDEX IF NOT EXISTS "LrdV2LoanRequest_tenantId_status_idx" ON "LrdV2LoanRequest"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "LrdV2AssessmentSnapshot" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "assessmentVersionId" TEXT NOT NULL, "snapshotType" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "checksum" TEXT, "generatedBy" TEXT, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LrdV2AssessmentSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LrdV2AssessmentSnapshot_assessmentVersionId_snapshotType_key" ON "LrdV2AssessmentSnapshot"("assessmentVersionId", "snapshotType");
CREATE INDEX IF NOT EXISTS "LrdV2AssessmentSnapshot_tenantId_assessmentVersionId_idx" ON "LrdV2AssessmentSnapshot"("tenantId", "assessmentVersionId");

CREATE TABLE IF NOT EXISTS "LrdV2AICommentary" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "assessmentVersionId" TEXT, "draftText" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "modelProvider" TEXT, "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LrdV2AICommentary_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LrdV2AICommentary_tenantId_status_idx" ON "LrdV2AICommentary"("tenantId", "status");

DO $$ BEGIN
  ALTER TABLE "LrdV2AssessmentVersion" ADD CONSTRAINT "LrdV2AssessmentVersion_assessmentCycleId_fkey"
    FOREIGN KEY ("assessmentCycleId") REFERENCES "LrdV2AssessmentCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LrdV2AssessmentSnapshot" ADD CONSTRAINT "LrdV2AssessmentSnapshot_assessmentVersionId_fkey"
    FOREIGN KEY ("assessmentVersionId") REFERENCES "LrdV2AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LrdV2AICommentary" ADD CONSTRAINT "LrdV2AICommentary_assessmentVersionId_fkey"
    FOREIGN KEY ("assessmentVersionId") REFERENCES "LrdV2AssessmentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO "AcctV2FeatureFlag" ("id", "tenantId", "flagKey", "moduleKey", "eventType", "enabled", "reason", "updatedBy", "createdAt", "updatedAt")
VALUES
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'loanReadinessV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'debtCapacityV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'proposedFacilityModellingV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'stressTestingV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'covenantMonitoringV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'readinessScoringV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'lenderPackageV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('lrdflag_', md5(random()::text || clock_timestamp()::text)), '*', 'executiveFinancialDashboardV2Enabled', '*', '*', true, 'Phase 14 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "flagKey", "moduleKey", "eventType")
DO UPDATE SET "enabled" = true, "reason" = EXCLUDED."reason", "updatedAt" = CURRENT_TIMESTAMP;