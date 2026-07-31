# 🔧 Fix Backup Version Mismatch

## Problem

You're getting this error:
```
pg_restore: [archiver] unsupported version (1.14) in file header
```

This means the backup was created with a **different PostgreSQL version** than the one you're using to restore.

**Backup format 1.14** = PostgreSQL 12.x or 13.x
**Your pg_restore** = Likely PostgreSQL 18 (newer)

---

## ✅ Quick Solutions

### Solution 1: Use SQL Format Instead (Easiest)

If the backup is in custom format, try converting it to SQL:

```bash
# Convert custom format backup to SQL
pg_restore backups/insightbooks_backup_Feb122026.dump > /tmp/backup.sql

# Restore the SQL file
psql "$DATABASE_URL" -f /tmp/backup.sql
```

**Note:** Remove `?schema=public` from DATABASE_URL for psql:
```bash
DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')
psql "$DB_URL" -f /tmp/backup.sql
```

---

### Solution 2: Install Matching PostgreSQL Client

Install the PostgreSQL client version that matches your backup:

```bash
# For CentOS/RHEL (if backup is from PostgreSQL 12)
sudo yum install postgresql12

# Then use that version
/usr/pgsql-12/bin/pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/insightbooks_backup_Feb122026.dump
```

---

### Solution 3: Use Docker with Matching Version

If you have Docker, use a container with the matching PostgreSQL version:

```bash
# For PostgreSQL 12 backup
docker run --rm \
  -v $(pwd)/backups:/backup \
  -e PGPASSWORD=yourpassword \
  postgres:12 \
  pg_restore \
    -h your-db-host \
    -U your-username \
    -d insightbooks \
    --clean \
    --if-exists \
    --no-owner \
    --no-acl \
    /backup/insightbooks_backup_Feb122026.dump
```

---

### Solution 4: Use the Fix Script

I've created a script that tries multiple methods automatically:

```bash
./scripts/fix-backup-restore.sh backups/insightbooks_backup_Feb122026.dump
```

This script will:
1. ✅ Check PostgreSQL versions
2. ✅ Try different restore methods
3. ✅ Convert to SQL if needed
4. ✅ Try alternative pg_restore binaries

---

## 🔍 Determine Backup Version

Check what version created the backup:

```bash
# Try to list backup contents (this might work even with version mismatch)
pg_restore --list backups/insightbooks_backup_Feb122026.dump 2>&1 | head -5

# Or check file header
head -c 100 backups/insightbooks_backup_Feb122026.dump | od -c
```

---

## 📝 Step-by-Step: SQL Conversion Method (Recommended)

This is the **safest and most compatible** method:

### Step 1: Convert Backup to SQL

```bash
# Remove schema parameter
DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')

# Extract password
DB_PASS=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')

# Convert to SQL (this might work even with version mismatch)
PGPASSWORD="$DB_PASS" pg_restore "$BACKUP_FILE" > /tmp/backup.sql 2>&1
```

**If that fails**, try:
```bash
# Use older pg_restore if available
/usr/pgsql-12/bin/pg_restore backups/insightbooks_backup_Feb122026.dump > /tmp/backup.sql
```

### Step 2: Review SQL (Optional but Recommended)

```bash
# Check the SQL file
head -50 /tmp/backup.sql
tail -50 /tmp/backup.sql

# Check file size
ls -lh /tmp/backup.sql
```

### Step 3: Restore SQL File

```bash
# Restore using psql
PGPASSWORD="$DB_PASS" psql "$DB_URL" -f /tmp/backup.sql 2>&1 | tee /tmp/restore.log
```

**Note:** You might see some errors/warnings, but the restore should still work. Check the log:
```bash
# Check for critical errors
grep -i "error" /tmp/restore.log | grep -v "already exists" | head -20
```

### Step 4: Clean Up

```bash
rm -f /tmp/backup.sql
```

---

## 🆘 If All Methods Fail

### Option A: Recreate Backup from Source

If you have access to the original database:

```bash
# Create new backup with current PostgreSQL version
pg_dump "$SOURCE_DATABASE_URL" -F c -f backups/new_backup_$(date +%Y%m%d).dump

# Then restore normally
pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/new_backup_*.dump
```

### Option B: Use pg_upgrade or Migration Tools

If the backup is from a much older version, you might need to:
1. Restore to a temporary PostgreSQL 12/13 database
2. Use `pg_upgrade` to migrate to PostgreSQL 18
3. Export and import to your target database

---

## ✅ Verification After Restore

After successful restore:

```bash
# Check table count
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"

# Check some data
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"User\";"
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM \"Invoice\";"

# Verify with Prisma
npx prisma migrate status
npx prisma studio
```

---

## 🎯 Recommended Approach

**For your situation, I recommend:**

1. **Try the fix script first:**
   ```bash
   ./scripts/fix-backup-restore.sh backups/insightbooks_backup_Feb122026.dump
   ```

2. **If that fails, use SQL conversion:**
   ```bash
   # Convert
   pg_restore backups/insightbooks_backup_Feb122026.dump > /tmp/backup.sql
   
   # Restore
   DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')
   psql "$DB_URL" -f /tmp/backup.sql
   ```

3. **If still failing, install matching PostgreSQL client:**
   ```bash
   sudo yum install postgresql12
   /usr/pgsql-12/bin/pg_restore -d "$DATABASE_URL" --clean --if-exists --no-owner --no-acl backups/insightbooks_backup_Feb122026.dump
   ```

---

## 📋 Quick Reference

| Method | Command | When to Use |
|--------|---------|-------------|
| **SQL Conversion** | `pg_restore backup.dump > backup.sql && psql DB < backup.sql` | ✅ **Recommended** - Most compatible |
| **Fix Script** | `./scripts/fix-backup-restore.sh backup.dump` | ✅ Try first - Automated |
| **Matching Version** | Install PostgreSQL 12 client | If SQL conversion fails |
| **Docker** | Use `postgres:12` container | If you have Docker |

---

**Start with the fix script, then try SQL conversion if needed!** 🚀
