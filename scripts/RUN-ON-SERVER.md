# Scripts to run on the server (to resolve 500 / deployment issues)

Run these **on the deployment server** from the project root. Ensure `.env` has `DATABASE_URL` (and `NEXTAUTH_SECRET`, `NEXTAUTH_URL` if the app uses them) before starting.

---

## 1. Diagnose (find the cause of 500s)

| Script | Purpose |
|--------|--------|
| `./scripts/diagnose-db-connection.sh` | Check DB connectivity and Prisma; confirms `DATABASE_URL` and that the app can reach the database. **Run this first.** |
| `node scripts/diagnose-access.js` | List users, tenants, and subscriptions; shows "NO SUBSCRIPTION" or expired trial (which can cause 403/500 via `requireStandardAccess`). |

**From project root:**
```bash
cd /path/to/insight-books-v2.0   # your project root
./scripts/diagnose-db-connection.sh
node scripts/diagnose-access.js
```

---

## 2. Database: migrations and schema

If the DB is unreachable, fix `DATABASE_URL` and connectivity first, then:

| Script | Purpose |
|--------|--------|
| `./scripts/safe-deploy-production.sh` | **Preferred.** Backs up DB, runs safety checks, then `prisma migrate deploy` + `prisma generate`. Use for normal production deploys. |
| **OR** `./scripts/deploy-to-production.sh` | Simpler: only runs `prisma migrate status`, then `prisma migrate deploy` and `prisma generate` (with confirmations). No backup. |
| `./scripts/fix-failed-migration.sh` | Only if a migration previously failed (e.g. `20240204_add_reversal_fields`). Marks it rolled back so you can re-run deploy. |
| `./scripts/create-new-tables.sh` | If you need extra HR/payroll tables and they are not in Prisma migrations. Run after migrations. |
| `./scripts/create-hr-tables-production.sh` | Same idea for HR tables on production; run if your deploy checklist says so. |

**Typical order:**
```bash
./scripts/diagnose-db-connection.sh    # must pass first
./scripts/safe-deploy-production.sh   # backup + migrate + generate
# If a specific migration failed:
# ./scripts/fix-failed-migration.sh
# then again: ./scripts/safe-deploy-production.sh or ./scripts/deploy-to-production.sh
```

**If the backup step fails:** The script now prints the actual `pg_dump` error. Common causes:
- **`pg_dump` not found** → install the PostgreSQL client: `apt install postgresql-client` (or equivalent).
- **Connection refused / could not connect** → PostgreSQL not running or wrong host/port in `.env`; run `./scripts/diagnose-db-connection.sh`.
- **Authentication failed** → wrong user/password in `DATABASE_URL` in `.env`.

If you have no pending migrations and don’t need a backup for this run, you can use **`./scripts/deploy-to-production.sh`** instead (it skips the backup step).

---

## 3. Subscriptions and access (fix 403 / 500 from access control)

APIs use `requireStandardAccess`, which needs a valid subscription. If `diagnose-access.js` shows missing or bad subscriptions:

| Script | Purpose |
|--------|--------|
| `node scripts/check-all-subscriptions.js` | List subscriptions and flag bad data (e.g. trial-like txRef with isTrial=false). |
| `node scripts/fix-all-subscriptions.js` | Fix subscriptions that have trial-like txRef but isTrial=false (removes 403/500 from subscription checks). |
| `node scripts/initialize-trial.js <tenantId>` | Create a **3-day** trial for a tenant. Get `tenantId` from Prisma Studio or DB. |
| `node scripts/activate-5day-trial.js <tenantId>` | Create/activate a **5-day** trial for a tenant (deactivates existing subscription first). |
| `node scripts/activate-branch-subscription.js` | Activate branch-level subscription; run if your setup uses branches. |
| `node scripts/fix-subscription-data.js` | Fix subscription data issues; run if check/fix scripts or docs say so. |

**Typical order after migrations:**
```bash
node scripts/check-all-subscriptions.js
# If issues reported:
node scripts/fix-all-subscriptions.js
# If a tenant has no subscription (e.g. new deploy):
node scripts/initialize-trial.js <tenantId>
# Or 5-day trial:
node scripts/activate-5day-trial.js <tenantId>
```

