-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "paymentMethod" TEXT;

-- CreateIndex
CREATE INDEX "Expense_paymentMethod_idx" ON "Expense"("paymentMethod");
