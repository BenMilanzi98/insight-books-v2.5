-- Expense.taxTypeId and RecurringExpense.expenseAccountId (idempotent; safe when migrations were skipped)

ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "taxTypeId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Expense_taxTypeId_fkey') THEN
    ALTER TABLE "Expense" ADD CONSTRAINT "Expense_taxTypeId_fkey"
      FOREIGN KEY ("taxTypeId") REFERENCES "TaxType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Expense_taxTypeId_idx" ON "Expense"("taxTypeId");

ALTER TABLE "RecurringExpense" ADD COLUMN IF NOT EXISTS "expenseAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecurringExpense_expenseAccountId_fkey') THEN
    ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_expenseAccountId_fkey"
      FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RecurringExpense_expenseAccountId_idx" ON "RecurringExpense"("expenseAccountId");
