# Branch Schema (userBranches) Resolution – Research & Fix Options

## 1. What’s going wrong

- **Symptom:** Login (and sometimes session) returns **502** or Prisma logs:  
  `Unknown field 'userBranches' for select statement on model 'User'`.
- **Cause:** The **database** your app talks to (e.g. development) does **not** match the **Prisma schema** in the repo:
  - Schema expects: `User.userBranches` (relation to `UserBranch`), `User.defaultBranchId`, `Tenant.defaultBranchId`, `Tenant.ownerUserId`.
  - DB is missing: `UserBranch` table and/or those columns, so the generated Prisma client still has `userBranches` in the model, but the DB (or an older client generated from an older schema) doesn’t.

So either:

- Migrations that add these objects were **never run** on this DB, or  
- This DB is used with a **Prisma client generated from an older schema** (no `UserBranch` / branch fields).

---

## 2. What the codebase expects (schema & migrations)

- **Relevant migrations:**
  - `20260305120000_tenant_default_branch_and_user_branches`  
    - Adds `Tenant.defaultBranchId` (IF NOT EXISTS).  
    - Creates `UserBranch` and indexes/FKs.
  - `20260305130000_add_tenant_owner_user_id`  
    - Adds `Tenant.ownerUserId` (IF NOT EXISTS) and FK.
- **User.defaultBranchId** is added in an earlier migration (`20260130005512_...`).
- **Code that uses these (no change required if DB is fixed):**
  - **Login / session:** `app/api/auth/login/route.js`, `lib/auth.js` (branch selection, `initialBranchId`).
  - **Users:** `app/api/users/route.js`, `app/api/users/get/route.js`, `app/api/admin/users/route.js`, `app/api/users/update/route.js`, `app/api/admin/users/update/route.js`.
  - **Account / tenant:** `app/api/account/route.js`, `app/api/auth/me/route.js`, `app/api/auth/register/route.js`, `app/api/auth/signup/route.js`, `app/api/auth/google/callback/route.js`, `app/api/tenant/add/route.js`.
  - **Other:** `app/api/branches/migrate-data/route.js`, `app/api/stock/route.js`, `lib/branchHelpers.js`, and UI (account, users, POS, insightbooks user-management).

If the DB has the tables/columns above, all this code works as written. The only reason we added “minimal select” workarounds was to avoid querying `userBranches` (and branch fields) when the DB doesn’t have them, so login doesn’t 502.

---

## 3. Resolution options (without affecting things you don’t want to change)

### Option A – Recommended: Bring the DB in sync with the schema (migrations)

**Idea:** Run pending Prisma migrations on the environment that’s failing (e.g. development). That adds the missing table and columns. No application logic changes required; you can keep or later revert the “minimal select” workarounds.

**Steps:**

1. **Back up** the database (e.g. `pg_dump` or your host’s backup).
2. On the **same machine/environment** that runs the app (or wherever `DATABASE_URL` for that env points):
   - Set `DATABASE_URL` for that environment (e.g. development).
   - Run:
     ```bash
     npx prisma migrate deploy
     ```
   - Then:
     ```bash
     npx prisma generate
     ```
3. **Restart** the app (e.g. `pm2 restart development`).

**Effect:**

- Only **pending** migrations run (Prisma checks `_prisma_migrations`).
- Adds `UserBranch`, `Tenant.defaultBranchId`, `Tenant.ownerUserId`, and any other missing columns from existing migrations.
- Does not drop data; migrations use `ADD COLUMN IF NOT EXISTS` and create new objects.
- After this, you can **optionally** revert the “minimal select” / “do not query userBranches” workarounds in login and auth so branch behaviour (default branch, allowed branches) is full again.

**If `migrate deploy` says a migration is already applied but the table is missing** (e.g. a previous run failed halfway):

- Either:
  - Mark the migration as rolled back and re-apply it (advanced), or  
  - Run the **idempotent SQL** from the script below to create the missing objects, then use:
    ```bash
    npx prisma migrate resolve --applied "20260305120000_tenant_default_branch_and_user_branches"
    npx prisma migrate resolve --applied "20260305130000_add_tenant_owner_user_id"
    ```
    so Prisma considers them applied and doesn’t try to run them again.

---

### Option B: Keep DB as-is and keep code workarounds (no migration)

