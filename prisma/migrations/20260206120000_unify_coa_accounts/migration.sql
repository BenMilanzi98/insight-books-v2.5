-- Add isSystem flag to Account
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

-- Add expenseAccountId to Expense
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "expenseAccountId" TEXT;

-- Create index for Expense.expenseAccountId
CREATE INDEX IF NOT EXISTS "Expense_expenseAccountId_idx" ON "Expense"("expenseAccountId");

-- Add foreign key from Expense to Account
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Expense_expenseAccountId_fkey'
  ) THEN
    ALTER TABLE "Expense"
      ADD CONSTRAINT "Expense_expenseAccountId_fkey"
      FOREIGN KEY ("expenseAccountId") REFERENCES "Account"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Add unique index for tenantId + accountCode
CREATE UNIQUE INDEX IF NOT EXISTS "Account_tenantId_accountCode_key" ON "Account"("tenantId", "accountCode");
