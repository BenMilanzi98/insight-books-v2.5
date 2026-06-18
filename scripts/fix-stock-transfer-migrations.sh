#!/usr/bin/env bash
# Repair failed StockTransfer Prisma migrations on production (fresh DB safe).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# Load DATABASE_URL without sourcing .env (avoids merge-conflict / bash syntax issues).
if [ -z "${DATABASE_URL:-}" ] && [ -f .env ]; then
  DATABASE_URL="$(
    grep -E '^[[:space:]]*DATABASE_URL=' .env \
      | grep -v '^[[:space:]]*#' \
      | tail -1 \
      | cut -d= -f2- \
      | tr -d '"' \
      | tr -d "'"
  )"
  export DATABASE_URL
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set (.env or environment)"
  exit 1
fi

DB_NAME="${DATABASE_URL##*/}"
DB_NAME="${DB_NAME%%\?*}"
PG_SUPERUSER="${PG_SUPERUSER:-postgres}"

echo "==> Database: $DB_NAME"
echo "==> Prisma user from DATABASE_URL will run migrations after cleanup."
echo ""

echo "==> Drop StockTransfer tables owned by wrong role (requires postgres superuser)..."
if command -v sudo >/dev/null 2>&1; then
  sudo -u "$PG_SUPERUSER" psql -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS "StockTransferReceiptNotice" CASCADE;
DROP TABLE IF EXISTS "StockTransfer" CASCADE;
SQL
else
  psql -U "$PG_SUPERUSER" -d "$DB_NAME" -v ON_ERROR_STOP=1 <<'SQL'
DROP TABLE IF EXISTS "StockTransferReceiptNotice" CASCADE;
DROP TABLE IF EXISTS "StockTransfer" CASCADE;
SQL
fi

echo ""
echo "==> Clear failed migration records..."
npx prisma migrate resolve --rolled-back 20260331215000_create_stock_transfer 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260331220000_stock_transfer_received_rejected 2>/dev/null || true

echo ""
echo "==> Apply all pending migrations..."
npx prisma migrate deploy

echo ""
echo "==> Status:"
npx prisma migrate status

echo ""
echo "Done."
