# 🚀 Production Database Deployment Guide

## ⚠️ CRITICAL: Zero Data Loss Migration Strategy

This guide ensures **safe, zero-data-loss** database migrations to production.

> **Short path:** For a concise, step-by-step “push to production without losing data” flow (backup → migrate deploy → generate → restart), see **[docs/PRODUCTION_PUSH_GUIDE.md](docs/PRODUCTION_PUSH_GUIDE.md)**.

---

## 📋 Pre-Deployment Checklist

Before deploying ANY changes to production:

- [ ] ✅ **Backup created** (mandatory!)
- [ ] ✅ **Migration SQL reviewed** (check for DROP/DELETE)
- [ ] ✅ **Tested on staging** (if available)
- [ ] ✅ **Maintenance window scheduled** (if needed)
- [ ] ✅ **Rollback plan prepared**
- [ ] ✅ **Team notified**

---

## 🎯 Step-by-Step Safe Deployment Process

### Step 1: Check What Needs to Be Migrated

First, see what migrations are pending:

```bash
# Check migration status
npx prisma migrate status

# Or use the safety checklist script
./scripts/safe-migration-checklist.sh
```

**What to look for:**
- ✅ **Safe operations**: `CREATE TABLE`, `ADD COLUMN`, `CREATE INDEX`, `ALTER TABLE ADD CONSTRAINT`
- ⚠️ **Dangerous operations**: `DROP TABLE`, `DROP COLUMN`, `DELETE FROM`, `ALTER COLUMN TYPE` (without defaults)

---

### Step 2: Review Migration SQL Files

**CRITICAL**: Always review the SQL that will be executed!

```bash
# View all pending migrations
for dir in prisma/migrations/*/; do
    echo "=== $(basename $dir) ==="
    cat "$dir/migration.sql" | head -50
    echo ""
done

# Or view a specific migration
cat prisma/migrations/[MIGRATION_NAME]/migration.sql
```

**Red flags to watch for:**
- ❌ `DROP TABLE` - Will delete entire tables!
- ❌ `DROP COLUMN` - Will delete column data!
- ❌ `DELETE FROM` - Will delete records!
- ❌ `ALTER COLUMN ... TYPE` without defaults - May lose data!
- ⚠️ `ALTER COLUMN ... TYPE` with defaults - Usually safe, but verify

---

### Step 3: Create Database Backup (MANDATORY!)

**NEVER skip this step!** Always backup before migrating.

```bash
# Use the automated backup script (recommended)
./scripts/backup-database.sh

# OR manually create a backup
export DATABASE_URL="your_production_database_url"
pg_dump "$DATABASE_URL" -F c -f backups/production_backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup was created
ls -lh backups/ | tail -5
```

**Backup location**: `backups/production_backup_YYYYMMDD_HHMMSS.dump`

**Verify backup integrity:**
```bash
# Test restore to a temporary database (optional but recommended)
pg_restore --list backups/production_backup_*.dump | head -20
```

---

### Step 4: Test on Staging (If Available)

If you have a staging environment that mirrors production:

```bash
# Set staging DATABASE_URL
export DATABASE_URL="your_staging_database_url"

# Apply migrations to staging
npx prisma migrate deploy

# Test your application thoroughly
# - Create invoices
# - Process payments
# - Generate reports
# - Test all critical workflows

# If everything works, proceed to production
```

---

### Step 5: Apply Migrations to Production

#### Option A: Using the Deployment Script (Recommended - Safest)

```bash
# This script includes safety checks and confirmations
./scripts/deploy-to-production.sh
```

**What the script does:**
1. ✅ Loads DATABASE_URL from `.env`
2. ✅ Shows database connection info (password masked)
3. ✅ Asks for confirmation
4. ✅ Checks migration status
5. ✅ Shows pending migrations
6. ✅ Applies migrations with `prisma migrate deploy`
7. ✅ Regenerates Prisma client

#### Option B: Manual Deployment (For More Control)

```bash
# 1. Set production DATABASE_URL
export DATABASE_URL="your_production_database_url"

# 2. Check status
npx prisma migrate status

# 3. Review what will be applied
# (Review the migration SQL files as shown in Step 2)

# 4. Apply migrations (only applies pending ones, safe!)
npx prisma migrate deploy

# 5. Generate Prisma client
npx prisma generate
```

**Key difference:**
- `prisma migrate deploy` - **Safe for production** - Only applies pending migrations, never creates new ones
- `prisma migrate dev` - **Development only** - Creates new migrations and applies them
- `prisma db push` - **Development only** - Directly pushes schema, can be dangerous

---

### Step 6: Verify Migration Success

After applying migrations, verify everything worked:

```bash
# Check migration status (should show all applied)
npx prisma migrate status

# Verify tables exist (if you created new ones)
npx prisma studio
# Or via psql:
psql "$DATABASE_URL" -c "\dt" | grep -i "your_new_table"

# Test database connection
npx prisma db execute --stdin <<< "SELECT 1;"
```

---

### Step 7: Update Application Code

After migrations are applied:

