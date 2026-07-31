-- Phase 16 Wave 3 — Billing Account/Schedule + Activation attempts (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Wave 3: Subscription/entitlements via existing AccountSubscription + PlatformFeatureEntitlement;
-- Platform Invoice/Payment reuse existing tables; Billing Account/Schedule + activation attempts new.
-- Invoice from accepted snapshot only. Payment initiation ≠ PAID. Closed Won ≠ ACTIVE.
-- No Tenant GL journals from conversion.

CREATE TABLE IF NOT EXISTS "PlatformBillingAccount" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "customerId" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'MWK',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "action" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "metaJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformBillingAccount_idempotencyKey_key"
  ON "PlatformBillingAccount"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_tenantId_idx"
  ON "PlatformBillingAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_customerId_idx"
  ON "PlatformBillingAccount"("customerId");
CREATE INDEX IF NOT EXISTS "PlatformBillingAccount_status_idx"
  ON "PlatformBillingAccount"("status");

CREATE TABLE IF NOT EXISTS "PlatformBillingSchedule" (
  "id" TEXT PRIMARY KEY,
  "billingAccountId" TEXT NOT NULL,
  "subscriptionId" TEXT,
  "cycle" TEXT NOT NULL DEFAULT 'month',
  "periodStart" TIMESTAMP(3),
  "periodEnd" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "idempotencyKey" TEXT NOT NULL,
  "metaJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformBillingSchedule_idempotencyKey_key"
  ON "PlatformBillingSchedule"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_billingAccountId_idx"
  ON "PlatformBillingSchedule"("billingAccountId");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_subscriptionId_idx"
  ON "PlatformBillingSchedule"("subscriptionId");
CREATE INDEX IF NOT EXISTS "PlatformBillingSchedule_status_idx"
  ON "PlatformBillingSchedule"("status");

CREATE TABLE IF NOT EXISTS "CrmConversionActivationAttempt" (
  "id" TEXT PRIMARY KEY,
  "subscriptionId" TEXT NOT NULL,
  "policy" TEXT NOT NULL,
  "activationPolicyVersionId" TEXT,
  "ok" BOOLEAN NOT NULL DEFAULT FALSE,
  "activated" BOOLEAN NOT NULL DEFAULT FALSE,
  "status" TEXT,
  "errorCode" TEXT,
  "evidenceJson" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "actorAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionActivationAttempt_subscription_idem_key"
  ON "CrmConversionActivationAttempt"("subscriptionId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionActivationAttempt_subscriptionId_idx"
  ON "CrmConversionActivationAttempt"("subscriptionId");
CREATE INDEX IF NOT EXISTS "CrmConversionActivationAttempt_policy_idx"
  ON "CrmConversionActivationAttempt"("policy");
CREATE INDEX IF NOT EXISTS "CrmConversionActivationAttempt_activated_idx"
  ON "CrmConversionActivationAttempt"("activated");
