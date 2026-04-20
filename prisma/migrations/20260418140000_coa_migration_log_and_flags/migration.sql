-- Chart of Accounts standardization (implementation guide Phase 0)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "coaLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "coaEquityMigrationApproved" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "requiresReclassification" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "retiredAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "migratedToAccountCode" TEXT;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "acceptsNewTransactions" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Account" ADD COLUMN IF NOT EXISTS "visibleInChart" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "coa_migration_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "originalAccountId" TEXT NOT NULL,
    "originalCode" TEXT,
    "originalName" TEXT,
    "originalType" TEXT,
    "mappedToCode" TEXT,
    "mappedToName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "migratedAt" TIMESTAMP(3),
    "migrationBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coa_migration_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "coa_migration_log_tenantId_idx" ON "coa_migration_log"("tenantId");
CREATE INDEX IF NOT EXISTS "coa_migration_log_status_idx" ON "coa_migration_log"("status");
CREATE INDEX IF NOT EXISTS "coa_migration_log_migrationBatchId_idx" ON "coa_migration_log"("migrationBatchId");
CREATE INDEX IF NOT EXISTS "coa_migration_log_originalAccountId_idx" ON "coa_migration_log"("originalAccountId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coa_migration_log_tenantId_fkey'
  ) THEN
    ALTER TABLE "coa_migration_log" ADD CONSTRAINT "coa_migration_log_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'coa_migration_log_originalAccountId_fkey'
  ) THEN
    ALTER TABLE "coa_migration_log" ADD CONSTRAINT "coa_migration_log_originalAccountId_fkey"
      FOREIGN KEY ("originalAccountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
