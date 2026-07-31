-- Phase 16 — Trusted agents and offline fiscal envelopes

CREATE TABLE IF NOT EXISTS "MraEisTrustedAgent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "siteMappingId" TEXT,
    "terminalId" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "agentInstanceId" TEXT NOT NULL,
    "stableDeviceIdentity" TEXT NOT NULL,
    "deviceIdentityVersion" TEXT NOT NULL DEFAULT 'device-id-v1',
    "agentVersion" TEXT NOT NULL,
    "architecture" TEXT NOT NULL,
    "operatingSystem" TEXT,
    "installationId" TEXT,
    "certificateReference" TEXT,
    "signingKeyReference" TEXT,
    "encryptionKeyReference" TEXT,
    "trustState" TEXT NOT NULL,
    "lifecycleState" TEXT NOT NULL,
    "versionPolicyState" TEXT NOT NULL DEFAULT 'SUPPORTED',
    "bootstrapTokenHash" TEXT,
    "bootstrapExpiresAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "lastHeartbeatSafeJson" JSONB,
    "lastSuccessfulSyncAt" TIMESTAMP(3),
    "currentConfigurationPackageId" TEXT,
    "currentLimitPackageId" TEXT,
    "sequenceScopeKey" TEXT,
    "certificationRecordId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MraEisTrustedAgent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTrustedAgent_tenantId_businessId_agentInstanceId_key"
  ON "MraEisTrustedAgent"("tenantId", "businessId", "agentInstanceId");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTrustedAgent_tenantId_businessId_stableDeviceIdentity_environment_key"
  ON "MraEisTrustedAgent"("tenantId", "businessId", "stableDeviceIdentity", "environment");
CREATE INDEX IF NOT EXISTS "MraEisTrustedAgent_tenantId_businessId_lifecycleState_idx"
  ON "MraEisTrustedAgent"("tenantId", "businessId", "lifecycleState");
CREATE INDEX IF NOT EXISTS "MraEisTrustedAgent_terminalId_environment_idx"
  ON "MraEisTrustedAgent"("terminalId", "environment");
CREATE INDEX IF NOT EXISTS "MraEisTrustedAgent_trustState_idx"
  ON "MraEisTrustedAgent"("trustState");

CREATE TABLE IF NOT EXISTS "MraEisOfflineFiscalEnvelope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "deviceIdentity" TEXT,
    "environment" TEXT NOT NULL,
    "fiscalSnapshotId" TEXT NOT NULL,
    "fiscalNumberAssignmentId" TEXT,
    "offlineFiscalNumber" TEXT NOT NULL,
    "transactionTimestamp" TIMESTAMP(3) NOT NULL,
    "configurationPackageId" TEXT,
    "mappingPackageId" TEXT,
    "limitPackageId" TEXT,
    "payloadSchemaVersion" TEXT NOT NULL,
    "canonicalizationVersion" TEXT NOT NULL,
    "signatureContractVersion" TEXT NOT NULL,
    "canonicalPayloadChecksum" TEXT NOT NULL,
    "signedBytesChecksum" TEXT NOT NULL,
    "offlineSignature" TEXT NOT NULL,
    "signatureEncoding" TEXT NOT NULL,
    "keyReference" TEXT NOT NULL,
    "keyVersion" TEXT,
    "signatureVerified" BOOLEAN NOT NULL DEFAULT false,
    "connectivityEvidenceId" TEXT,
    "clockEvidenceId" TEXT,
    "state" TEXT NOT NULL,
    "sealedAt" TIMESTAMP(3),
    "receiptStatus" TEXT,
    "claimsMraAcceptance" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MraEisOfflineFiscalEnvelope_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisOfflineFiscalEnvelope_tenantId_businessId_fiscalSnapshotId_offlineFiscalNumber_agentId_environment_key"
  ON "MraEisOfflineFiscalEnvelope"("tenantId", "businessId", "fiscalSnapshotId", "offlineFiscalNumber", "agentId", "environment");
CREATE INDEX IF NOT EXISTS "MraEisOfflineFiscalEnvelope_tenantId_businessId_state_idx"
  ON "MraEisOfflineFiscalEnvelope"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisOfflineFiscalEnvelope_terminalId_environment_idx"
  ON "MraEisOfflineFiscalEnvelope"("terminalId", "environment");
CREATE INDEX IF NOT EXISTS "MraEisOfflineFiscalEnvelope_agentId_state_idx"
  ON "MraEisOfflineFiscalEnvelope"("agentId", "state");
CREATE INDEX IF NOT EXISTS "MraEisOfflineFiscalEnvelope_offlineFiscalNumber_idx"
  ON "MraEisOfflineFiscalEnvelope"("offlineFiscalNumber");
