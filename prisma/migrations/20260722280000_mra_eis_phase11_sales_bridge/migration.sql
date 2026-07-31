-- Phase 11: Sales eligibility decisions + local transaction bridge
-- No fiscal numbers, QR, or MRA payloads.

ALTER TABLE "MraEisBusinessSetting" ADD COLUMN IF NOT EXISTS "eisGoLiveAt" TIMESTAMP(3);
ALTER TABLE "MraEisBusinessSetting" ADD COLUMN IF NOT EXISTS "businessTimezone" TEXT NOT NULL DEFAULT 'Africa/Blantyre';

CREATE TABLE IF NOT EXISTS "MraEisEligibilityDecision" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceFinalizationIdentity" TEXT,
    "environment" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "evaluatedAt" TIMESTAMP(3) NOT NULL,
    "evaluatedBy" TEXT,
    "terminalId" TEXT,
    "configurationSetChecksum" TEXT,
    "mappingCompletenessVersion" TEXT,
    "productServiceCompletenessVersion" TEXT,
    "sourceChecksum" TEXT,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "grossAmount" DECIMAL(18,2),
    "netAmount" DECIMAL(18,2),
    "taxAmount" DECIMAL(18,2),
    "levyAmount" DECIMAL(18,2),
    "discountAmount" DECIMAL(18,2),
    "paymentTotal" DECIMAL(18,2),
    "buyerClassification" TEXT,
    "blockerCodes" JSONB,
    "warningCodes" JSONB,
    "safeDecisionSummary" TEXT,
    "stageEvidence" JSONB,
    "purpose" TEXT,
    "supersedesDecisionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisEligibilityDecision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisEligibilityDecision_tenant_business_source_idx"
  ON "MraEisEligibilityDecision"("tenantId", "businessId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "MraEisEligibilityDecision_tenant_business_decision_idx"
  ON "MraEisEligibilityDecision"("tenantId", "businessId", "decision", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "MraEisEligibilityDecision_identity_idx"
  ON "MraEisEligibilityDecision"("sourceFinalizationIdentity");

CREATE TABLE IF NOT EXISTS "MraEisSalesBridge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceVersion" TEXT NOT NULL,
    "sourceFinalizationIdentity" TEXT NOT NULL,
    "sourceTransactionNumber" TEXT,
    "sourceFinalizedAt" TIMESTAMP(3) NOT NULL,
    "businessDate" DATE NOT NULL,
    "environment" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "applicabilityDecision" TEXT,
    "eligibilityDecisionId" TEXT,
    "eligibilityPolicyVersion" TEXT,
    "sourceChecksum" TEXT,
    "configurationSetChecksum" TEXT,
    "mappingCompletenessVersion" TEXT,
    "productServiceCompletenessVersion" TEXT,
    "lineCount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "grossAmount" DECIMAL(18,2),
    "taxAmount" DECIMAL(18,2),
    "levyAmount" DECIMAL(18,2),
    "discountAmount" DECIMAL(18,2),
    "paymentTotal" DECIMAL(18,2),
    "buyerClassification" TEXT,
    "siteMappingId" TEXT,
    "warehouseMappingId" TEXT,
    "futureFiscalSnapshotId" TEXT,
    "bridgeCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEvaluatedAt" TIMESTAMP(3),
    "manualReviewCaseId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisSalesBridge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSalesBridge_identity_env_key"
  ON "MraEisSalesBridge"("tenantId", "businessId", "sourceFinalizationIdentity", "environment");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSalesBridge_futureFiscalSnapshotId_key"
  ON "MraEisSalesBridge"("futureFiscalSnapshotId");
CREATE INDEX IF NOT EXISTS "MraEisSalesBridge_tenant_business_source_idx"
  ON "MraEisSalesBridge"("tenantId", "businessId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "MraEisSalesBridge_tenant_business_status_idx"
  ON "MraEisSalesBridge"("tenantId", "businessId", "status");
CREATE INDEX IF NOT EXISTS "MraEisSalesBridge_status_eval_idx"
  ON "MraEisSalesBridge"("status", "lastEvaluatedAt");
CREATE INDEX IF NOT EXISTS "MraEisSalesBridge_env_status_idx"
  ON "MraEisSalesBridge"("environment", "status");

DO $$ BEGIN
  ALTER TABLE "MraEisSalesBridge"
    ADD CONSTRAINT "MraEisSalesBridge_eligibilityDecisionId_fkey"
    FOREIGN KEY ("eligibilityDecisionId") REFERENCES "MraEisEligibilityDecision"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
