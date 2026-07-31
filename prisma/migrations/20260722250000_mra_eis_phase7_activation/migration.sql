-- MRA EIS Phase 7 — terminal activation / onboarding foundation
-- Additive. No Sale/Journal/Stock mutations. No plaintext TAC/JWT columns.

CREATE TABLE IF NOT EXISTS "MraEisCertifiedProduct" (
  "id" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "productVersion" TEXT NOT NULL,
  "certificationRecordId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "approvedBy" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "sourceEvidenceReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisCertifiedProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisCertifiedProduct_env_pid_ver_key"
  ON "MraEisCertifiedProduct"("environment","productId","productVersion");
CREATE INDEX IF NOT EXISTS "MraEisCertifiedProduct_env_status_idx"
  ON "MraEisCertifiedProduct"("environment","status");

CREATE TABLE IF NOT EXISTS "MraEisPlatformIdentity" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "identityKey" TEXT NOT NULL,
  "identityValue" TEXT NOT NULL,
  "version" TEXT NOT NULL DEFAULT 'v1',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisPlatformIdentity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisPlatformIdentity_scope_key"
  ON "MraEisPlatformIdentity"("tenantId","businessId","environment","identityKey");
CREATE INDEX IF NOT EXISTS "MraEisPlatformIdentity_scope_status_idx"
  ON "MraEisPlatformIdentity"("tenantId","businessId","environment","status");

CREATE TABLE IF NOT EXISTS "MraEisActivationAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "environment" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'MOCK',
  "attemptNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "activationRequestChecksum" TEXT,
  "endpointKey" TEXT NOT NULL DEFAULT 'EP-ONB-01',
  "requestContractVersion" TEXT NOT NULL DEFAULT '1',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "httpStatus" INTEGER,
  "mraApplicationStatus" TEXT,
  "responseChecksum" TEXT,
  "outcome" TEXT,
  "retryClassification" TEXT,
  "safeErrorCode" TEXT,
  "safeErrorSummary" TEXT,
  "unknownOutcomeAt" TIMESTAMP(3),
  "tacEphemeralSecretId" TEXT,
  "sanitizedResponse" JSONB,
  "requestId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisActivationAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisActivationAttempt_idempotencyKey_key"
  ON "MraEisActivationAttempt"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisActivationAttempt_terminal_attempt_key"
  ON "MraEisActivationAttempt"("terminalId","attemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisActivationAttempt_scope_status_idx"
  ON "MraEisActivationAttempt"("tenantId","businessId","terminalId","status");

CREATE TABLE IF NOT EXISTS "MraEisConfirmationAttempt" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "terminalId" TEXT NOT NULL,
  "activationAttemptId" TEXT,
  "confirmationAttemptNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "requestChecksum" TEXT,
  "signerVersion" TEXT,
  "endpointKey" TEXT NOT NULL DEFAULT 'EP-ONB-02',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "httpStatus" INTEGER,
  "mraApplicationStatus" TEXT,
  "outcome" TEXT,
  "responseChecksum" TEXT,
  "retryClassification" TEXT,
  "safeErrorCode" TEXT,
  "unknownOutcomeAt" TIMESTAMP(3),
  "sanitizedResponse" JSONB,
  "requestId" TEXT,
  "correlationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MraEisConfirmationAttempt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "MraEisConfirmationAttempt_terminal_attempt_key"
  ON "MraEisConfirmationAttempt"("terminalId","confirmationAttemptNumber");
CREATE INDEX IF NOT EXISTS "MraEisConfirmationAttempt_scope_status_idx"
  ON "MraEisConfirmationAttempt"("tenantId","businessId","terminalId","status");

-- Replacement linkage on terminals
ALTER TABLE "MraEisTerminal" ADD COLUMN IF NOT EXISTS "replacedTerminalId" TEXT;
ALTER TABLE "MraEisTerminal" ADD COLUMN IF NOT EXISTS "replacementReason" TEXT;
ALTER TABLE "MraEisTerminal" ADD COLUMN IF NOT EXISTS "replacementOfTerminalId" TEXT;
CREATE INDEX IF NOT EXISTS "MraEisTerminal_replacedTerminalId_idx" ON "MraEisTerminal"("replacedTerminalId");
