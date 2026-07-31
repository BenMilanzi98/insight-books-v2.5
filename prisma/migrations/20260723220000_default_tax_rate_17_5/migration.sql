-- Default VAT rate for new tenant settings: MRA standard 17.5%
ALTER TABLE "TenantSettings" ALTER COLUMN "defaultTaxRate" SET DEFAULT 17.5;

-- Align existing tenants still on legacy 16.5% (or unset 0) to current standard
UPDATE "TenantSettings"
SET "defaultTaxRate" = 17.5
WHERE "defaultTaxRate" IN (16.5, 0);

UPDATE "TaxType"
SET "taxRate" = 17.5
WHERE "taxRate" = 16.5
  AND (
    "taxId" IN ('MW-VAT', 'MW-VAT-IN', 'A', 'VAT')
    OR "taxCode" IN ('VAT', 'VAT16.5', 'MW-VAT-STD', 'MW-VAT-IN', 'A')
    OR "taxName" ILIKE '%VAT%'
  );
