-- AlterTable: PurchaseOrder - add order type (goods | services | mixed)
ALTER TABLE "PurchaseOrder" ADD COLUMN "orderType" TEXT DEFAULT 'goods';

-- AlterTable: PurchaseOrderItem - add line type and expense category; make productId optional
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "lineType" TEXT DEFAULT 'goods';
ALTER TABLE "PurchaseOrderItem" ADD COLUMN "expenseCategoryId" TEXT;
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "productId" DROP NOT NULL;

ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_expenseCategoryId_fkey"
  FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Expense - link to purchase order (for service POs)
ALTER TABLE "Expense" ADD COLUMN "purchaseOrderId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "purchaseOrderItemId" TEXT;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_purchaseOrderId_fkey"
  FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Expense_purchaseOrderId_idx" ON "Expense"("purchaseOrderId");
