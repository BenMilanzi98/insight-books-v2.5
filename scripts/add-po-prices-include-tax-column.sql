-- Add PurchaseOrder.pricesIncludeTax (and supplierInvoiceUrl) if missing.
-- Run when you see: The column `PurchaseOrder.pricesIncludeTax` does not exist in the current database.
-- Usage: psql "$DATABASE_URL" -f scripts/add-po-prices-include-tax-column.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'pricesIncludeTax'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added column PurchaseOrder.pricesIncludeTax';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'supplierInvoiceUrl'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierInvoiceUrl" TEXT;
    RAISE NOTICE 'Added column PurchaseOrder.supplierInvoiceUrl';
  END IF;
END $$;
