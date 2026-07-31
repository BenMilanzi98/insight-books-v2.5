-- Wave 6 — Reversal segregation-of-duties setting

ALTER TABLE "TenantSettings"
  ADD COLUMN IF NOT EXISTS "reversalRequireSeparateApprover" BOOLEAN NOT NULL DEFAULT true;
