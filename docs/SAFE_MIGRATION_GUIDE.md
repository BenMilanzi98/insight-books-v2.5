# Safe Migration Guide - Expense Categories

## Overview
This migration adds the ExpenseCategory feature without modifying or deleting any existing data.

## What This Migration Does
✅ **SAFE - Only Adds:**
- Creates new `ExpenseCategory` table
- Adds optional `categoryId` column to `Expense` table (nullable - won't affect existing records)
- Creates indexes and foreign keys

❌ **Does NOT:**
- Delete any data
- Modify existing columns
- Change existing data

## Migration Steps

### Option 1: Resolve Drift and Apply Migration (Recommended)

1. **Resolve the drift issue first:**
   ```bash
   npx prisma migrate resolve --applied 20240204_add_reversal_fields
   ```

2. **Apply the new migration:**
   ```bash
   npx prisma migrate deploy
   ```

### Option 2: Use Prisma DB Push (Development Only - No Migration History)

If you're in development and don't need migration history:
```bash
npx prisma db push
```

This will sync your schema directly without creating migration files.

### Option 3: Manual SQL Execution (Most Control)

If you want to review and execute manually:
```bash
# Review the migration file first
cat prisma/migrations/20260212000000_add_expense_categories/migration.sql

# Then execute it manually using psql
psql $DATABASE_URL -f prisma/migrations/20260212000000_add_expense_categories/migration.sql
```

## Verification

After applying the migration, verify:
1. ✅ `ExpenseCategory` table exists
2. ✅ `Expense.categoryId` column exists (nullable)
3. ✅ No existing expense data was modified
4. ✅ All foreign key constraints are in place

## Rollback (If Needed)

If you need to rollback:
```sql
-- Remove the foreign key constraint
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_categoryId_fkey";
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_accountId_fkey";
ALTER TABLE "ExpenseCategory" DROP CONSTRAINT IF EXISTS "ExpenseCategory_tenantId_fkey";

-- Drop indexes
DROP INDEX IF EXISTS "Expense_categoryId_idx";
DROP INDEX IF EXISTS "ExpenseCategory_tenantId_idx";
DROP INDEX IF EXISTS "ExpenseCategory_accountId_idx";

-- Drop the column (optional - you can keep it for future use)
ALTER TABLE "Expense" DROP COLUMN IF EXISTS "categoryId";

-- Drop the table
DROP TABLE IF EXISTS "ExpenseCategory";
```

## Notes
- The `categoryId` field in `Expense` is **nullable**, so existing expenses will continue to work
- The migration uses `IF NOT EXISTS` checks to prevent errors if run multiple times
- All foreign keys use `ON DELETE SET NULL` or `ON DELETE CASCADE` appropriately
