-- Stock transfer receive / reject metadata (aligned with API routes)
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "StockTransfer_receivedById_idx" ON "StockTransfer"("receivedById");
CREATE INDEX IF NOT EXISTS "StockTransfer_rejectedById_idx" ON "StockTransfer"("rejectedById");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_receivedById_fkey'
  ) THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedById_fkey"
      FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_rejectedById_fkey'
  ) THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
