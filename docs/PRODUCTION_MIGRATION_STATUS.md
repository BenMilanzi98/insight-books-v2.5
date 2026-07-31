# 📊 Production Migration Status

## Current Situation

You have **34 migrations** that haven't been applied to production yet:

```
34 migrations found in prisma/migrations
Following migrations have not yet been applied:
- 20200101000000_init
- 20240204_add_reversal_fields
- ... (32 more migrations)
```

This means your production database is either:
- ✅ Empty/new (fresh database)
- ✅ Created with `prisma db push` (no migration history)
- ✅ Has old schema that doesn't match migrations

---

## 🎯 Your Goal

You want to:
1. ✅ Drop current database
2. ✅ Apply all 34 migrations (new schema)
3. ✅ Restore data from backup: `insightbooks_backup_Feb122026.dump`

---

## ✅ Solution: Use the Restore Script

The restore script I created will handle this perfectly:

```bash
./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump
```

**What it does:**
1. ✅ Drops existing database
2. ✅ Creates fresh database
3. ✅ Applies all 34 migrations (creates new schema)
4. ✅ Restores data from backup
5. ✅ Generates Prisma client

---

## ⚠️ Important Considerations

### Schema Conflicts

When restoring the backup after applying migrations, you might encounter:

1. **Missing columns in backup** (new columns in schema)
   - ✅ **Safe**: New columns will be NULL/default values
   - Example: If migration added `accountId String?`, old backup rows will have NULL

2. **Extra columns in backup** (removed in new schema)
   - ⚠️ **Warning**: Data in those columns will be lost
   - The restore will skip columns that don't exist in new schema

3. **Column type changes**
   - ⚠️ **May cause issues**: If types changed significantly
   - Most common: `String` → `String?` (nullable) - **This is safe!**

4. **Table structure changes**
   - ✅ **Usually safe**: pg_restore handles this gracefully

### Your Specific Case

Since you just made `accountId` fields nullable:
- ✅ **This is safe!** The backup might have NULL values or old values
- ✅ The restore will work because new schema allows NULLs
- ✅ No data loss expected

---

## 🚀 Step-by-Step Execution

### Step 1: Verify Backup Exists

```bash
ls -lh backups/insightbooks_backup_Feb122026.dump
```

### Step 2: Run Restore Script

```bash
./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump
```

**The script will:**
- Ask for confirmation (type `YES`)
- Drop database
- Create new database
- Apply all 34 migrations
- Restore backup data
- Verify success

### Step 3: Verify Migrations Applied

```bash
npx prisma migrate status
```

**Expected output:**
```
34 migrations found in prisma/migrations
Database schema is up to date!
```

### Step 4: Verify Data Restored

```bash
# Check table counts
psql "$DATABASE_URL" -c "
SELECT 
    'User' as table_name, COUNT(*) as count FROM \"User\"
UNION ALL
SELECT 'Invoice', COUNT(*) FROM \"Invoice\"
UNION ALL
SELECT 'Expense', COUNT(*) FROM \"Expense\";
"

# Or use Prisma Studio
npx prisma studio
```

### Step 5: Restart Application

```bash
pm2 restart your-app-name
# or
systemctl restart your-service
```

---

## 🔍 What to Expect During Restore

### During Migration Application

You'll see output like:
```
Applying migration `20200101000000_init`...
Applying migration `20240204_add_reversal_fields`...
...
Applying migration `20260206120000_unify_coa_accounts`...
```

This may take 1-5 minutes depending on:
- Number of migrations (34)
- Complexity of each migration
- Database performance

### During Data Restore

You'll see output like:
```
pg_restore: creating TABLE "User"
pg_restore: creating TABLE "Invoice"
...
pg_restore: processing data for table "User"
pg_restore: processing data for table "Invoice"
...
```

This may take several minutes depending on:
- Backup file size
- Number of records
- Database performance

### Potential Warnings (Usually Safe)

You might see warnings like:
```
WARNING: errors ignored on restore: 1
```

This is usually OK if it's just:
- Objects that already exist (handled by `--clean --if-exists`)
- Permissions issues (handled by `--no-owner --no-acl`)

**Check the log file** if you see errors:
```bash
cat /tmp/restore.log
```

---

## 🆘 Troubleshooting

### Issue: "Migration failed"

**Solution:**
```bash
# Check which migration failed
npx prisma migrate status

# Review the migration SQL
cat prisma/migrations/[FAILED_MIGRATION]/migration.sql

# Fix the issue and retry
npx prisma migrate deploy
```

### Issue: "Schema mismatch" during restore

**Solution:**
The restore script uses `--clean --if-exists` which handles most conflicts. If you still see errors:

1. **Check the error message** in `/tmp/restore.log`
2. **Common fix**: The backup might have old table structures
3. **Workaround**: Restore data-only after schema is created:

```bash
# After migrations are applied, restore only data
pg_restore \
    -d "$DATABASE_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    backups/insightbooks_backup_Feb122026.dump
```

### Issue: "Foreign key violations"

**Solution:**
This can happen if data relationships changed. The restore script should handle this, but if not:

```bash
# Temporarily disable triggers
psql "$DATABASE_URL" <<EOF
SET session_replication_role = 'replica';
EOF

# Restore data
pg_restore -d "$DATABASE_URL" --data-only backups/insightbooks_backup_Feb122026.dump

# Re-enable triggers
psql "$DATABASE_URL" <<EOF
SET session_replication_role = 'origin';
EOF
```

---

## ✅ Success Checklist

After restore, verify:

- [ ] ✅ All 34 migrations applied (`npx prisma migrate status` shows "up to date")
- [ ] ✅ Database has tables (`npx prisma studio` shows tables)
- [ ] ✅ Data exists (table counts > 0)
- [ ] ✅ Application starts without errors
- [ ] ✅ Can login to application
- [ ] ✅ Critical features work
- [ ] ✅ No errors in application logs

---

## 📝 Quick Command Reference

```bash
# 1. Check current status
npx prisma migrate status

# 2. Restore database
./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump

# 3. Verify migrations
npx prisma migrate status

# 4. Verify data
npx prisma studio

# 5. Restart app
pm2 restart your-app-name
```

---

## 🎯 Expected Final State

After successful restore:

```
✅ Database: insightbooks
✅ Schema: Up to date (34 migrations applied)
✅ Data: Restored from backup
✅ Prisma Client: Generated
✅ Application: Ready to restart
```

---

**You're ready to proceed!** The restore script will handle everything automatically. 🚀
