-- Add Quotation footer override columns if missing
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "footerPhoneOverride" TEXT;
ALTER TABLE "Quotation" ADD COLUMN IF NOT EXISTS "footerBankDetailsOverride" TEXT;

-- Add Invoice footer override columns if missing (in case migration was partially applied)
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "footerPhoneOverride" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "footerBankDetailsOverride" TEXT;
