-- Purchases P2P: GRNI matching fields, inspection qtys, idempotency keys

-- GoodsReceipt
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "postingStatus" TEXT;
ALTER TABLE "GoodsReceipt" ADD COLUMN IF NOT EXISTS "inspectionStatus" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "GoodsReceipt_tenantId_idempotencyKey_key"
  ON "GoodsReceipt"("tenantId", "idempotencyKey");

-- GoodsReceiptItem
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "acceptedQuantity" DECIMAL(12,4);
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "rejectedQuantity" DECIMAL(12,4) DEFAULT 0;
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "damagedQuantity" DECIMAL(12,4) DEFAULT 0;
ALTER TABLE "GoodsReceiptItem" ADD COLUMN IF NOT EXISTS "qualityStatus" TEXT;

-- SupplierBill
ALTER TABLE "SupplierBill" ADD COLUMN IF NOT EXISTS "matchingStatus" TEXT;
ALTER TABLE "SupplierBill" ADD COLUMN IF NOT EXISTS "postingStatus" TEXT;
ALTER TABLE "SupplierBill" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierBill_tenantId_idempotencyKey_key"
  ON "SupplierBill"("tenantId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "SupplierBill_tenantId_supplierId_supplierInvoiceNumber_idx"
  ON "SupplierBill"("tenantId", "supplierId", "supplierInvoiceNumber");

CREATE INDEX IF NOT EXISTS "SupplierBill_tenantId_matchingStatus_idx"
  ON "SupplierBill"("tenantId", "matchingStatus");

-- SupplierBillItem
ALTER TABLE "SupplierBillItem" ADD COLUMN IF NOT EXISTS "purchaseOrderItemId" TEXT;
ALTER TABLE "SupplierBillItem" ADD COLUMN IF NOT EXISTS "goodsReceiptItemId" TEXT;
ALTER TABLE "SupplierBillItem" ADD COLUMN IF NOT EXISTS "matchStatus" TEXT;

CREATE INDEX IF NOT EXISTS "SupplierBillItem_goodsReceiptItemId_idx"
  ON "SupplierBillItem"("goodsReceiptItemId");

CREATE INDEX IF NOT EXISTS "SupplierBillItem_purchaseOrderItemId_idx"
  ON "SupplierBillItem"("purchaseOrderItemId");

-- FKs (safe if already present)
DO $$ BEGIN
  ALTER TABLE "SupplierBillItem"
    ADD CONSTRAINT "SupplierBillItem_purchaseOrderItemId_fkey"
    FOREIGN KEY ("purchaseOrderItemId") REFERENCES "PurchaseOrderItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SupplierBillItem"
    ADD CONSTRAINT "SupplierBillItem_goodsReceiptItemId_fkey"
    FOREIGN KEY ("goodsReceiptItemId") REFERENCES "GoodsReceiptItem"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- SupplierPayment
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "postingStatus" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierPayment_tenantId_idempotencyKey_key"
  ON "SupplierPayment"("tenantId", "idempotencyKey");

-- FIFO source lookup
CREATE INDEX IF NOT EXISTS "InventoryBatch_tenantId_sourceType_sourceId_idx"
  ON "InventoryBatch"("tenantId", "sourceType", "sourceId");
