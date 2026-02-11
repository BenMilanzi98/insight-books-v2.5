# Fix: InvoiceItem accountId Column Missing

## Problem
The database is missing the `accountId` column on the `InvoiceItem` table, causing invoice creation to fail with:
```
The column `accountId` does not exist in the current database.
```

## Solution
Run the migration script to add the `accountId` column to the `InvoiceItem` table.

## Steps to Fix

1. **Run the migration script:**
   ```bash
   node scripts/migrate-add-accountid-to-invoiceitems.js
   ```

2. **Verify the migration:**
   The script will:
   - Add `accountId` column to `InvoiceItem` table (if it doesn't exist)
   - Set a default income/revenue account for existing invoice items
   - Make the column required (NOT NULL)
   - Add foreign key constraint to `Account` table
   - Create an index on `accountId`

3. **Test invoice creation:**
   - Try creating a new invoice
   - The error should be resolved

## What the Script Does

1. Checks if `accountId` column already exists
2. If it exists but has NULL values, updates them with a default account
3. If it doesn't exist:
   - Adds the column as nullable
   - Finds a default Income/Revenue account
   - Updates all existing rows with the default account
   - Adds foreign key constraint
   - Makes the column required
   - Creates an index

## Requirements

- At least one active Income or Revenue account must exist in Chart of Accounts
- Database connection must be configured in `.env` file

## Notes

- The script is safe to run multiple times (idempotent)
- Existing invoice items will be assigned a default account
- No data will be lost
