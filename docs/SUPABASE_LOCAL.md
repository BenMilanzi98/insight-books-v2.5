# Connect InsightBooks to Supabase (local)

Use your **local** Supabase Postgres (e.g. from `supabase start`) as the app database and apply all Prisma migrations.

## 1. Start Supabase (if not already)

```bash
supabase start
```

Note the **Database** URL, e.g.:

`postgresql://postgres:postgres@127.0.0.1:54322/postgres`

## 2. Push all Prisma migrations to Supabase

From the project root:

```bash
# Option A: use the script
chmod +x scripts/supabase-migrate.sh
./scripts/supabase-migrate.sh

# Option B: run manually
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public" npx prisma migrate deploy
```

This applies every migration in `prisma/migrations/` and creates all tables in the Supabase Postgres database.

## 3. Point the app at Supabase

In your **`.env`** (project root), set:

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"
```

Leave all other variables unchanged. Restart the Next.js app so it uses the new `DATABASE_URL`.

## 4. Regenerate Prisma client (optional)

If you switch DB often:

```bash
npx prisma generate
```

## Supabase Studio

Open **http://127.0.0.1:54323** to inspect tables and data in Supabase Studio.

## Supabase cloud

For a **hosted** Supabase project:

1. In [Supabase Dashboard](https://supabase.com/dashboard) → your project → **Settings** → **Database**, copy the **Connection string** (URI).
2. Set in `.env`:
   ```env
   DATABASE_URL="postgresql://postgres.[ref]:[YOUR-PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres?pgbouncer=true"
   ```
3. Run migrations against that DB:
   ```bash
   DATABASE_URL="<paste-connection-string>" npx prisma migrate deploy
   ```

Use the **direct** connection (port 5432 or 6543, see Supabase docs) for running migrations if they recommend it.
