#!/usr/bin/env bash
# Repair schema drift on VPS when migrate status says "up to date" but columns/tables are missing.
# Run from project root as a user that can connect to DATABASE_URL.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> prisma migrate deploy"
npx prisma migrate deploy

echo "==> prisma generate"
npx prisma generate

echo "==> Verify critical columns"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'Sale' AND column_name = 'isReversal';

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'SaleItem' AND column_name = 'accountId';

SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'AccountingPeriod';
SQL

echo "Done. Rebuild and restart: npm run build && pm2 restart development insightbooks --update-env"
