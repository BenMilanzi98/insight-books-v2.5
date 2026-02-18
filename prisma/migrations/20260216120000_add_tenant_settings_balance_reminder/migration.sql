-- Add balance reminder columns to TenantSettings (safe: IF NOT EXISTS)
-- Restored DBs may lack these if backup predates the feature.
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "balanceReminderSubject" TEXT;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "balanceReminderBody" TEXT;
