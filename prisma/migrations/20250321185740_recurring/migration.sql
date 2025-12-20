-- CreateTable
CREATE TABLE "RecurringExpense" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "occurrences" INTEGER,
    "remainingOccurrences" INTEGER,
    "endType" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "lastRunDate" TIMESTAMP(3),
    "nextRunDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringExpenseHistory" (
    "id" TEXT NOT NULL,
    "recurringExpenseId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "processedDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecurringExpenseHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringExpense_tenantId_idx" ON "RecurringExpense"("tenantId");

-- CreateIndex
CREATE INDEX "RecurringExpense_createdById_idx" ON "RecurringExpense"("createdById");

-- CreateIndex
CREATE INDEX "RecurringExpenseHistory_recurringExpenseId_idx" ON "RecurringExpenseHistory"("recurringExpenseId");

-- CreateIndex
CREATE INDEX "RecurringExpenseHistory_expenseId_idx" ON "RecurringExpenseHistory"("expenseId");

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpenseHistory" ADD CONSTRAINT "RecurringExpenseHistory_recurringExpenseId_fkey" FOREIGN KEY ("recurringExpenseId") REFERENCES "RecurringExpense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringExpenseHistory" ADD CONSTRAINT "RecurringExpenseHistory_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
