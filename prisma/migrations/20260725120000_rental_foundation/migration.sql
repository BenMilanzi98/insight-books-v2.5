-- Rental foundation: Decimal money, optional invoice, idempotency, tenant settings flags

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "rentalPostInvoiceOnBook" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "rentalAutoCompleteExpired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RentalAsset" ALTER COLUMN "defaultRate" TYPE DECIMAL(18,2) USING ROUND(COALESCE("defaultRate",0)::numeric, 2);

ALTER TABLE "RentalTransaction" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING ROUND(COALESCE("totalAmount",0)::numeric, 2);
ALTER TABLE "RentalTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "RentalTransaction" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- Drop FK and recreate as ON DELETE SET NULL (invoice optional)
DO $$ BEGIN
  ALTER TABLE "RentalTransaction" DROP CONSTRAINT IF EXISTS "RentalTransaction_invoiceId_fkey";
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "RentalTransaction" ADD CONSTRAINT "RentalTransaction_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "RentalTransaction_tenantId_idempotencyKey_key"
  ON "RentalTransaction"("tenantId", "idempotencyKey");

ALTER TABLE "RentalItem" ALTER COLUMN "unitRate" TYPE DECIMAL(18,2) USING ROUND("unitRate"::numeric, 2);
ALTER TABLE "RentalItem" ALTER COLUMN "billableUnits" TYPE DECIMAL(18,4) USING ROUND("billableUnits"::numeric, 4);
ALTER TABLE "RentalItem" ALTER COLUMN "total" TYPE DECIMAL(18,2) USING ROUND("total"::numeric, 2);

ALTER TABLE "RentalAssetAvailability" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
CREATE INDEX IF NOT EXISTS "RentalAssetAvailability_tenantId_idx" ON "RentalAssetAvailability"("tenantId");

-- Backfill tenantId on availability from parent transaction
UPDATE "RentalAssetAvailability" a
SET "tenantId" = t."tenantId"
FROM "RentalTransaction" t
WHERE a."rentalTransactionId" = t.id AND a."tenantId" IS NULL;
