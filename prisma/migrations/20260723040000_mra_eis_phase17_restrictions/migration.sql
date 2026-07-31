-- Phase 17 — MRA EIS Restriction / Unblock / Revalidation

CREATE TABLE IF NOT EXISTS "MraEisRestriction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "businessId" TEXT,
    "branchId" TEXT,
    "siteMappingId" TEXT,
    "terminalId" TEXT,
    "trustedAgentId" TEXT,
    "deviceId" TEXT,
    "environment" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceReference" TEXT,
    "reasonCode" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "identityKey" TEXT NOT NULL,
    "evidenceChecksum" TEXT NOT NULL,
    "evidenceJson" JSONB NOT NULL,
    "clearAuthority" TEXT,
    "clearanceEvidenceJson" JSONB,
    "autoExpire" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgementBy" TEXT,
    "clearedAt" TIMESTAMP(3),
    "clearedBy" TEXT,
    "parentRestrictionId" TEXT,
    "correlationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisRestriction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisRestriction_identityKey_state_key"
  ON "MraEisRestriction"("identityKey", "state");
CREATE INDEX IF NOT EXISTS "MraEisRestriction_tenantId_businessId_state_idx"
  ON "MraEisRestriction"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisRestriction_terminalId_environment_state_idx"
  ON "MraEisRestriction"("terminalId", "environment", "state");
CREATE INDEX IF NOT EXISTS "MraEisRestriction_reasonCode_state_idx"
  ON "MraEisRestriction"("reasonCode", "state");
CREATE INDEX IF NOT EXISTS "MraEisRestriction_scopeType_scopeId_environment_idx"
  ON "MraEisRestriction"("scopeType", "scopeId", "environment");
CREATE INDEX IF NOT EXISTS "MraEisRestriction_sourceType_sourceReference_idx"
  ON "MraEisRestriction"("sourceType", "sourceReference");

CREATE TABLE IF NOT EXISTS "MraEisUnblockRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "siteMappingId" TEXT,
    "terminalId" TEXT,
    "trustedAgentId" TEXT,
    "deviceId" TEXT,
    "environment" TEXT NOT NULL,
    "restrictionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "reasonCode" TEXT,
    "requestType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "reason" TEXT,
    "supportingEvidenceJson" JSONB,
    "mraSupportReference" TEXT,
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "approvalId" TEXT,
    "approvedBy" TEXT,
    "submittedExternallyAt" TIMESTAMP(3),
    "externalRequestReference" TEXT,
    "lastStatusQueryAt" TIMESTAMP(3),
    "clearanceEvidenceId" TEXT,
    "completedAt" TIMESTAMP(3),
    "correlationId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisUnblockRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisUnblockRequest_tenantId_businessId_state_idx"
  ON "MraEisUnblockRequest"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisUnblockRequest_restrictionId_state_idx"
  ON "MraEisUnblockRequest"("restrictionId", "state");
CREATE INDEX IF NOT EXISTS "MraEisUnblockRequest_terminalId_environment_idx"
  ON "MraEisUnblockRequest"("terminalId", "environment");

CREATE TABLE IF NOT EXISTS "MraEisUnblockStatusQueryAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "unblockRequestId" TEXT NOT NULL,
    "restrictionId" TEXT,
    "terminalId" TEXT,
    "environment" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "requestChecksum" TEXT,
    "state" TEXT NOT NULL,
    "dispatchStartedAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "responseChecksum" TEXT,
    "applicationStatus" TEXT,
    "normalizedOutcome" TEXT,
    "safeErrorCode" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MraEisUnblockStatusQueryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisUnblockStatusQueryAttempt_unblockRequestId_attemptNumber_key"
  ON "MraEisUnblockStatusQueryAttempt"("unblockRequestId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisUnblockStatusQueryAttempt_tenantId_businessId_idx"
  ON "MraEisUnblockStatusQueryAttempt"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "MraEisUnblockStatusQueryAttempt_unblockRequestId_state_idx"
  ON "MraEisUnblockStatusQueryAttempt"("unblockRequestId", "state");

CREATE TABLE IF NOT EXISTS "MraEisPostUnblockRevalidationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "terminalId" TEXT,
    "environment" TEXT NOT NULL,
    "unblockRequestId" TEXT,
    "restrictionId" TEXT,
    "state" TEXT NOT NULL,
    "checksJson" JSONB,
    "remainingRestrictionCount" INTEGER NOT NULL DEFAULT 0,
    "capabilityStage" TEXT,
    "safeFailureCode" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MraEisPostUnblockRevalidationRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MraEisPostUnblockRevalidationRun_tenantId_businessId_state_idx"
  ON "MraEisPostUnblockRevalidationRun"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisPostUnblockRevalidationRun_unblockRequestId_idx"
  ON "MraEisPostUnblockRevalidationRun"("unblockRequestId");
CREATE INDEX IF NOT EXISTS "MraEisPostUnblockRevalidationRun_terminalId_environment_idx"
  ON "MraEisPostUnblockRevalidationRun"("terminalId", "environment");
