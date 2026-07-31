# 🔄 Database Restore Guide

## Overview

This guide explains how to restore your production database from a backup while applying new schema changes.

---

## ⚠️ CRITICAL WARNING

**This process will:**
- ❌ **DELETE all current data** in your database
- ✅ **Create a fresh database** with new schema
- ✅ **Restore data** from your backup file

**Only proceed if:**
- ✅ You have a valid backup file
- ✅ You understand that current data will be lost
- ✅ You're in a maintenance window
- ✅ You've notified your team

---

## 📋 Prerequisites

1. **Backup file exists** (e.g., `insightbooks_backup_Feb122026.dump`)
2. **Database connection** works (test with `./scripts/diagnose-db-connection.sh`)
3. **Prisma migrations** are ready in `prisma/migrations/`
4. **Maintenance window** scheduled

---

## 🚀 Quick Restore (Automated)

### Step 1: Run the Restore Script

```bash
./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump
```

**Or with full path:**
```bash
./scripts/restore-from-backup.sh /path/to/insightbooks_backup_Feb122026.dump
```

**What the script does:**
1. ✅ Verifies backup file exists
2. ✅ Drops existing database
3. ✅ Creates new empty database
4. ✅ Applies Prisma migrations (new schema)
5. ✅ Restores data from backup
6. ✅ Generates Prisma client
7. ✅ Verifies restoration

---

## 📝 Manual Restore (Step-by-Step)

If you prefer more control, follow these steps:

### Step 1: Verify Backup File

```bash
# Check backup file exists and size
ls -lh backups/insightbooks_backup_Feb122026.dump

# Verify backup integrity (optional)
pg_restore --list backups/insightbooks_backup_Feb122026.dump | head -20
```

### Step 2: Connect to PostgreSQL

```bash
# Load DATABASE_URL from .env
source .env  # or export DATABASE_URL="..."

# Test connection
psql "$DATABASE_URL" -c "SELECT version();"
```

### Step 3: Drop and Recreate Database

```bash
# Extract database name from DATABASE_URL
DB_NAME=$(echo "$DATABASE_URL" | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Connect to postgres database (not your app database)
DB_URL_POSTGRES=$(echo "$DATABASE_URL" | sed "s|/${DB_NAME}|/postgres|")

# Drop existing database (terminate connections first)
psql "$DB_URL_POSTGRES" <<EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = '${DB_NAME}' AND pid <> pg_backend_pid();

DROP DATABASE IF EXISTS "${DB_NAME}";
CREATE DATABASE "${DB_NAME}";
EOF
```

### Step 4: Apply New Schema (Migrations)

```bash
# Apply all migrations to create new schema
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate
```

### Step 5: Restore Data from Backup

```bash
# Restore data (remove ?schema= parameter)
DB_URL_RESTORE=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')

pg_restore \
    -d "$DB_URL_RESTORE" \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    -v \
    backups/insightbooks_backup_Feb122026.dump
```

### Step 6: Verify Restoration

```bash
# Check migrations were applied
npx prisma migrate status

# Check table count
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Test with Prisma Studio (optional)
npx prisma studio
```

---

## 🔍 Troubleshooting

### Issue 1: "Backup file not found"

**Solution:**
```bash
# Find backup files
find . -name "*.dump" -type f

# Or check backups directory
ls -lh backups/
```

### Issue 2: "Cannot connect to database"

**Solution:**
```bash
# Run diagnostic script
./scripts/diagnose-db-connection.sh

# Fix DATABASE_URL in .env
nano .env
```

### Issue 3: "Schema mismatch" errors during restore

**This happens when:**
- Backup schema doesn't match new schema
- New columns were added that don't exist in backup
- Column types changed

**Solutions:**

**Option A: Restore with data-only (if schema already exists)**
```bash
# If you've already applied migrations, restore only data
pg_restore \
    -d "$DATABASE_URL" \
    --data-only \
    --no-owner \
    --no-acl \
    backups/insightbooks_backup_Feb122026.dump
```

**Option B: Restore to temporary database, then migrate**
```bash
# 1. Restore to temp database
createdb temp_restore
pg_restore -d temp_restore backups/insightbooks_backup_Feb122026.dump

# 2. Apply migrations to temp database
export DATABASE_URL="postgresql://user:pass@host:5432/temp_restore"
npx prisma migrate deploy

# 3. Export from temp and import to main
pg_dump temp_restore -F c -f temp_migrated.dump
pg_restore -d "$DATABASE_URL" temp_migrated.dump

# 4. Clean up
dropdb temp_restore
rm temp_migrated.dump
```

