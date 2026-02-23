-- Add Expense purchase order columns if missing (idempotent)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "purchaseOrderItemId" TEXT;

-- Add FK only if it does not exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Expense_purchaseOrderId_fkey'
  ) THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseOrderId_fkey"
      FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_purchaseOrderId_idx" ON "Expense"("purchaseOrderId");