**Idea:** Don’t run migrations; keep the current “minimal select” and “do not query userBranches” logic so the app never touches missing fields.

**What’s in place now:**

- **Login** (`app/api/auth/login/route.js`): Fetches user with a minimal select (no `userBranches`, no `User.defaultBranchId`, no `Tenant.defaultBranchId` / `ownerUserId`). Sets `user.userBranches = []`, `user.defaultBranchId = null`. Branch selection uses “first branch for tenant” when there are no assigned branches.
- **Session** (`lib/auth.js`): Same idea: minimal user select, no optional extended query for `userBranches` / tenant branch fields; `user.userBranches = []`, `user.tenant = null` for branch logic.

**Effect:**

- Login and session work on DBs that don’t have `UserBranch` or the branch columns.
- **Limitations:** No per-user “allowed branches” or “default branch” from the DB; everyone effectively gets “first branch” or no branch. User management and account screens that expect `userBranches` / `defaultBranchId` may still fail or show empty if they query those fields (those routes already have try/catch fallbacks where we found them).

**When to use:** When you cannot run migrations on that DB (e.g. no access, or a shared DB where you’re not allowed to change schema). Otherwise Option A is better.

---

### Option C: Manual idempotent SQL (when migrate deploy isn’t possible or migration is “stuck”)

Use this when:

- You can’t run `prisma migrate deploy` (e.g. no CLI on the server), or  
- A migration is marked applied but the table/columns were never created.

Run the script **once** against the target DB (e.g. development). Script location: **`prisma/scripts/ensure-branch-schema.sql`** (same contents as below). It is written to be **idempotent** (safe to run multiple times): it only creates the table and columns if they don’t exist, and adds constraints only if missing. It does **not** drop or alter existing data.

After running it:

1. Run `npx prisma generate` (and restart the app) so the client matches the DB.
2. If Prisma still thinks the migrations are pending, run `migrate deploy`; it should succeed now. If Prisma thinks they’re already applied but they weren’t, use `prisma migrate resolve --applied <name>` as in Option A.

---

## 4. Idempotent SQL script (manual repair)

Save and run this against the **same database** your app uses (e.g. development). Replace `"UserBranch"` / `"Tenant"` if your DB uses different quoting.

```sql
-- Tenant: add columns if missing (safe to run multiple times)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

-- UserBranch: create table only if missing
CREATE TABLE IF NOT EXISTS "UserBranch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");
CREATE INDEX IF NOT EXISTS "UserBranch_userId_idx" ON "UserBranch"("userId");
CREATE INDEX IF NOT EXISTS "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- FKs only if missing (PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_defaultBranchId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_ownerUserId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_userId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_branchId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
```

**Note:** The repo script `prisma/scripts/ensure-branch-schema.sql` also adds `User.defaultBranchId` and its FK if missing.

---

## 5. Summary

| Approach | Effect | Risk |
|----------|--------|------|
| **A: Run migrations** | DB matches schema; full branch features; can remove workarounds. | Low if you back up first; only adds objects. |
| **B: Keep workarounds** | No DB change; login works; branch features limited. | None to DB; some features reduced. |
| **C: Manual SQL** | Same as A for the branch-related objects when migrate deploy isn’t an option. | Low if you run the idempotent script once and then run generate. |

**Recommended:** Prefer **Option A** (run `prisma migrate deploy` on development, then `prisma generate` and restart). Use **Option C** only if deploy isn’t possible or a migration is stuck. Use **Option B** only if you must not change the DB at all.

---

## 6. References in code (for reverting workarounds later)

If you fix the DB with A or C and want to restore full branch behaviour:

- **Login:** `app/api/auth/login/route.js` – restore including `userBranches`, `defaultBranchId`, and `tenant.defaultBranchId` / `tenant.ownerUserId` in the user fetch (and remove the line that sets `user.userBranches = []` / `user.defaultBranchId = null`).
- **Session:** `lib/auth.js` – restore the optional extended fetch for `userBranches` and `tenant` (ownerUserId, defaultBranchId), or switch back to a single query that includes them, and remove the line that sets `user.userBranches = []` / `user.tenant = null`.

Other routes (users, account, etc.) already use try/catch or optional fields; they should work once the DB has the table and columns.
