-- Ensure all PurchaseOrder and PurchaseOrderItem columns exist (idempotent).
-- Fixes 500 when schema has orderType/lineType/expenseCategoryId but DB was never fully migrated.

-- PurchaseOrder.orderType
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrder' AND column_name = 'orderType'
  ) THEN
    ALTER TABLE "PurchaseOrder" ADD COLUMN "orderType" TEXT DEFAULT 'goods';
  END IF;
END $$;

-- PurchaseOrderItem.lineType
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'lineType'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD COLUMN "lineType" TEXT DEFAULT 'goods';
  END IF;
END $$;

-- PurchaseOrderItem.expenseCategoryId
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'expenseCategoryId'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD COLUMN "expenseCategoryId" TEXT;
  END IF;
END $$;

-- FK for PurchaseOrderItem.expenseCategoryId (only if column exists and constraint missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'expenseCategoryId'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PurchaseOrderItem_expenseCategoryId_fkey'
  ) THEN
    ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_expenseCategoryId_fkey"
      FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Make productId nullable if it isn't (optional, safe to run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'productId'
  ) AND (
    SELECT is_nullable FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'PurchaseOrderItem' AND column_name = 'productId'
  ) = 'NO' THEN
    ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "productId" DROP NOT NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL; -- ignore if already nullable or error
END $$;
