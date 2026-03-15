#!/usr/bin/env bash
# 1. Drops public schema in Supabase (removes tables from migrate deploy)
# 2. Restores insightbooks_backup_March_13.dump into a clean database
set -e
cd "$(dirname "$0")/.."

SUPABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
DUMP="${1:-insightbooks_backup_March_13.dump}"

if [[ ! -f "$DUMP" ]]; then
  echo "Dump file not found: $DUMP"
  exit 1
fi

echo "Dropping and recreating public schema on Supabase..."
psql "$SUPABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
SQL

echo "Restoring $DUMP..."
pg_restore -d "$SUPABASE_URL" --no-owner --no-acl "$DUMP" 2>&1 || true

echo "Done. Check for errors above; data-only errors are often safe to ignore after a full restore."
