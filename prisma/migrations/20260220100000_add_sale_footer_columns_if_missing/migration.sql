-- Add Sale footer override columns if missing (fixes P2022 when migration was marked applied but columns not created)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "footerPhoneOverride" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "footerBankDetailsOverride" TEXT;
