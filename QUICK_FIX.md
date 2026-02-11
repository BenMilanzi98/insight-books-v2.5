# Quick Fix: Add accountId Column to SaleItem

## ✅ Your Revenue Account is Ready!

Since you already have a revenue account in Chart of Accounts, we just need to add the database column.

## Run This Command:

```bash
psql "$DATABASE_URL" -f scripts/add-accountid-column.sql
```

**OR** if you prefer to connect interactively:

```bash
# 1. Connect to database
psql "$DATABASE_URL"

# 2. Copy and paste the entire contents of scripts/add-accountid-column.sql
# (The script will automatically find your revenue account and use it)

# 3. Exit psql
\q
```

## What Happens:

1. ✅ Adds `accountId` column to `SaleItem` table
2. ✅ Finds your existing Revenue account (account code 4000 or similar)
3. ✅ Sets that account for all existing sale items (if any)
4. ✅ Makes the column required
5. ✅ Adds foreign key constraint

## After Running:

1. **Restart your Next.js server:**
   ```bash
   # Stop current server (Ctrl+C)
   npm run dev
   ```

2. **Test creating a sale in POS** - it should work now! 🎉

## If You Get an Error:

If the script says "No active Income or Revenue account found":
- Go to `/chart-of-accounts` in your app
- Verify your Revenue account is marked as **Active**
- The account type should be **Income** or **Revenue**
- Run the script again