```bash
# 1. Regenerate Prisma client (if not done automatically)
npx prisma generate

# 2. Build your application
npm run build

# 3. Restart your application
# For PM2:
pm2 restart your-app-name

# For systemd:
sudo systemctl restart your-service

# For Docker:
docker-compose restart app

# For Vercel/Netlify:
# (Deploy via git push - migrations should run automatically)
```

---

### Step 8: Post-Deployment Verification

After deployment, test critical functionality:

- [ ] ✅ Application starts without errors
- [ ] ✅ Database connections work
- [ ] ✅ Create/read/update operations work
- [ ] ✅ Critical workflows tested (invoices, payments, reports)
- [ ] ✅ No console errors in production logs
- [ ] ✅ Performance is acceptable

---

## 🔄 Rollback Plan (If Something Goes Wrong)

If a migration causes issues, here's how to rollback:

### Option 1: Restore from Backup (Safest)

```bash
# 1. Stop your application
pm2 stop your-app-name

# 2. Restore database from backup
pg_restore -d "$DATABASE_URL" --clean --if-exists backups/production_backup_YYYYMMDD_HHMMSS.dump

# 3. Mark migrations as rolled back (if needed)
npx prisma migrate resolve --rolled-back [MIGRATION_NAME]

# 4. Restart application
pm2 start your-app-name
```

### Option 2: Create a Fix Migration

If you can't restore, create a fix:

```bash
# 1. Fix the issue in schema.prisma
# 2. Create a new migration
npx prisma migrate dev --name fix_issue_name

# 3. Review the migration SQL
# 4. Apply to production
npx prisma migrate deploy
```

---

## 🛡️ Safety Best Practices

### 1. Always Use `prisma migrate deploy` in Production

✅ **DO:**
```bash
npx prisma migrate deploy
```

❌ **DON'T:**
```bash
npx prisma migrate dev        # Creates new migrations - development only!
npx prisma db push           # Can cause data loss - development only!
```

### 2. Never Skip Backups

Always create a backup before any production migration, even for "safe" changes.

### 3. Review Migration SQL

Always review the SQL that will be executed. Look for:
- DROP statements
- DELETE statements
- ALTER COLUMN type changes
- Data transformations

### 4. Test on Staging First

If you have a staging environment, always test migrations there first.

### 5. Use Transactions When Possible

Prisma migrations run in transactions automatically, so if a migration fails, it rolls back.

### 6. Monitor After Deployment

Watch your application logs and database performance after deployment.

---

## 📊 Migration Status Commands

```bash
# Check what migrations are pending
npx prisma migrate status

# View migration history
npx prisma migrate status --schema prisma/schema.prisma

# List all migrations
ls -la prisma/migrations/
```

---

## 🔍 Troubleshooting

### Issue: "Migration X is not in the database"

**Solution:**
```bash
# Mark migration as applied (if you manually ran the SQL)
npx prisma migrate resolve --applied [MIGRATION_NAME]

# Or mark as rolled back
npx prisma migrate resolve --rolled-back [MIGRATION_NAME]
```

### Issue: "Migration failed mid-way"

**Solution:**
1. Check the error message
2. Fix the issue in your schema or migration SQL
3. Create a new migration to fix it
4. Or restore from backup and try again

### Issue: "Prisma client is out of sync"

**Solution:**
```bash
# Regenerate Prisma client
npx prisma generate

# Restart your application
```

---

## 📝 Quick Reference

| Command | Use Case | Safe for Production? |
|---------|----------|---------------------|
| `npx prisma migrate deploy` | Apply pending migrations | ✅ **YES** |
| `npx prisma migrate dev` | Create & apply new migration | ❌ **NO** (dev only) |
| `npx prisma db push` | Push schema directly | ❌ **NO** (dev only) |
| `npx prisma generate` | Regenerate client | ✅ **YES** |
| `npx prisma migrate status` | Check migration status | ✅ **YES** |
| `npx prisma studio` | View database | ✅ **YES** |

---

## 🎯 Complete Deployment Workflow

Here's the complete workflow in one command sequence:

```bash
# 1. Check what needs to be migrated
npx prisma migrate status

# 2. Review migration SQL
cat prisma/migrations/[LATEST]/migration.sql

# 3. Create backup
./scripts/backup-database.sh

# 4. Deploy (with safety checks)
./scripts/deploy-to-production.sh

# 5. Verify
npx prisma migrate status

# 6. Restart application
pm2 restart your-app-name

# 7. Test
# (Test your application in browser)
```

---

## 📞 Need Help?

If you encounter issues:

1. **Check the error message** - Prisma provides detailed error messages
2. **Review migration SQL** - Look for syntax errors or data conflicts
3. **Check database logs** - Your database provider may have logs
4. **Restore from backup** - If all else fails, restore and try again

---

## ✅ Success Checklist

After a successful deployment, you should have:

- [ ] ✅ All migrations applied (check with `prisma migrate status`)
- [ ] ✅ Prisma client regenerated
- [ ] ✅ Application restarted
- [ ] ✅ No errors in logs
- [ ] ✅ Critical functionality tested
- [ ] ✅ Backup stored safely
- [ ] ✅ Team notified of changes

---

**Remember: When in doubt, backup first, test on staging, and review the SQL!**
