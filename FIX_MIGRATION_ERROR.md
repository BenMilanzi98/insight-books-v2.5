# 🔧 Fix Migration Error: Sale Table Not Found

## Problem

The migration `20240204_add_reversal_fields` failed because it tries to alter the `Sale` table, but that table is created in a **later migration** (`20250321210116_sales`).

**Error:**
```
ERROR: relation "Sale" does not exist
```

---

## ✅ Solution

I've fixed the migration file to check if tables exist before trying to alter them. Now you need to:

### Step 1: Mark the Failed Migration as Rolled Back

```bash
npx prisma migrate resolve --rolled-back 20240204_add_reversal_fields
```

### Step 2: Continue with Migrations

```bash
npx prisma migrate deploy
```

This should now work because:
- ✅ The migration now checks if `Sale` table exists before altering it
- ✅ The migration now checks if `SupplierPayment` table exists before altering it
- ✅ Functions are also updated to handle missing tables gracefully

---

## 🔍 What Was Fixed

### 1. Sale Table Alterations
Changed from:
```sql
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
```

To:
```sql
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'Sale') THEN
        ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN DEFAULT FALSE;
        -- ... other columns
    END IF;
END $$;
```

### 2. SupplierPayment Table Alterations
Same fix applied for `SupplierPayment` table.

### 3. Trigger Functions
Updated functions to check if tables exist before querying them.

---

## 🚀 Quick Fix Commands

Run these commands on your production server:

```bash
# 1. Mark failed migration as rolled back
npx prisma migrate resolve --rolled-back 20240204_add_reversal_fields

# 2. Continue with migrations
npx prisma migrate deploy

# 3. Verify all migrations applied
npx prisma migrate status

# 4. Generate Prisma client
npx prisma generate
```

---

## 📝 Expected Output

After running the commands, you should see:

```
✅ Migration marked as rolled back
✅ Applying migration `20240204_add_reversal_fields`...
✅ Applying migration `20250319121115_update_password_field`...
...
✅ All migrations applied successfully!
```

---

## ⚠️ If It Still Fails

If you still encounter errors:

1. **Check the error message** - it will tell you which table/operation failed
2. **Review the migration file:**
   ```bash
   cat prisma/migrations/20240204_add_reversal_fields/migration.sql
   ```
3. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

---

## ✅ After Migrations Succeed

Once all migrations are applied:

1. **Continue with data restore** (if you were in the middle of that):
   ```bash
   # Restore data from backup
   pg_restore -d "$DATABASE_URL" --clean --if-exists backups/insightbooks_backup_Feb122026.dump
   ```

2. **Or restart your restore script:**
   ```bash
   ./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump
   ```
   (It will skip the migration step since they're already applied)

---

## 🎯 Summary

**The fix is already applied to the migration file.** You just need to:

1. ✅ Mark the failed migration as rolled back
2. ✅ Re-run migrations
3. ✅ Continue with your restore process

**Run these two commands:**
```bash
npx prisma migrate resolve --rolled-back 20240204_add_reversal_fields
npx prisma migrate deploy
```

That's it! 🚀
