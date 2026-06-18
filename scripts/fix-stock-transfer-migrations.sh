#!/usr/bin/env bash
# Repair failed StockTransfer Prisma migrations on production (fresh DB safe).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL not set (.env or environment)"
  exit 1
fi

echo "==> Failed stock-transfer migrations in DB:"
psql "$DATABASE_URL" -c "
  SELECT migration_name, started_at, finished_at, rolled_back_at,
         LEFT(logs, 200) AS logs_preview
  FROM \"_prisma_migrations\"
  WHERE migration_name LIKE '%stock_transfer%'
     OR (finished_at IS NULL AND rolled_back_at IS NULL)
  ORDER BY started_at;
" || true

echo ""
echo "==> Mark failed migrations as rolled back (safe; no data drop)..."
npx prisma migrate resolve --rolled-back 20260331215000_create_stock_transfer 2>/dev/null || true
npx prisma migrate resolve --rolled-back 20260331220000_stock_transfer_received_rejected 2>/dev/null || true

echo ""
echo "==> Ensure StockTransfer base table exists (idempotent)..."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS "StockTransfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockTransfer_tenantId_idx" ON "StockTransfer"("tenantId");
CREATE INDEX IF NOT EXISTS "StockTransfer_fromBranchId_idx" ON "StockTransfer"("fromBranchId");
CREATE INDEX IF NOT EXISTS "StockTransfer_toBranchId_idx" ON "StockTransfer"("toBranchId");
CREATE INDEX IF NOT EXISTS "StockTransfer_productId_idx" ON "StockTransfer"("productId");
CREATE INDEX IF NOT EXISTS "StockTransfer_status_idx" ON "StockTransfer"("status");
CREATE INDEX IF NOT EXISTS "StockTransfer_createdById_idx" ON "StockTransfer"("createdById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_tenantId_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_fromBranchId_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromBranchId_fkey"
      FOREIGN KEY ("fromBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_toBranchId_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toBranchId_fkey"
      FOREIGN KEY ("toBranchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_productId_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_createdById_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_approvedById_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "receivedById" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "receivedAt" TIMESTAMP(3);
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectedById" TEXT;
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);
ALTER TABLE "StockTransfer" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

CREATE INDEX IF NOT EXISTS "StockTransfer_receivedById_idx" ON "StockTransfer"("receivedById");
CREATE INDEX IF NOT EXISTS "StockTransfer_rejectedById_idx" ON "StockTransfer"("rejectedById");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_receivedById_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedById_fkey"
      FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransfer_rejectedById_fkey') THEN
    ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_rejectedById_fkey"
      FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
SQL

echo ""
echo "==> Mark stock-transfer migrations as applied..."
npx prisma migrate resolve --applied 20260331215000_create_stock_transfer
npx prisma migrate resolve --applied 20260331220000_stock_transfer_received_rejected

echo ""
echo "==> Deploy remaining migrations..."
npx prisma migrate deploy

echo ""
echo "==> Status:"
npx prisma migrate status

echo ""
echo "Done."
