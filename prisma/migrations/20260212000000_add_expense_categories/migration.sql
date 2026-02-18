-- CreateTable: ExpenseCategory
-- This migration only ADDS new tables and columns - no data will be lost

-- Create ExpenseCategory table
CREATE TABLE IF NOT EXISTS "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "accountId" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tenantId" TEXT NOT NULL,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints for ExpenseCategory
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_accountId_key" ON "ExpenseCategory"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_name_key" ON "ExpenseCategory"("tenantId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_accountCode_key" ON "ExpenseCategory"("tenantId", "accountCode");

-- Create indexes for ExpenseCategory
CREATE INDEX IF NOT EXISTS "ExpenseCategory_tenantId_idx" ON "ExpenseCategory"("tenantId");
CREATE INDEX IF NOT EXISTS "ExpenseCategory_accountId_idx" ON "ExpenseCategory"("accountId");

-- Add categoryId column to Expense table (nullable for backward compatibility)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;

-- Add foreign key constraint for Expense.categoryId -> ExpenseCategory.id
-- Only add if the column was just created (check if constraint doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'Expense_categoryId_fkey'
    ) THEN
        ALTER TABLE "Expense" 
        ADD CONSTRAINT "Expense_categoryId_fkey" 
        FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add index for Expense.categoryId
CREATE INDEX IF NOT EXISTS "Expense_categoryId_idx" ON "Expense"("categoryId");

-- Add foreign key constraint for ExpenseCategory.accountId -> Account.id
-- Only add if the constraint doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ExpenseCategory_accountId_fkey'
    ) THEN
        ALTER TABLE "ExpenseCategory" 
        ADD CONSTRAINT "ExpenseCategory_accountId_fkey" 
        FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- Add foreign key constraint for ExpenseCategory.tenantId -> Tenant.id
-- Only add if the constraint doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ExpenseCategory_tenantId_fkey'
    ) THEN
        ALTER TABLE "ExpenseCategory" 
        ADD CONSTRAINT "ExpenseCategory_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
