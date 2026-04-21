-- Optional setup wizard + fiscal year anchor on TenantSettings

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "fiscalYearStartMonth" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "openingBalancesAsOfDate" TIMESTAMP(3);
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "setupReminderSnoozedUntil" TIMESTAMP(3);
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "setupWizardState" JSONB;

-- Legacy tenants: treat all wizard steps as completed so dashboard is not noisy.
UPDATE "TenantSettings"
SET "setupWizardState" = '{"completed":{"openingBalances":"legacy","fiscalYear":"legacy","paymentAccounts":"legacy","capital":"legacy","transfers":"legacy","taxAccounts":"legacy","clients":"legacy","suppliers":"legacy"},"skipped":{}}'::jsonb
WHERE "setupWizardState" IS NULL;