### Issue 4: "Foreign key constraint violations"

**Solution:**
```bash
# Restore with constraints disabled temporarily
psql "$DATABASE_URL" <<EOF
SET session_replication_role = 'replica';
EOF

pg_restore -d "$DATABASE_URL" --no-owner --no-acl backups/insightbooks_backup_Feb122026.dump

psql "$DATABASE_URL" <<EOF
SET session_replication_role = 'origin';
EOF
```

### Issue 5: "Permission denied" errors

**Solution:**
```bash
# Use --no-owner and --no-acl flags (already in script)
# Or restore as postgres superuser
sudo -u postgres pg_restore -d "$DB_NAME" backups/insightbooks_backup_Feb122026.dump
```

---

## ✅ Post-Restore Checklist

After restoration, verify:

- [ ] ✅ Database is accessible
- [ ] ✅ All migrations applied (`npx prisma migrate status`)
- [ ] ✅ Tables exist and have data
- [ ] ✅ Application starts without errors
- [ ] ✅ Can login to application
- [ ] ✅ Critical features work (invoices, payments, etc.)
- [ ] ✅ Data integrity verified (spot check important records)
- [ ] ✅ No errors in application logs

---

## 🔄 Alternative: Restore Without Dropping

If you want to preserve current data and merge with backup:

### Option 1: Restore to Separate Database

```bash
# Create temporary database
createdb temp_restore_$(date +%Y%m%d)

# Restore backup to temp database
pg_restore -d temp_restore_$(date +%Y%m%d) backups/insightbooks_backup_Feb122026.dump

# Compare and merge data manually
# Then drop temp database when done
```

### Option 2: Selective Table Restore

```bash
# List tables in backup
pg_restore --list backups/insightbooks_backup_Feb122026.dump | grep "TABLE DATA"

# Restore specific tables only
pg_restore \
    -d "$DATABASE_URL" \
    --table=users \
    --table=invoices \
    --data-only \
    backups/insightbooks_backup_Feb122026.dump
```

---

## 📊 Verification Commands

```bash
# Check database size
psql "$DATABASE_URL" -c "SELECT pg_size_pretty(pg_database_size('${DB_NAME}'));"

# Count records in key tables
psql "$DATABASE_URL" -c "
SELECT 
    'users' as table_name, COUNT(*) as count FROM \"User\"
UNION ALL
SELECT 'invoices', COUNT(*) FROM \"Invoice\"
UNION ALL
SELECT 'expenses', COUNT(*) FROM \"Expense\"
UNION ALL
SELECT 'accounts', COUNT(*) FROM \"Account\";
"

# Check for NULL accountIds (after nullable fix)
psql "$DATABASE_URL" -c "
SELECT 
    'InvoiceItem' as table_name, COUNT(*) as null_accountids 
FROM \"InvoiceItem\" WHERE \"accountId\" IS NULL
UNION ALL
SELECT 'Expense', COUNT(*) FROM \"Expense\" WHERE \"expenseAccountId\" IS NULL;
"
```

---

## 🆘 Emergency Rollback

If something goes wrong:

1. **Stop your application immediately:**
   ```bash
   pm2 stop your-app-name
   ```

2. **Restore from a different backup** (if you have one)

3. **Or restore the backup you just used:**
   ```bash
   # Drop and recreate
   psql "$DB_URL_POSTGRES" -c "DROP DATABASE ${DB_NAME}; CREATE DATABASE ${DB_NAME};"
   
   # Restore backup
   pg_restore -d "$DATABASE_URL" backups/insightbooks_backup_Feb122026.dump
   ```

---

## 📝 Summary

**Quick restore command:**
```bash
./scripts/restore-from-backup.sh backups/insightbooks_backup_Feb122026.dump
```

**What happens:**
1. ✅ Drops current database
2. ✅ Creates fresh database
3. ✅ Applies new schema (migrations)
4. ✅ Restores data from backup
5. ✅ Generates Prisma client
6. ✅ Verifies success

**After restore:**
- Restart application
- Test critical features
- Monitor logs

---

**Remember: Always have a backup before restoring!** 💾
