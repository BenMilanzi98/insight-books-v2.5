-- Add TenantSettings columns if missing (idempotent; safe when migrations were skipped or DB out of sync)
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "defaultBankDetails" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxOutflowAccountId" TEXT;
