-- Dashboard notices for cross-tenant stock receipts
CREATE TABLE IF NOT EXISTS "StockTransferReceiptNotice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "sourceTenantId" TEXT NOT NULL,
    "sourceTenantName" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferReceiptNotice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockTransferReceiptNotice_stockTransferId_key" ON "StockTransferReceiptNotice"("stockTransferId");
CREATE INDEX IF NOT EXISTS "StockTransferReceiptNotice_tenantId_idx" ON "StockTransferReceiptNotice"("tenantId");
CREATE INDEX IF NOT EXISTS "StockTransferReceiptNotice_tenantId_readAt_idx" ON "StockTransferReceiptNotice"("tenantId", "readAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferReceiptNotice_tenantId_fkey'
  ) THEN
    ALTER TABLE "StockTransferReceiptNotice" ADD CONSTRAINT "StockTransferReceiptNotice_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransferReceiptNotice_stockTransferId_fkey'
  ) THEN
    ALTER TABLE "StockTransferReceiptNotice" ADD CONSTRAINT "StockTransferReceiptNotice_stockTransferId_fkey"
      FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
