-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN "defaultBankDetails" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "footerPhoneOverride" TEXT,
ADD COLUMN "footerBankDetailsOverride" TEXT;

-- AlterTable
ALTER TABLE "Quotation" ADD COLUMN "footerPhoneOverride" TEXT,
ADD COLUMN "footerBankDetailsOverride" TEXT;

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN "footerPhoneOverride" TEXT,
ADD COLUMN "footerBankDetailsOverride" TEXT;
