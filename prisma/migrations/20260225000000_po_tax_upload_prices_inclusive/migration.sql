-- Purchase Order Module: pricesIncludeTax, supplierInvoiceUrl, line-level taxTypeId (Input VAT / Tax Management).

-- PurchaseOrder.pricesIncludeTax
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'pricesIncludeTax'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "pricesIncludeTax" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- PurchaseOrder.supplierInvoiceUrl
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'supplierInvoiceUrl'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "supplierInvoiceUrl" TEXT;
  END IF;
END $$;

-- PurchaseOrderItem.taxTypeId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'taxTypeId'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD COLUMN "taxTypeId" TEXT;
  END IF;
END $$;

-- FK PurchaseOrderItem.taxTypeId -> TaxType (optional)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'taxTypeId'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_taxTypeId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_taxTypeId_fkey"
      FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_taxTypeId_idx" ON "PurchaseOrderItem"("taxTypeId");
