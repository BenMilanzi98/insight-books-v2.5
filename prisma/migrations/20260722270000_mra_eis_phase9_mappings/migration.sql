-- MRA EIS Phase 9 — mapping lifecycle extensions
-- Additive. No Sale/Journal/Stock mutations. No Product catalogue sync.

ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'SANDBOX';
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "mappingType" TEXT NOT NULL DEFAULT 'BRANCH_TO_MRA_SITE';
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "mappingVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "sourceConfigurationSnapshotId" TEXT;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "suggestionSource" TEXT;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "approvalId" TEXT;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "activationReason" TEXT;
ALTER TABLE "MraEisSiteMapping" ADD COLUMN IF NOT EXISTS "supersedesMappingId" TEXT;
CREATE INDEX IF NOT EXISTS "MraEisSiteMapping_env_status_idx"
  ON "MraEisSiteMapping"("tenantId","businessId","environment","status");

ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "localTaxCategoryId" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "externalTaxDefinitionId" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'SANDBOX';
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "treatmentType" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "suggestionSource" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "approvalId" TEXT;
ALTER TABLE "MraEisTaxMapping" ADD COLUMN IF NOT EXISTS "supersedesMappingId" TEXT;
CREATE INDEX IF NOT EXISTS "MraEisTaxMapping_env_status_idx"
  ON "MraEisTaxMapping"("tenantId","businessId","environment","status");

ALTER TABLE "MraEisLevyMapping" ADD COLUMN IF NOT EXISTS "externalLevyDefinitionId" TEXT;
ALTER TABLE "MraEisLevyMapping" ADD COLUMN IF NOT EXISTS "environment" TEXT NOT NULL DEFAULT 'SANDBOX';
ALTER TABLE "MraEisLevyMapping" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "MraEisLevyMapping" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "MraEisLevyMapping" ADD COLUMN IF NOT EXISTS "supersedesMappingId" TEXT;

ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "localPaymentMethodType" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "mraPaymentMethodDescription" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "sourceConfigurationSnapshotId" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "suggestionSource" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "approvedBy" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "approvalId" TEXT;
ALTER TABLE "MraEisPaymentMethodMapping" ADD COLUMN IF NOT EXISTS "supersedesMappingId" TEXT;

CREATE TABLE IF NOT EXISTS "MraEisBusinessTaxpayerIdentity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "localTin" TEXT NOT NULL,
  "mraTin" TEXT NOT NULL,
  "localLegalName" TEXT,
  "mraLegalName" TEXT,
  "status" TEXT NOT NULL,
  "sourceConfigurationSnapshotId" TEXT,
  "differenceSummary" JSONB,
  "verifiedAt" TIMESTAMP(3),
  "verifiedBy" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisBusinessTaxpayerIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisBusinessTaxpayerIdentity_scope_key"
  ON "MraEisBusinessTaxpayerIdentity"("tenantId","businessId","environment");
