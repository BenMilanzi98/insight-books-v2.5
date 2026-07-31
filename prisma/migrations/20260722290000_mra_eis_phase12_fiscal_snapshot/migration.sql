-- Phase 12: immutable fiscal snapshot extensions + scope-based sequences

ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "bridgeRecordId" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "eligibilityDecisionId" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "sourceFinalizationIdentity" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "sourceChecksum" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "schemaVersion" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "canonicalizationVersion" TEXT;
ALTER TABLE "MraEisSnapshot" ADD COLUMN IF NOT EXISTS "checksumAlgorithmVersion" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisSnapshot_bridgeRecordId_key"
  ON "MraEisSnapshot"("bridgeRecordId");
CREATE INDEX IF NOT EXISTS "MraEisSnapshot_status_createdAt_idx"
  ON "MraEisSnapshot"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "MraEisFiscalSequenceScope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "terminalId" TEXT,
    "mraSiteId" TEXT,
    "sourceType" TEXT,
    "onlineOrOfflineMode" TEXT NOT NULL DEFAULT 'ONLINE',
    "periodKey" TEXT,
    "prefix" TEXT,
    "suffix" TEXT,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "lastReservedValue" INTEGER,
    "lastAssignedValue" INTEGER,
    "increment" INTEGER NOT NULL DEFAULT 1,
    "resetPolicy" TEXT NOT NULL DEFAULT 'PER_BUSINESS_DAY',
    "contractVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "initializationEvidence" JSONB,
    "initializedAt" TIMESTAMP(3),
    "lastReconciledAt" TIMESTAMP(3),
    "lastMraConfirmedValue" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisFiscalSequenceScope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalSequenceScope_scope_key"
  ON "MraEisFiscalSequenceScope"("tenantId", "businessId", "environment", "scopeKey");
CREATE INDEX IF NOT EXISTS "MraEisFiscalSequenceScope_tenant_status_idx"
  ON "MraEisFiscalSequenceScope"("tenantId", "businessId", "status");

CREATE TABLE IF NOT EXISTS "MraEisFiscalNumberReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "sequenceScopeId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "fiscalSnapshotId" TEXT NOT NULL,
    "reservationValue" INTEGER NOT NULL,
    "formattedFiscalNumber" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sequenceVersionBefore" INTEGER NOT NULL,
    "sequenceVersionAfter" INTEGER NOT NULL,
    "allocationId" TEXT,
    "reservedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdBy" TEXT,
    "isSynthetic" BOOLEAN NOT NULL DEFAULT true,
    "isMraFiscalNumber" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisFiscalNumberReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalNumberReservation_idempotencyKey_key"
  ON "MraEisFiscalNumberReservation"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalNumberReservation_seq_value_key"
  ON "MraEisFiscalNumberReservation"("sequenceScopeId", "reservationValue");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalNumberReservation_formatted_key"
  ON "MraEisFiscalNumberReservation"("formattedFiscalNumber");
CREATE INDEX IF NOT EXISTS "MraEisFiscalNumberReservation_snapshot_idx"
  ON "MraEisFiscalNumberReservation"("tenantId", "businessId", "fiscalSnapshotId");

DO $$ BEGIN
  ALTER TABLE "MraEisFiscalNumberReservation"
    ADD CONSTRAINT "MraEisFiscalNumberReservation_sequenceScopeId_fkey"
    FOREIGN KEY ("sequenceScopeId") REFERENCES "MraEisFiscalSequenceScope"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
