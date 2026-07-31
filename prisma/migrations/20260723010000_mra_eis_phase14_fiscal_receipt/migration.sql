-- Phase 14 — Fiscal Receipt, QR Evidence, Artifacts, Render Attempts

CREATE TABLE IF NOT EXISTS "MraEisFiscalReceipt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT,
    "transmissionId" TEXT NOT NULL,
    "acceptedAttemptId" TEXT NOT NULL,
    "responseEvidenceId" TEXT NOT NULL,
    "fiscalSnapshotId" TEXT NOT NULL,
    "fiscalNumberAssignmentId" TEXT,
    "environment" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "localTransactionNumber" TEXT,
    "fiscalNumber" TEXT NOT NULL,
    "mraTransactionId" TEXT NOT NULL,
    "mraFiscalReference" TEXT,
    "receiptReference" TEXT,
    "validationUrl" TEXT,
    "state" TEXT NOT NULL,
    "previousState" TEXT,
    "receiptContractVersion" TEXT NOT NULL,
    "qrSourceContractVersion" TEXT NOT NULL,
    "receiptDataSchemaVersion" TEXT NOT NULL DEFAULT '1',
    "originalReceiptVersion" TEXT NOT NULL DEFAULT '1',
    "receiptClassification" TEXT,
    "receiptDataChecksum" TEXT,
    "receiptDataJson" JSONB,
    "originalArtifactId" TEXT,
    "originalGeneratedAt" TIMESTAMP(3),
    "latestReprintSequence" INTEGER NOT NULL DEFAULT 0,
    "safeStatusSummary" TEXT,
    "correlationId" TEXT,
    "claimOwner" TEXT,
    "claimExpiresAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retentionUntil" TIMESTAMP(3),
    "legalHold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "MraEisFiscalReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalReceipt_tenantId_businessId_transmissionId_receiptContractVersion_environment_key"
  ON "MraEisFiscalReceipt"("tenantId", "businessId", "transmissionId", "receiptContractVersion", "environment");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_tenantId_businessId_state_idx" ON "MraEisFiscalReceipt"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_transmissionId_idx" ON "MraEisFiscalReceipt"("transmissionId");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_fiscalSnapshotId_idx" ON "MraEisFiscalReceipt"("fiscalSnapshotId");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_responseEvidenceId_idx" ON "MraEisFiscalReceipt"("responseEvidenceId");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_fiscalNumber_idx" ON "MraEisFiscalReceipt"("fiscalNumber");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceipt_mraTransactionId_idx" ON "MraEisFiscalReceipt"("mraTransactionId");

CREATE TABLE IF NOT EXISTS "MraEisQrEvidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fiscalReceiptId" TEXT NOT NULL,
    "responseEvidenceId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "qrSourceContractVersion" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "exactSourceChecksum" TEXT NOT NULL,
    "normalizedSourceChecksum" TEXT,
    "sourceLength" INTEGER NOT NULL,
    "sourceField" TEXT NOT NULL,
    "exactSourceValue" TEXT,
    "validationUrl" TEXT,
    "generatorVersion" TEXT NOT NULL,
    "outputFormat" TEXT NOT NULL,
    "dimensions" JSONB,
    "moduleCount" INTEGER,
    "errorCorrectionLevel" TEXT NOT NULL,
    "quietZone" INTEGER NOT NULL,
    "artifactStorageReference" TEXT,
    "artifactChecksumAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "artifactChecksum" TEXT NOT NULL,
    "decodeVerified" BOOLEAN NOT NULL DEFAULT false,
    "decodedValueChecksum" TEXT,
    "verificationVersion" TEXT NOT NULL DEFAULT '1',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "immutable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MraEisQrEvidence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisQrEvidence_fiscalReceiptId_qrSourceContractVersion_exactSourceChecksum_generatorVersion_key"
  ON "MraEisQrEvidence"("fiscalReceiptId", "qrSourceContractVersion", "exactSourceChecksum", "generatorVersion");
