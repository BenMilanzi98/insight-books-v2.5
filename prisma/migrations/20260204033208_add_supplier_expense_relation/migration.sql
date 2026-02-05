-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedById" TEXT,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'MWK',
ADD COLUMN     "expectedRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "isLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BudgetItem" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "categoryId" TEXT,
ADD COLUMN     "variancePercent" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "employeeId" TEXT,
ADD COLUMN     "supplierId" TEXT;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "paymentPreference" TEXT;

-- CreateTable
CREATE TABLE "RevenueBudgetBreakdown" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "breakdownType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "referenceName" TEXT NOT NULL,
    "budgetedAmount" DOUBLE PRECISION NOT NULL,
    "actualAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "variance" DOUBLE PRECISION,
    "variancePercent" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueBudgetBreakdown_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RevenueBudgetBreakdown_budgetId_idx" ON "RevenueBudgetBreakdown"("budgetId");

-- CreateIndex
CREATE INDEX "RevenueBudgetBreakdown_breakdownType_idx" ON "RevenueBudgetBreakdown"("breakdownType");

-- CreateIndex
CREATE INDEX "RevenueBudgetBreakdown_referenceId_idx" ON "RevenueBudgetBreakdown"("referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "RevenueBudgetBreakdown_budgetId_breakdownType_referenceId_key" ON "RevenueBudgetBreakdown"("budgetId", "breakdownType", "referenceId");

-- CreateIndex
CREATE INDEX "Budget_periodType_idx" ON "Budget"("periodType");

-- CreateIndex
CREATE INDEX "Budget_isLocked_idx" ON "Budget"("isLocked");

-- CreateIndex
CREATE INDEX "BudgetItem_branchId_idx" ON "BudgetItem"("branchId");

-- CreateIndex
CREATE INDEX "BudgetItem_categoryId_idx" ON "BudgetItem"("categoryId");

-- CreateIndex
CREATE INDEX "Expense_supplierId_idx" ON "Expense"("supplierId");

-- CreateIndex
CREATE INDEX "Expense_employeeId_idx" ON "Expense"("employeeId");

-- CreateIndex
CREATE INDEX "Supplier_tenantId_paymentPreference_idx" ON "Supplier"("tenantId", "paymentPreference");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueBudgetBreakdown" ADD CONSTRAINT "RevenueBudgetBreakdown_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetItem" ADD CONSTRAINT "BudgetItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