---

## 4. Admin / first user

If no one can log in (e.g. first deploy or lost admin):

| Script | Purpose |
|--------|--------|
| `node scripts/create-admin-user.js <email> <name> <password>` | Create an admin user (and default tenant if none). Example: `node scripts/create-admin-user.js admin@example.com "Admin" yourPassword` |
| `node scripts/create-admin.js` | Alternative admin creation; check script for usage. |
| `node scripts/update-production-admin.js` | Update production admin (see script for args). |
| `node scripts/reset-admin-password.js` | Reset admin password (see script for usage). |

**Example:**
```bash
node scripts/create-admin-user.js admin@yourdomain.com "Admin" "SecurePassword"
```

---

## 5. Optional: backup only

| Script | Purpose |
|--------|--------|
| `./scripts/backup-database.sh` | Create a timestamped DB backup. Safe to run anytime; used automatically by `safe-deploy-production.sh`. |

---

## 6. After running scripts

1. **Restart the app** on the server (e.g. `pm2 restart all`, or your process manager).
2. **Confirm env** on the server: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`.
3. **Test**: log in, open a page that used to 500 (e.g. Invoices, Clients, Accounts). If it still 500s, check server logs (Node/PM2) for the real error (DB, auth, or subscription).

---

## 7. Browser console: what to ignore

These messages in the **browser** console are **not from the app** — you can ignore them:

| Message / file | Source |
|----------------|--------|
| `Ex.js` (version, `all_funcdisable`, etc.) | Browser extension |
| `FingerPrint.js` (“has get the FIngerPrintSwitch”) | Browser extension |
| `Error handling response: ... indexOf` in `chrome-extension://.../adblock/.../counter.js` | Adblock (or similar) extension |

The **real** problem is when your **app’s API** returns **500**, e.g.:

- `GET .../api/purchases/suppliers?` → 500  
- `GET .../api/tax-types` → 500  
- `GET .../api/tax-accounts/balances` → 500  

Those 500s are **server-side**. Fix them by:

1. **Checking server logs** (e.g. `pm2 logs` or Node stdout) for the actual exception (Prisma, DB, auth, or subscription).
2. **Running the scripts** in sections 1–3 (diagnose DB, diagnose access, deploy, fix subscriptions), then **restarting the app**.
3. If the log says **subscription** or **access denied**, run the subscription scripts (e.g. `activate-5day-trial.js` for your tenant) as in section 3.

---

## Quick “run all” order (resolves most 500s)

Run from **project root**:

```bash
# 1. Diagnose
./scripts/diagnose-db-connection.sh
node scripts/diagnose-access.js

# 2. Deploy DB (backup + migrate + generate)
./scripts/safe-deploy-production.sh

# 3. Subscriptions (if diagnose-access showed issues)
node scripts/check-all-subscriptions.js
node scripts/fix-all-subscriptions.js
# For each tenant that has no subscription (get tenantId from DB/Prisma Studio):
# node scripts/activate-5day-trial.js <tenantId>

# 4. Admin (only if no user can log in)
# node scripts/create-admin-user.js admin@example.com "Admin" "YourPassword"

# 5. Restart app
# pm2 restart all   # or your restart command
```

---

## Other scripts (use when needed)

- **Data/validation:** `validate-expense-categories.js`, `validate-data-integrity.js`, `quick-validation.js`, `audit-account-references.js`
- **Restore/backup:** `restore-from-backup.sh`, `convert-and-restore-backup.sh`, `restore-with-docker.sh`
- **Diagnostics:** `diagnose-subscription.js`, `check-subscription.js`, `test-access-with-bad-data.js`
- **Migrations/data fixes:** `migrate-add-accountid-to-invoiceitems.js`, `run-accountid-migration.js`, `migrate-payment-accounts.js`, `initialize-payment-accounts.js`
- **Prep:** `prepare-git-push.sh`, `dockerize-project.sh`

Use these when you’re fixing a specific issue (e.g. subscriptions, account IDs, backups) as per their comments or docs.
