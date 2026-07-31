# Production Database Migration Guide

## ⚠️ CRITICAL: Always Backup First!

Before making any changes to production, **ALWAYS backup your database**.

## Step-by-Step Safe Migration Process

### ⚠️ CRITICAL: Follow These Steps in Order!

### Step 0: **Check What Migrations Are Pending**

```bash
# Run the safety checklist script
./scripts/safe-migration-checklist.sh

# This will:
# - Show pending migrations
# - Check for dangerous operations (DROP, DELETE, etc.)
# - Warn you if data loss is possible
```

### 1. **Backup Your Production Database** (MANDATORY)

```bash
# Use the backup script (automatically reads from .env)
./scripts/backup-database.sh

# OR manually:
# The script loads DATABASE_URL from .env automatically
# Or set it manually:
# export DATABASE_URL="your_production_database_url"
# pg_dump "$DATABASE_URL" -F c -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2. **Create Migration Locally** (Development)

```bash
# Make sure your local schema.prisma is up to date
# Then create a migration
npx prisma migrate dev --name descriptive_migration_name

# This will:
# - Create a new migration file in prisma/migrations/
# - Apply it to your local database
# - Generate the Prisma client
```

### 3. **Review the Migration SQL**

**CRITICAL**: Always review the generated SQL before applying to production!

```bash
# View the latest migration SQL
cat prisma/migrations/[LATEST_MIGRATION_FOLDER]/migration.sql
```

**Check for:**
- ❌ `DROP TABLE` or `DROP COLUMN` (data loss!)
- ❌ `ALTER COLUMN` with type changes (may cause data loss)
- ❌ `DELETE FROM` statements
- ✅ `ADD COLUMN` with defaults (safe)
- ✅ `CREATE TABLE` (safe)
- ✅ `CREATE INDEX` (safe)

### 4. **Test Migration on Staging** (If Available)

If you have a staging environment that mirrors production:

```bash
# Set DATABASE_URL to staging database
export DATABASE_URL="your_staging_database_url"

# Apply migration to staging
npx prisma migrate deploy

# Test your application thoroughly
```

### 5. **Apply Migration to Production**

#### Option A: Using the Deployment Script (Recommended - Safest)

```bash
# Step 1: Run safety checklist first
./scripts/safe-migration-checklist.sh

# Step 2: If checklist passes, create backup
./scripts/backup-database.sh

# Step 3: Deploy migrations (script has safety checks)
./scripts/deploy-to-production.sh
```

#### Option B: Manual Deployment (If you need more control)

```bash
# 1. Check status
npx prisma migrate status

# 2. Review pending migrations
# Look at each migration SQL file in prisma/migrations/

# 3. Apply migrations
npx prisma migrate deploy

# 4. Generate Prisma client
npx prisma generate
```

# This will:
# - Check which migrations haven't been applied
# - Apply only the pending migrations
# - NOT create new migrations (safe for production)
```

#### Option B: Manual SQL Execution (For Complex Migrations)

```bash
# 1. Generate the migration SQL
npx prisma migrate dev --create-only --name migration_name

# 2. Review the SQL file
cat prisma/migrations/[MIGRATION_FOLDER]/migration.sql

# 3. Connect to production database and run SQL manually
psql "YOUR_PRODUCTION_DATABASE_URL" -f prisma/migrations/[MIGRATION_FOLDER]/migration.sql

# 4. Mark migration as applied (so Prisma knows it's done)
npx prisma migrate resolve --applied migration_name
```

### 6. **Update Prisma Client on Production**

After migration, regenerate Prisma client:

```bash
npx prisma generate
```

### 7. **Restart Your Application**

```bash
# Restart your Next.js application to use the new Prisma client
pm2 restart your-app-name
# or
systemctl restart your-service
# or whatever process manager you use
```

## Safe Migration Checklist

- [ ] ✅ Database backup created
- [ ] ✅ Migration SQL reviewed
- [ ] ✅ Tested on staging (if available)
- [ ] ✅ Production maintenance window scheduled (if needed)
- [ ] ✅ Rollback plan prepared
- [ ] ✅ Team notified
- [ ] ✅ Migration applied
- [ ] ✅ Application tested after migration
- [ ] ✅ Monitoring for errors

## Common Safe Operations

These operations are generally safe and won't cause data loss:

- ✅ Adding new tables
- ✅ Adding new columns (with defaults)
- ✅ Adding indexes
- ✅ Adding foreign keys (if data is valid)
- ✅ Creating new relations

## Dangerous Operations (Require Extra Care)

These operations can cause data loss - handle with extreme caution:

- ⚠️ Dropping tables or columns
- ⚠️ Changing column types
- ⚠️ Removing NOT NULL constraints
- ⚠️ Renaming columns (use multiple steps)
- ⚠️ Changing primary keys

## Rollback Plan

If something goes wrong:

1. **Stop the application immediately**
2. **Restore from backup:**
   ```bash
   pg_restore -h YOUR_DB_HOST -U YOUR_DB_USER -d YOUR_DB_NAME -c backup_file.dump
   ```
3. **Revert code changes** (git revert)
4. **Restart application**

## Quick Reference Commands

```bash
# Backup database (reads from .env automatically)
./scripts/backup-database.sh

# Deploy migrations to production (reads from .env automatically)
./scripts/deploy-to-production.sh

# Check migration status
npx prisma migrate status

# Create new migration (development only)
npx prisma migrate dev --name migration_name

# Apply migrations to production (manual)
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# View database in browser
npx prisma studio
```

**Note:** The scripts automatically load `DATABASE_URL` from your `.env` file, so you don't need to set it manually.

## Important Notes

1. **Never use `prisma migrate dev` on production** - it creates new migrations
2. **Always use `prisma migrate deploy` on production** - only applies existing migrations
3. **Always backup first** - no exceptions
4. **Review SQL before applying** - understand what will happen
5. **Test on staging first** - if possible

## For Your Current Changes

Since you've made changes to the code (API routes, etc.) but the schema hasn't changed, you only need to:

1. Deploy your code changes (git push, etc.)
2. Restart your application
3. No database migration needed!

If you've made schema changes (new models, new fields), follow the full process above.

