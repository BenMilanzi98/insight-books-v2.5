-- Phase 15 — Transmission reconciliation, query attempts, retry authorization, circuit breaker

CREATE TABLE IF NOT EXISTS "MraEisTransmissionReconciliation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "branchId" TEXT,
    "terminalId" TEXT,
    "transmissionId" TEXT NOT NULL,
    "triggeringAttemptId" TEXT NOT NULL,
    "fiscalSnapshotId" TEXT,
    "fiscalNumberAssignmentId" TEXT,
    "fiscalNumber" TEXT,
    "environment" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "previousState" TEXT,
    "reconciliationContractVersion" TEXT,
    "retryPolicyVersion" TEXT,
    "localEvidenceChecksum" TEXT,
    "localEvidenceJson" JSONB,
    "mraEvidenceChecksum" TEXT,
    "mraEvidenceJson" JSONB,
    "matchOutcome" TEXT,
    "matchConfidence" TEXT,
    "dispatchCertainty" TEXT,
    "comparisonSummary" JSONB,
    "retryAuthorizationId" TEXT,
    "manualReviewCaseId" TEXT,
    "currentQueryAttempt" INTEGER NOT NULL DEFAULT 0,
    "nextEligibleActionAt" TIMESTAMP(3),
    "safeStatusSummary" TEXT,
    "correlationId" TEXT,
    "claimOwner" TEXT,
    "claimExpiresAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MraEisTransmissionReconciliation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_tenantId_businessId_transmissionId_triggeringAttemptId_reasonCode_environment_key"
  ON "MraEisTransmissionReconciliation"("tenantId", "businessId", "transmissionId", "triggeringAttemptId", "reasonCode", "environment");
CREATE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_tenantId_businessId_state_idx" ON "MraEisTransmissionReconciliation"("tenantId", "businessId", "state");
CREATE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_transmissionId_idx" ON "MraEisTransmissionReconciliation"("transmissionId");
CREATE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_terminalId_state_idx" ON "MraEisTransmissionReconciliation"("terminalId", "state");
CREATE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_matchOutcome_idx" ON "MraEisTransmissionReconciliation"("matchOutcome");
CREATE INDEX IF NOT EXISTS "MraEisTransmissionReconciliation_nextEligibleActionAt_idx" ON "MraEisTransmissionReconciliation"("nextEligibleActionAt");

CREATE TABLE IF NOT EXISTS "MraEisReconciliationQueryAttempt" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "terminalId" TEXT,
    "environment" TEXT NOT NULL,
    "endpointType" TEXT NOT NULL,
    "endpointContractVersion" TEXT NOT NULL,
    "queryAttemptNumber" INTEGER NOT NULL,
    "requestChecksum" TEXT,
    "requestByteLength" INTEGER,
    "state" TEXT NOT NULL,
    "preparedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchStartedAt" TIMESTAMP(3),
    "responseReceivedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "httpStatus" INTEGER,
    "responseChecksum" TEXT,
    "responseSchemaVersion" TEXT,
    "outcome" TEXT,
    "sanitizedResponse" JSONB,
    "safeErrorCode" TEXT,
    "safeErrorSummary" TEXT,
    "correlationId" TEXT,
    "workerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MraEisReconciliationQueryAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisReconciliationQueryAttempt_reconciliationId_queryAttemptNumber_key"
  ON "MraEisReconciliationQueryAttempt"("reconciliationId", "queryAttemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisReconciliationQueryAttempt_tenantId_businessId_idx" ON "MraEisReconciliationQueryAttempt"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "MraEisReconciliationQueryAttempt_reconciliationId_idx" ON "MraEisReconciliationQueryAttempt"("reconciliationId");

CREATE TABLE IF NOT EXISTS "MraEisRetryAuthorization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "transmissionId" TEXT NOT NULL,
    "triggeringAttemptId" TEXT NOT NULL,
    "proposedAttemptNumber" INTEGER NOT NULL,
    "retryPolicyVersion" TEXT NOT NULL,
    "reconciliationOutcome" TEXT NOT NULL,
    "authorizationState" TEXT NOT NULL,
    "authorizedAt" TIMESTAMP(3),
    "authorizedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "earliestRetryAt" TIMESTAMP(3),
    "sameSnapshotChecksum" TEXT NOT NULL,
    "sameFiscalNumber" TEXT NOT NULL,
    "terminalId" TEXT,
    "environment" TEXT NOT NULL,
    "reason" TEXT,
    "approvalId" TEXT,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MraEisRetryAuthorization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisRetryAuthorization_transmissionId_reconciliationId_proposedAttemptNumber_key"
  ON "MraEisRetryAuthorization"("transmissionId", "reconciliationId", "proposedAttemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisRetryAuthorization_tenantId_businessId_authorizationState_idx" ON "MraEisRetryAuthorization"("tenantId", "businessId", "authorizationState");
CREATE INDEX IF NOT EXISTS "MraEisRetryAuthorization_earliestRetryAt_authorizationState_idx" ON "MraEisRetryAuthorization"("earliestRetryAt", "authorizationState");
CREATE INDEX IF NOT EXISTS "MraEisRetryAuthorization_reconciliationId_idx" ON "MraEisRetryAuthorization"("reconciliationId");

CREATE TABLE IF NOT EXISTS "MraEisCircuitBreaker" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "endpointGroup" TEXT NOT NULL DEFAULT 'SALES',
    "state" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3),
    "halfOpenedAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "nextProbeAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MraEisCircuitBreaker_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MraEisCircuitBreaker_tenantId_businessId_scopeKey_environment_endpointGroup_key"
  ON "MraEisCircuitBreaker"("tenantId", "businessId", "scopeKey", "environment", "endpointGroup");
CREATE INDEX IF NOT EXISTS "MraEisCircuitBreaker_state_nextProbeAt_idx" ON "MraEisCircuitBreaker"("state", "nextProbeAt");

DO $$ BEGIN
  ALTER TABLE "MraEisReconciliationQueryAttempt"
    ADD CONSTRAINT "MraEisReconciliationQueryAttempt_reconciliationId_fkey"
    FOREIGN KEY ("reconciliationId") REFERENCES "MraEisTransmissionReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MraEisRetryAuthorization"
    ADD CONSTRAINT "MraEisRetryAuthorization_reconciliationId_fkey"
    FOREIGN KEY ("reconciliationId") REFERENCES "MraEisTransmissionReconciliation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
