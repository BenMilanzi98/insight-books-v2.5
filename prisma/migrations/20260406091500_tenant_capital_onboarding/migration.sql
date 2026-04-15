-- Capital onboarding + cumulative contributed capital (TenantSettings)
-- Existing tenants: new columns default to completed onboarding + contributed capital 0 so the
-- mandatory owner flow only applies to tenants created after this migration (null timestamps).
ALTER TABLE "TenantSettings" ADD COLUMN "ownerContributedCapital" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "TenantSettings" ADD COLUMN "capitalSetupCompletedAt" TIMESTAMP(3);
ALTER TABLE "TenantSettings" ADD COLUMN "paymentAccountsSetupCompletedAt" TIMESTAMP(3);

UPDATE "TenantSettings"
SET
  "capitalSetupCompletedAt" = COALESCE("capitalSetupCompletedAt", NOW()),
  "paymentAccountsSetupCompletedAt" = COALESCE("paymentAccountsSetupCompletedAt", NOW())
WHERE "capitalSetupCompletedAt" IS NULL OR "paymentAccountsSetupCompletedAt" IS NULL;
