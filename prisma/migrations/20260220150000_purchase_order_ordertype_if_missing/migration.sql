-- Add PurchaseOrder.orderType if missing (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'orderType'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "orderType" TEXT DEFAULT 'goods';
  END IF;
END $$;
