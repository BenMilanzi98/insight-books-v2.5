-- MRA EIS Phase 6 — credential security / envelope encryption foundation
-- Additive. No plaintext credential columns. No Sale/Journal/Stock mutations.

CREATE TABLE IF NOT EXISTS "MraEisEncryptedSecret" (
  "id" TEXT NOT NULL,
  "credentialReferenceId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "credentialType" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "wrappedDataKey" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "authenticationTag" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'AES-256-GCM',
  "algorithmVersion" TEXT NOT NULL DEFAULT 'ENV_ENVELOPE_V1',
  "masterKeyId" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL,
  "authenticatedMetadataHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rotatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "legalHold" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "MraEisEncryptedSecret_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisEncryptedSecret_credentialReferenceId_key" ON "MraEisEncryptedSecret"("credentialReferenceId");
CREATE INDEX IF NOT EXISTS "MraEisEncryptedSecret_scope_idx" ON "MraEisEncryptedSecret"("tenantId","businessId","terminalId");
CREATE INDEX IF NOT EXISTS "MraEisEncryptedSecret_key_idx" ON "MraEisEncryptedSecret"("masterKeyId","keyVersion","status");
CREATE INDEX IF NOT EXISTS "MraEisEncryptedSecret_status_idx" ON "MraEisEncryptedSecret"("status");

CREATE TABLE IF NOT EXISTS "MraEisEphemeralSecret" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT,
  "environment" TEXT NOT NULL,
  "secretType" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "ciphertext" TEXT NOT NULL,
  "wrappedDataKey" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "authenticationTag" TEXT NOT NULL,
  "masterKeyId" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL,
  "metadataHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "destroyedAt" TIMESTAMP(3),
  "oneTime" BOOLEAN NOT NULL DEFAULT true,
  "createdByService" TEXT NOT NULL,
  "requestId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisEphemeralSecret_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisEphemeralSecret_scope_idx" ON "MraEisEphemeralSecret"("tenantId","businessId","secretType","expiresAt");
CREATE INDEX IF NOT EXISTS "MraEisEphemeralSecret_expiry_idx" ON "MraEisEphemeralSecret"("expiresAt","consumedAt");

CREATE TABLE IF NOT EXISTS "MraEisCryptoKeyMeta" (
  "id" TEXT NOT NULL,
  "keyId" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'ENV_ENVELOPE',
  "environment" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "version" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "rotationDueAt" TIMESTAMP(3),
  "retiredAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "MraEisCryptoKeyMeta_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisCryptoKeyMeta_keyId_key" ON "MraEisCryptoKeyMeta"("keyId");
CREATE INDEX IF NOT EXISTS "MraEisCryptoKeyMeta_env_purpose_idx" ON "MraEisCryptoKeyMeta"("environment","purpose","status");

CREATE TABLE IF NOT EXISTS "MraEisKeyRotationBatch" (
  "id" TEXT NOT NULL,
  "fromMasterKeyId" TEXT NOT NULL,
  "toMasterKeyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "cursor" TEXT,
  "processedCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "dryRun" BOOLEAN NOT NULL DEFAULT false,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "safeErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisKeyRotationBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "MraEisKeyRotationBatch_status_idx" ON "MraEisKeyRotationBatch"("status","createdAt");
