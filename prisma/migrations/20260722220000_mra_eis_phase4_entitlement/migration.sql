-- MRA EIS Phase 4 — platform entitlement & operational control plane
-- Additive only. Does not alter Sales, Journals, or Inventory.

CREATE TABLE IF NOT EXISTS "MraEisPlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "status" TEXT NOT NULL DEFAULT 'DISABLED',
    "sandboxGloballyAllowed" BOOLEAN NOT NULL DEFAULT true,
    "productionGloballyAllowed" BOOLEAN NOT NULL DEFAULT false,
    "newEntitlementsAllowed" BOOLEAN NOT NULL DEFAULT true,
    "maintenanceMessage" TEXT,
    "statusReason" TEXT,
    "statusChangedBy" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisPlatformSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MraEisTenantEntitlement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "allowedEnvironment" TEXT NOT NULL,
    "sandboxAllowed" BOOLEAN NOT NULL DEFAULT true,
    "productionAllowed" BOOLEAN NOT NULL DEFAULT false,
    "entitlementSource" TEXT NOT NULL,
    "entitlementReason" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "certificationRequirement" BOOLEAN NOT NULL DEFAULT true,
    "productionApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "approvalReference" TEXT,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3),
    "suspendedBy" TEXT,
    "suspendedAt" TIMESTAMP(3),
    "suspensionReason" TEXT,
    "revokedBy" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revocationReason" TEXT,
    "priorStatus" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisTenantEntitlement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisTenantEntitlement_tenantId_isCurrent_idx"
  ON "MraEisTenantEntitlement"("tenantId", "isCurrent");
CREATE INDEX IF NOT EXISTS "MraEisTenantEntitlement_status_idx"
  ON "MraEisTenantEntitlement"("status");
CREATE INDEX IF NOT EXISTS "MraEisTenantEntitlement_effectiveUntil_idx"
  ON "MraEisTenantEntitlement"("effectiveUntil");
CREATE INDEX IF NOT EXISTS "MraEisTenantEntitlement_tenantId_version_idx"
  ON "MraEisTenantEntitlement"("tenantId", "version");

-- At most one current entitlement per tenant
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTenantEntitlement_one_current_per_tenant"
  ON "MraEisTenantEntitlement"("tenantId")
  WHERE "isCurrent" = true;

CREATE TABLE IF NOT EXISTS "MraEisTenantParticipation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "optedInBy" TEXT,
    "optedInAt" TIMESTAMP(3),
    "pausedBy" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "pauseMode" TEXT,
    "optedOutBy" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "optOutReason" TEXT,
    "disableMode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisTenantParticipation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTenantParticipation_tenantId_key"
  ON "MraEisTenantParticipation"("tenantId");
CREATE INDEX IF NOT EXISTS "MraEisTenantParticipation_status_idx"
  ON "MraEisTenantParticipation"("status");

CREATE TABLE IF NOT EXISTS "MraEisBusinessSetting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNAVAILABLE',
    "selectedEnvironment" TEXT NOT NULL DEFAULT 'SANDBOX',
    "setupStatus" TEXT NOT NULL DEFAULT 'SETUP_REQUIRED',
    "preferredOperationMode" TEXT NOT NULL DEFAULT 'ONLINE_ONLY',
    "receiptPolicy" TEXT NOT NULL DEFAULT 'ISSUE_PENDING_RECEIPT',
    "autoRetryPreference" BOOLEAN NOT NULL DEFAULT true,
    "defaultTerminalId" TEXT,
    "enabledBy" TEXT,
    "enabledAt" TIMESTAMP(3),
    "pausedBy" TEXT,
    "pausedAt" TIMESTAMP(3),
    "pauseReason" TEXT,
    "disabledBy" TEXT,
    "disabledAt" TIMESTAMP(3),
    "disableReason" TEXT,
    "disableMode" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisBusinessSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisBusinessSetting_businessId_key"
  ON "MraEisBusinessSetting"("businessId");
CREATE INDEX IF NOT EXISTS "MraEisBusinessSetting_tenantId_status_idx"
  ON "MraEisBusinessSetting"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "MraEisBusinessSetting_tenantId_businessId_idx"
  ON "MraEisBusinessSetting"("tenantId", "businessId");

CREATE TABLE IF NOT EXISTS "MraEisCertificationRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT,
    "productId" TEXT,
    "productVersion" TEXT,
    "certificationType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "certificateReference" TEXT,
    "evidenceDocumentReference" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "recordedBy" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisCertificationRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisCertificationRecord_tenant_type_current_idx"
  ON "MraEisCertificationRecord"("tenantId", "certificationType", "isCurrent");
CREATE INDEX IF NOT EXISTS "MraEisCertificationRecord_status_idx"
  ON "MraEisCertificationRecord"("status");
CREATE INDEX IF NOT EXISTS "MraEisCertificationRecord_effectiveUntil_idx"
  ON "MraEisCertificationRecord"("effectiveUntil");

CREATE TABLE IF NOT EXISTS "MraEisControlAuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessId" TEXT,
    "actorId" TEXT,
    "effectiveActorId" TEXT,
    "actorType" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT,
    "reason" TEXT,
    "environment" TEXT,
    "approvalReference" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "safeErrorCode" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisControlAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisControlAuditEvent_tenantId_createdAt_idx"
  ON "MraEisControlAuditEvent"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "MraEisControlAuditEvent_action_createdAt_idx"
  ON "MraEisControlAuditEvent"("action", "createdAt");
CREATE INDEX IF NOT EXISTS "MraEisControlAuditEvent_resource_idx"
  ON "MraEisControlAuditEvent"("resourceType", "resourceId");

CREATE TABLE IF NOT EXISTS "MraEisControlIdempotency" (
    "id" TEXT NOT NULL,
    "identity" TEXT NOT NULL,
    "actionKey" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessId" TEXT,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "MraEisControlIdempotency_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisControlIdempotency_identity_key"
  ON "MraEisControlIdempotency"("identity");
CREATE INDEX IF NOT EXISTS "MraEisControlIdempotency_tenantId_actionKey_idx"
  ON "MraEisControlIdempotency"("tenantId", "actionKey");
CREATE INDEX IF NOT EXISTS "MraEisControlIdempotency_createdAt_idx"
  ON "MraEisControlIdempotency"("createdAt");

-- Safe default platform row (disabled)
INSERT INTO "MraEisPlatformSetting" ("id", "status", "version", "createdAt", "updatedAt")
VALUES ('global', 'DISABLED', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
