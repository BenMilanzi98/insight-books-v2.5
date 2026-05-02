-- Optional link to product_units: PO line quantity/cost are in this selling/stock unit.
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "productUnitId" TEXT;

CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_productUnitId_idx" ON "PurchaseOrderItem"("productUnitId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_productUnitId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderItem"
      ADD CONSTRAINT "PurchaseOrderItem_productUnitId_fkey"
      FOREIGN KEY ("productUnitId") REFERENCES "product_units"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
