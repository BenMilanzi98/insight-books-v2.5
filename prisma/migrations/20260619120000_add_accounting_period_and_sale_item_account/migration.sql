-- AccountingPeriod was in schema.prisma but never had a migration on some deployments.
CREATE TABLE IF NOT EXISTS "AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "reopenReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_periodType_startDate_key"
    ON "AccountingPeriod"("tenantId", "periodType", "startDate");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_tenantId_idx" ON "AccountingPeriod"("tenantId");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_startDate_endDate_idx" ON "AccountingPeriod"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "AccountingPeriod_status_idx" ON "AccountingPeriod"("status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_tenantId_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_closedById_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AccountingPeriod_reopenedById_fkey'
  ) THEN
    ALTER TABLE "AccountingPeriod"
      ADD CONSTRAINT "AccountingPeriod_reopenedById_fkey"
      FOREIGN KEY ("reopenedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Per-line revenue account on sale items (schema field was missing from DB on some deployments).
ALTER TABLE "SaleItem" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

CREATE INDEX IF NOT EXISTS "SaleItem_accountId_idx" ON "SaleItem"("accountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SaleItem_accountId_fkey'
  ) THEN
    ALTER TABLE "SaleItem"
      ADD CONSTRAINT "SaleItem_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