CREATE INDEX IF NOT EXISTS "MraEisQrEvidence_tenantId_businessId_idx" ON "MraEisQrEvidence"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "MraEisQrEvidence_responseEvidenceId_idx" ON "MraEisQrEvidence"("responseEvidenceId");

CREATE TABLE IF NOT EXISTS "MraEisFiscalReceiptArtifact" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fiscalReceiptId" TEXT NOT NULL,
    "artifactType" TEXT NOT NULL,
    "originalOrReprint" TEXT NOT NULL,
    "reprintSequence" INTEGER,
    "reprintReasonCode" TEXT,
    "reprintReasonText" TEXT,
    "receiptContractVersion" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "qrEvidenceId" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteLength" INTEGER NOT NULL,
    "pageCount" INTEGER,
    "paperWidthMm" INTEGER,
    "artifactChecksumAlgorithm" TEXT NOT NULL DEFAULT 'sha256',
    "artifactChecksum" TEXT NOT NULL,
    "receiptDataChecksum" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "reason" TEXT,
    "immutable" BOOLEAN NOT NULL DEFAULT true,
    "retentionClass" TEXT NOT NULL DEFAULT 'FISCAL_ORIGINAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MraEisFiscalReceiptArtifact_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalReceiptArtifact_fiscalReceiptId_artifactType_originalOrReprint_reprintSequence_key"
  ON "MraEisFiscalReceiptArtifact"("fiscalReceiptId", "artifactType", "originalOrReprint", "reprintSequence");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisFiscalReceiptArtifact_tenantId_storageKey_key"
  ON "MraEisFiscalReceiptArtifact"("tenantId", "storageKey");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceiptArtifact_tenantId_businessId_idx" ON "MraEisFiscalReceiptArtifact"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceiptArtifact_fiscalReceiptId_originalOrReprint_idx" ON "MraEisFiscalReceiptArtifact"("fiscalReceiptId", "originalOrReprint");
CREATE INDEX IF NOT EXISTS "MraEisFiscalReceiptArtifact_artifactChecksum_idx" ON "MraEisFiscalReceiptArtifact"("artifactChecksum");

CREATE TABLE IF NOT EXISTS "MraEisReceiptRenderAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "fiscalReceiptId" TEXT NOT NULL,
    "receiptType" TEXT NOT NULL,
    "originalOrReprint" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "rendererVersion" TEXT NOT NULL,
    "receiptDataChecksum" TEXT,
    "qrEvidenceId" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "artifactId" TEXT,
    "safeErrorCode" TEXT,
    "safeErrorSummary" TEXT,
    "workerId" TEXT,
    "claimOwner" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MraEisReceiptRenderAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisReceiptRenderAttempt_fiscalReceiptId_receiptType_originalOrReprint_attemptNumber_key"
  ON "MraEisReceiptRenderAttempt"("fiscalReceiptId", "receiptType", "originalOrReprint", "attemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisReceiptRenderAttempt_tenantId_businessId_status_idx" ON "MraEisReceiptRenderAttempt"("tenantId", "businessId", "status");
CREATE INDEX IF NOT EXISTS "MraEisReceiptRenderAttempt_fiscalReceiptId_idx" ON "MraEisReceiptRenderAttempt"("fiscalReceiptId");

DO $$ BEGIN
  ALTER TABLE "MraEisQrEvidence"
    ADD CONSTRAINT "MraEisQrEvidence_fiscalReceiptId_fkey"
    FOREIGN KEY ("fiscalReceiptId") REFERENCES "MraEisFiscalReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MraEisFiscalReceiptArtifact"
    ADD CONSTRAINT "MraEisFiscalReceiptArtifact_fiscalReceiptId_fkey"
    FOREIGN KEY ("fiscalReceiptId") REFERENCES "MraEisFiscalReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MraEisReceiptRenderAttempt"
    ADD CONSTRAINT "MraEisReceiptRenderAttempt_fiscalReceiptId_fkey"
    FOREIGN KEY ("fiscalReceiptId") REFERENCES "MraEisFiscalReceipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
