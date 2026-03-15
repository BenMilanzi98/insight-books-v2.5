#!/usr/bin/env bash
# Run this after: supabase start
# Pushes all Prisma migrations to the local Supabase Postgres (port 54322).

set -e
cd "$(dirname "$0")/.."

SUPABASE_DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public"

echo "Using Supabase DB at 127.0.0.1:54322..."
export DATABASE_URL="$SUPABASE_DB_URL"
npx prisma migrate deploy
echo "Done. Set DATABASE_URL in your .env to the same URL to use Supabase for the app."
