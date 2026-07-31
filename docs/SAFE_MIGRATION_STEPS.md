# Safe Migration Steps - Quick Reference

## 🎯 Complete Safe Migration Process

Follow these steps **in order** to migrate your production database without losing data:

### Step 1: Check What Needs to Be Migrated

```bash
# Run the safety checklist
./scripts/safe-migration-checklist.sh
```

**What this does:**
- Shows all pending migrations
- Checks for dangerous operations (DROP, DELETE, etc.)
- Warns you if data loss is possible
- Shows you the SQL that will be executed

**What to look for:**
- ✅ **Safe**: `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`
- ⚠️ **Dangerous**: `DROP TABLE`, `DROP COLUMN`, `DELETE FROM`, `ALTER COLUMN TYPE`

### Step 2: Review Migration SQL Files

```bash
# View a specific migration
cat prisma/migrations/[MIGRATION_NAME]/migration.sql

# Or view all pending migrations
for dir in prisma/migrations/*/; do
    echo "=== $(basename $dir) ==="
    cat "$dir/migration.sql"
    echo ""
done
```

**Review for:**
- Any `DROP` statements (will delete data!)
- `ALTER COLUMN` with type changes (may lose data!)
- `DELETE FROM` statements (will delete records!)

### Step 3: Create Backup (MANDATORY!)

```bash
# Always backup before migrating!
./scripts/backup-database.sh
```

**This creates:**
- Timestamped backup in `backups/` folder
- Can be restored if something goes wrong

**Verify backup was created:**
```bash
ls -lh backups/
```

### Step 4: Test on Staging (If Available)

If you have a staging environment:

```bash
# Set staging DATABASE_URL
export DATABASE_URL="your_staging_database_url"

# Apply migrations to staging
npx prisma migrate deploy

# Test your application thoroughly
# If everything works, proceed to production
```

### Step 5: Apply to Production

```bash
# Use the deployment script (recommended)
./scripts/deploy-to-production.sh

# OR manually:
npx prisma migrate deploy
npx prisma generate
```

**The deployment script will:**
- Load DATABASE_URL from .env
- Show you what will be applied
- Ask for confirmation
- Apply migrations safely
- Regenerate Prisma client

### Step 6: Verify and Restart

```bash
# Check migration status (should show all applied)
npx prisma migrate status

# Restart your application
pm2 restart your-app
# or
systemctl restart your-service

# Monitor for errors
tail -f /var/log/your-app.log
```

## 🔍 Understanding Migration Safety

### Safe Operations (Won't Lose Data)

These operations are **safe** and can be run without worry:

- ✅ `CREATE TABLE` - Creates new tables
- ✅ `ADD COLUMN` - Adds new columns (with defaults)
- ✅ `CREATE INDEX` - Creates indexes (improves performance)
- ✅ `ALTER TABLE ... ADD CONSTRAINT` - Adds constraints
- ✅ `CREATE FOREIGN KEY` - Creates relationships

### Dangerous Operations (May Lose Data)

These operations **can cause data loss** - handle with extreme care:

- ⚠️ `DROP TABLE` - **DELETES ENTIRE TABLE AND ALL DATA**
- ⚠️ `DROP COLUMN` - **DELETES COLUMN AND ALL DATA IN IT**
- ⚠️ `DELETE FROM table` - **DELETES ROWS**
- ⚠️ `ALTER COLUMN ... TYPE` - May lose data if conversion fails
- ⚠️ `ALTER COLUMN ... DROP NOT NULL` - Usually safe but review
- ⚠️ `RENAME COLUMN` - May break application code

### What to Do If You See Dangerous Operations

1. **STOP** - Don't proceed automatically
2. **Review** - Read the full migration SQL carefully
3. **Backup** - Create a backup (you should already have one)
4. **Test** - Test on staging if possible
5. **Plan** - Consider if the migration is necessary
6. **Modify** - You may need to split the migration into safer steps

## 📋 Pre-Migration Checklist

Before running migrations, verify:

- [ ] ✅ Backup created and verified
- [ ] ✅ Reviewed all pending migration SQL files
- [ ] ✅ No dangerous operations detected (or understood and accepted)
- [ ] ✅ Tested on staging (if available)
- [ ] ✅ Maintenance window scheduled (if needed)
- [ ] ✅ Team notified
- [ ] ✅ Rollback plan prepared
- [ ] ✅ Application can be restarted quickly

## 🚨 Rollback Plan

If something goes wrong:

1. **Stop the application immediately**
   ```bash
   pm2 stop your-app
   # or
   systemctl stop your-service
   ```

2. **Restore from backup**
   ```bash
   # Find your backup file
   ls -lh backups/
   
   # Restore (replace with your backup filename)
   pg_restore -d "$DATABASE_URL" -c backups/backup_YYYYMMDD_HHMMSS.dump
   ```

3. **Revert code changes**
   ```bash
   git revert HEAD
   # or
   git checkout previous-commit
   ```

4. **Restart application**
   ```bash
   pm2 restart your-app
   ```

## 💡 Pro Tips

1. **Always backup first** - No exceptions!
2. **Review SQL before applying** - Understand what will happen
3. **Test on staging first** - If you have one
4. **Run during low-traffic periods** - Minimize impact
5. **Monitor after migration** - Watch for errors
6. **Keep backups** - Don't delete old backups immediately

## 📞 Quick Commands Reference

```bash
# Check what needs to be migrated
./scripts/safe-migration-checklist.sh

# Create backup
./scripts/backup-database.sh

# Deploy migrations
./scripts/deploy-to-production.sh

# Check migration status
npx prisma migrate status

# View a specific migration
cat prisma/migrations/[MIGRATION_NAME]/migration.sql

# Generate Prisma client
npx prisma generate
```

## ❓ Common Questions

**Q: Will migrations delete my data?**
A: Only if the migration contains `DROP` or `DELETE` statements. Always review migrations first!

**Q: Can I run migrations during business hours?**
A: Safe migrations (CREATE, ADD) can run anytime. Dangerous ones should run during maintenance windows.

**Q: What if a migration fails halfway?**
A: Prisma tracks which migrations are applied. Failed migrations won't be marked as applied, so you can fix and retry.

**Q: How do I know if a migration is safe?**
A: Run `./scripts/safe-migration-checklist.sh` - it will tell you!

**Q: Can I skip a migration?**
A: Not recommended. Migrations should be applied in order. If you need to skip, you'll need to manually mark it as applied (advanced).

