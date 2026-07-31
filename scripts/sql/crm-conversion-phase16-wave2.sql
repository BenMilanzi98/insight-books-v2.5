-- Phase 16 Wave 2 — Customer match decisions, conversion resources, invitations (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Wave 2: match/create-link Customer + Tenant/Business/Branch + hash-only invitations.
-- No Subscription / Invoice / activation. No Tenant GL journals from conversion.

CREATE TABLE IF NOT EXISTS "PlatformCustomer" (
  "id" TEXT PRIMARY KEY,
  "displayName" TEXT NOT NULL,
  "registrationNumber" TEXT,
  "taxId" TEXT,
  "domain" TEXT,
  "email" TEXT,
  "accountId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PROVISIONING',
  "externalKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "PlatformCustomer_registrationNumber_idx" ON "PlatformCustomer"("registrationNumber");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_taxId_idx" ON "PlatformCustomer"("taxId");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_domain_idx" ON "PlatformCustomer"("domain");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_status_idx" ON "PlatformCustomer"("status");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_accountId_idx" ON "PlatformCustomer"("accountId");
CREATE INDEX IF NOT EXISTS "PlatformCustomer_displayName_idx" ON "PlatformCustomer"("displayName");

CREATE TABLE IF NOT EXISTS "CrmConversionMatchDecision" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "decisionType" TEXT NOT NULL,
  "matchState" TEXT,
  "decision" TEXT,
  "actionRequested" TEXT,
  "ok" BOOLEAN NOT NULL DEFAULT FALSE,
  "errorCode" TEXT,
  "candidateJson" JSONB,
  "actorAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionMatchDecision_conversion_type_idx"
  ON "CrmConversionMatchDecision"("conversionId", "decisionType");
CREATE INDEX IF NOT EXISTS "CrmConversionMatchDecision_matchState_idx"
  ON "CrmConversionMatchDecision"("matchState");
CREATE INDEX IF NOT EXISTS "CrmConversionMatchDecision_actor_idx"
  ON "CrmConversionMatchDecision"("actorAdminId");

CREATE TABLE IF NOT EXISTS "CrmConversionResource" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "resourceType" TEXT NOT NULL,
  "resourceId" TEXT NOT NULL,
  "action" TEXT,
  "status" TEXT,
  "idempotencyKey" TEXT,
  "metaJson" JSONB,
  "actorAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionResource_conversion_type_idem_key"
  ON "CrmConversionResource"("conversionId", "resourceType", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionResource_conversion_type_idx"
  ON "CrmConversionResource"("conversionId", "resourceType");
CREATE INDEX IF NOT EXISTS "CrmConversionResource_resourceId_idx"
  ON "CrmConversionResource"("resourceId");
CREATE INDEX IF NOT EXISTS "CrmConversionResource_idempotencyKey_idx"
  ON "CrmConversionResource"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "CrmConversionInvitation" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT,
  "tenantId" TEXT NOT NULL,
  "contactId" TEXT,
  "email" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionInvitation_conversion_idem_key"
  ON "CrmConversionInvitation"("conversionId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionInvitation_tenant_status_idx"
  ON "CrmConversionInvitation"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CrmConversionInvitation_email_idx"
  ON "CrmConversionInvitation"("email");
CREATE INDEX IF NOT EXISTS "CrmConversionInvitation_tokenHash_idx"
  ON "CrmConversionInvitation"("tokenHash");
CREATE INDEX IF NOT EXISTS "CrmConversionInvitation_idempotencyKey_idx"
  ON "CrmConversionInvitation"("idempotencyKey");

