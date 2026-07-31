-- Phase 15 Security Governance (additive)

CREATE TABLE IF NOT EXISTS "SecV2UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2UserSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ApiKey" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "purpose" TEXT,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ServiceAccount" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "scopes" JSONB,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "SecV2ServiceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ApprovalPolicy" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyCode" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "currentVersion" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "SecV2ApprovalPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ApprovalPolicyVersion" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalMode" TEXT NOT NULL DEFAULT 'SEQUENTIAL',
    "minimumApprovers" INTEGER NOT NULL DEFAULT 1,
    "selfApprovalAllowed" BOOLEAN NOT NULL DEFAULT false,
    "mfaRequired" BOOLEAN NOT NULL DEFAULT false,
    "expiryHours" INTEGER NOT NULL DEFAULT 72,
    "thresholdAmountMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "routeSnapshot" JSONB,
    "conditionSet" JSONB,
    "publishedBy" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2ApprovalPolicyVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ApprovalRequest" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "policyId" TEXT,
    "policyVersion" INTEGER NOT NULL DEFAULT 0,
    "sourceModule" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceNumber" TEXT,
    "action" TEXT NOT NULL,
    "amountMinor" BIGINT NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "riskLevel" TEXT NOT NULL DEFAULT 'MODERATE',
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "payloadChecksum" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "correlationId" TEXT,
    "routeSnapshot" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2ApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ApprovalDecision" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "approvalRequestId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "approverId" TEXT NOT NULL,
    "effectiveApproverId" TEXT,
    "delegatedFromId" TEXT,
    "decision" TEXT NOT NULL,
    "reason" TEXT,
    "sourceChecksum" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "decisionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "SecV2ApprovalDecision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2SodRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "conflictWhen" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "riskLevel" TEXT NOT NULL DEFAULT 'HIGH',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "SecV2SodRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2AuditEvent" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "actorType" TEXT,
    "actorId" TEXT,
    "effectiveActorId" TEXT,
    "impersonatorId" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "sourceModule" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "action" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "reason" TEXT,
    "previousValueReference" JSONB,
    "newValueReference" JSONB,
    "changedFields" JSONB,
    "approvalReference" TEXT,
    "permissionDecision" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "integrityHash" TEXT NOT NULL,
    "previousHash" TEXT,
    "metadata" JSONB,
    CONSTRAINT "SecV2AuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2AuditIntegrityRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "checkedCount" INTEGER NOT NULL,
    "valid" BOOLEAN NOT NULL,
    "failures" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2AuditIntegrityRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2SecurityAlert" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "eventType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "actorId" TEXT,
    "source" TEXT,
    "description" TEXT NOT NULL,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "assignedTo" TEXT,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "relatedAuditEventId" TEXT,
    "metadata" JSONB,
    CONSTRAINT "SecV2SecurityAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2SecurityIncident" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "description" TEXT,
    "createdBy" TEXT,
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "SecV2SecurityIncident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2AccessDelegation" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "delegatorId" TEXT NOT NULL,
    "delegateId" TEXT NOT NULL,
    "scopes" JSONB,
    "permissions" JSONB,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3) NOT NULL,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "SecV2AccessDelegation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ImpersonationSession" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "impersonatorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "SecV2ImpersonationSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2EmergencyAccess" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "incidentRef" TEXT,
    "scope" JSONB,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "approvedBy" TEXT,
    "startedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "SecV2EmergencyAccess_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2ExportRecord" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "filters" JSONB,
    "rowCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "classification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "downloadedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "SecV2ExportRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2MfaCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "method" TEXT NOT NULL DEFAULT 'TOTP',
    "secretEnc" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2MfaCredential_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecV2RecoveryCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecV2RecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SecV2ApiKey_keyHash_key" ON "SecV2ApiKey"("keyHash");
CREATE UNIQUE INDEX IF NOT EXISTS "SecV2ApprovalPolicy_businessId_policyCode_key" ON "SecV2ApprovalPolicy"("businessId", "policyCode");
CREATE UNIQUE INDEX IF NOT EXISTS "SecV2ApprovalPolicyVersion_policyId_version_key" ON "SecV2ApprovalPolicyVersion"("policyId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "SecV2SodRule_businessId_code_key" ON "SecV2SodRule"("businessId", "code");

CREATE INDEX IF NOT EXISTS "SecV2UserSession_userId_status_idx" ON "SecV2UserSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "SecV2UserSession_businessId_status_idx" ON "SecV2UserSession"("businessId", "status");
CREATE INDEX IF NOT EXISTS "SecV2AuditEvent_businessId_recordedAt_idx" ON "SecV2AuditEvent"("businessId", "recordedAt");
CREATE INDEX IF NOT EXISTS "SecV2AuditEvent_correlationId_idx" ON "SecV2AuditEvent"("correlationId");
CREATE INDEX IF NOT EXISTS "SecV2ApprovalRequest_businessId_status_idx" ON "SecV2ApprovalRequest"("businessId", "status");
CREATE INDEX IF NOT EXISTS "SecV2SecurityAlert_businessId_status_severity_idx" ON "SecV2SecurityAlert"("businessId", "status", "severity");

DO $$ BEGIN
  ALTER TABLE "SecV2ApprovalPolicyVersion" ADD CONSTRAINT "SecV2ApprovalPolicyVersion_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "SecV2ApprovalPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SecV2ApprovalRequest" ADD CONSTRAINT "SecV2ApprovalRequest_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "SecV2ApprovalPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SecV2ApprovalDecision" ADD CONSTRAINT "SecV2ApprovalDecision_approvalRequestId_fkey"
    FOREIGN KEY ("approvalRequestId") REFERENCES "SecV2ApprovalRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
