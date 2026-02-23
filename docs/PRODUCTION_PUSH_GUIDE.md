# Production Push Guide — Database Changes Without Losing Data

This guide covers deploying **code and database schema changes** to production with **zero data loss**. Follow the steps in order.

---

## Prerequisites (on the production server)

- **Node.js 18+** and **npm** (or your runtime)
- **PostgreSQL client tools** for backup/restore: `pg_dump` and `pg_restore`  
  - Install if missing: `apt install postgresql-client` (Debian/Ubuntu) or equivalent
- **`.env`** on the server with at least:
  - `DATABASE_URL` — production PostgreSQL URL (e.g. `postgresql://user:password@host:5432/insightbooks?schema=public`)
  - `NEXTAUTH_SECRET`, `NEXTAUTH_URL` if the app uses NextAuth

---

## Quick reference (recommended path)

From the **project root** on the production server:

```bash
# 1. Ensure .env and DATABASE_URL are set
cd /path/to/insight-books-v2.0
source .env 2>/dev/null || true   # if you export vars from .env

# 2. One-command safe deploy (backup + migrate + generate)
./scripts/safe-deploy-production.sh
# When prompted, type: yes

# 3. Restart the application
pm2 restart all
# OR: systemctl restart your-app-service
# OR: docker compose up -d --build
```

The script will:

1. Load `DATABASE_URL` from `.env`
2. Ask for confirmation
3. Check migration status
4. Run the safety checklist (if present)
5. **Create a full database backup** (required)
6. Show pending migrations and ask again
7. Run **`prisma migrate deploy`** (applies only pending migrations; does not create new ones)
8. Run **`prisma generate`**
9. Show verification steps

---

## Step-by-step (manual, same result)

If you prefer to run each step yourself or the script is not available:

### Step 1: Backup the database (mandatory)

**Never skip this.** If a migration fails or causes issues, you restore from this backup.

```bash
cd /path/to/insight-books-v2.0

# Option A: Use the backup script (recommended)
./scripts/backup-database.sh
# Backup is saved as: backups/backup_YYYYMMDD_HHMMSS.dump

# Option B: Manual backup
mkdir -p backups
export DATABASE_URL="your_production_DATABASE_URL_from_env"
# Strip ?schema= for pg_dump if your client needs it
DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')
pg_dump "$DB_URL" -F c -f backups/production_backup_$(date +%Y%m%d_%H%M%S).dump
```

Verify the file exists and size is reasonable:

```bash
ls -lh backups/ | tail -5
```

---

### Step 2: Check what will be applied

```bash
npx prisma migrate status
```

- **"Database schema is up to date"** → No pending migrations; you can still run deploy (it will do nothing) and then deploy app code only.
- **"X migration(s) pending"** → Those will be applied in the next step.

(Optional) Review SQL for pending migrations:

```bash
# List pending migration folders, then inspect
cat prisma/migrations/<MIGRATION_FOLDER_NAME>/migration.sql | head -80
```

Avoid applying migrations that contain **DROP TABLE**, **DROP COLUMN**, or **DELETE FROM** unless you have explicitly approved them.

---

### Step 3: Apply migrations (no data loss by design)

Use **only** `prisma migrate deploy` on production. It applies **existing** migration files and does **not** create new ones or reset data.

```bash
npx prisma migrate deploy
```

- This applies every migration that is **not** yet in the `_prisma_migrations` table.
- Existing data is preserved; migrations should only **add** tables/columns/indexes or alter in additive ways.

If the command fails:

- Do **not** run `prisma migrate dev` or `prisma db push` on production.
- Note the error, then see [Rollback](#rollback) below.

---

### Step 4: Regenerate Prisma client

```bash
npx prisma generate
```

Required so the running app uses the updated schema.

---

### Step 5: Deploy application code and restart

Deploy your Next.js build (or image) as you normally do, then restart the process so it loads the new client and code:

```bash
# Examples:
npm run build && pm2 restart all
# or
systemctl restart insight-books
# or
docker compose up -d --build
```

---

### Step 6: Verify

```bash
npx prisma migrate status
# Should report schema up to date.

node scripts/verify-system.js
# Optional: runs schema validate, DB connectivity, and route checks.
```

Test in the browser: login, create an invoice, run a report, etc.

---

## Rollback (if something goes wrong)

Use this only if a migration or deploy caused a critical issue and you need to revert the **database** to the state before the deploy.

1. **Stop the application** (so nothing writes to the DB).
2. **Restore from the backup** you created in Step 1:

   ```bash
   export DATABASE_URL="your_production_DATABASE_URL"
   DB_URL=$(echo "$DATABASE_URL" | sed 's/?schema=[^&]*//')
   pg_restore -d "$DB_URL" --clean --if-exists --no-owner --no-acl backups/backup_YYYYMMDD_HHMMSS.dump
   ```
   Use the actual backup filename you created. `--clean --if-exists` drops objects before restoring, so the DB is reverted to the backup state.

3. **Fix the migration or data** (in dev/staging), then try again:
   - Fix the migration SQL or add a new corrective migration in development.
   - Run `prisma migrate dev` locally to create/apply the fix.
   - Copy the new migration folder to production and run **Step 2–5** again (with a **new** backup first).

4. **Restart the application** (and consider deploying the previous app version if you had already deployed new code).

---

## Important rules

| Do | Don’t |
|----|--------|
| Always **backup** before `migrate deploy` | Never run **`prisma migrate dev`** on production (it creates new migrations) |
| Use **`prisma migrate deploy`** to apply migrations | Never run **`prisma db push`** on production (can cause data loss) |
| Use **`prisma generate`** after migrations | Don’t skip the backup step |
| Test critical flows after deploy | Don’t alter or delete migration files that have already been applied in production |

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| **`pg_dump: command not found`** | Install PostgreSQL client: `apt install postgresql-client` (or equivalent). |
| **`DATABASE_URL` not found** | Ensure `.env` exists in the project root and contains `DATABASE_URL=...`. |
| **Connection refused / authentication failed** | Check host, port, user, password, and (if required) `?sslmode=require` in `DATABASE_URL`. Run `./scripts/diagnose-db-connection.sh` if available. |
| **P3005: "The database schema is not empty"** | Your DB has tables but no Prisma migration history (e.g. restored from backup). **Baseline** the DB: run `./scripts/baseline-production-migrations.sh` once. It marks all existing migrations as applied without running SQL. After that, `npx prisma migrate deploy` will report "up to date" and future deploys work normally. Only run the baseline script when the DB schema already matches the migrations. |
| **Migration failed (e.g. column already exists)** | Do not re-run deploy blindly. Check the migration SQL; you may need to mark it as applied: `npx prisma migrate resolve --applied <migration_name>`, or fix the migration and redeploy. Prefer fixing in dev and adding a new migration. |
| **"Migration not found" or history mismatch** | Use with care: `npx prisma migrate resolve --applied <migration_name>` or `--rolled-back` only if you understand the state. Prefer restoring from backup and fixing migrations in dev. |

---

## Summary checklist

- [ ] Server has Node.js, PostgreSQL client (`pg_dump`/`pg_restore`), and correct `.env` (including `DATABASE_URL`).
- [ ] **Backup created** (e.g. `./scripts/backup-database.sh` or manual `pg_dump`).
- [ ] **`npx prisma migrate deploy`** run (and succeeded).
- [ ] **`npx prisma generate`** run.
- [ ] Application code deployed and process **restarted**.
- [ ] **Verification**: `npx prisma migrate status` and smoke tests (login, invoice, report).

Following this guide and **always backing up before `migrate deploy`** keeps production database changes under control and avoids data loss.
