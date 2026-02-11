# Fix: Income Account Required Error

## Problem
The error "Income account is required" occurs because the `accountId` column doesn't exist in the `SaleItem` database table yet.

## Solution

### Option 1: Run SQL Script (Recommended)

1. Connect to your database:
   ```bash
   psql "$DATABASE_URL"
   ```

2. Run the SQL script:
   ```bash
   psql "$DATABASE_URL" -f scripts/add-accountid-column.sql
   ```

   Or copy and paste the contents of `scripts/add-accountid-column.sql` into your database client.

### Option 2: Use Prisma Migrate

1. Create a migration:
   ```bash
   npx prisma migrate dev --name add_accountid_to_saleitem --create-only
   ```

2. Edit the generated migration file in `prisma/migrations/` to:
   - Add the column as nullable first
   - Set default values for existing rows
   - Make it required
   - Add foreign key constraint

3. Apply the migration:
   ```bash
   npx prisma migrate deploy
   ```

### Option 3: Use Prisma DB Push (Development Only)

⚠️ **Warning**: This may fail if you have existing SaleItem records. Use only if you can accept data loss or have a backup.

```bash
npx prisma db push
```

## After Running the Fix

1. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

2. Restart your Next.js server:
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

3. Test creating a sale in the POS - it should work now!

## What the Fix Does

- Adds `accountId` column to `SaleItem` table
- Sets a default income account for all existing sale items (if any)
- Makes the column required (NOT NULL)
- Adds foreign key constraint to `Account` table
- Creates an index for better query performance

## Troubleshooting

If you get an error about "No active Income or Revenue account found":
1. Go to Chart of Accounts
2. Create an Income or Revenue account (e.g., account code 4000 - Revenue)
3. Make sure it's marked as Active
4. Run the fix script again
