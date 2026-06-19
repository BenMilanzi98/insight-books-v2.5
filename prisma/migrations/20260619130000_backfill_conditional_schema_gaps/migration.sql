-- Backfill schema gaps from migrations that ran before dependent tables existed.
-- Safe to re-run (IF NOT EXISTS / conditional FKs).

-- =============================================================================
-- Sale reversal fields (20240204_add_reversal_fields skipped when Sale did not exist)
-- =============================================================================
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;

CREATE INDEX IF NOT EXISTS "Sale_isReversal_idx" ON "Sale"("isReversal");
CREATE INDEX IF NOT EXISTS "Sale_reversedTransactionId_idx" ON "Sale"("reversedTransactionId");

-- =============================================================================
-- SupplierPayment reversal fields (same early-migration gap)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'SupplierPayment'
  ) THEN
    ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "isReversal" BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedTransactionId" TEXT;
    ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversalReason" TEXT;
    ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedAt" TIMESTAMP(3);
    ALTER TABLE "SupplierPayment" ADD COLUMN IF NOT EXISTS "reversedById" TEXT;
    CREATE INDEX IF NOT EXISTS "SupplierPayment_isReversal_idx" ON "SupplierPayment"("isReversal");
    CREATE INDEX IF NOT EXISTS "SupplierPayment_reversedTransactionId_idx" ON "SupplierPayment"("reversedTransactionId");
  END IF;
END $$;

-- =============================================================================
-- POS cash day register (may be missing if 20260406180000 was not applied)
-- =============================================================================
CREATE TABLE IF NOT EXISTS "PosCashDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchKey" TEXT NOT NULL DEFAULT 'none',
    "businessDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "systemCashAccountId" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "totalSalesAtClose" DOUBLE PRECISION,
    "closingBalanceAtClose" DOUBLE PRECISION,
    "totalCashSalesSnapshot" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PosCashDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PosCashDayDeposit" (
    "id" TEXT NOT NULL,
    "posCashDayId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isAutoSweep" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    CONSTRAINT "PosCashDayDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PosCashDay_tenantId_branchKey_businessDate_key"
    ON "PosCashDay"("tenantId", "branchKey", "businessDate");
CREATE INDEX IF NOT EXISTS "PosCashDay_tenantId_businessDate_idx" ON "PosCashDay"("tenantId", "businessDate");
CREATE INDEX IF NOT EXISTS "PosCashDay_status_idx" ON "PosCashDay"("status");
CREATE INDEX IF NOT EXISTS "PosCashDayDeposit_posCashDayId_idx" ON "PosCashDayDeposit"("posCashDayId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDay_tenantId_fkey') THEN
    ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDay_systemCashAccountId_fkey') THEN
    ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_systemCashAccountId_fkey"
      FOREIGN KEY ("systemCashAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDay_openedById_fkey') THEN
    ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_openedById_fkey"
      FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDay_closedById_fkey') THEN
    ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_closedById_fkey"
      FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDayDeposit_posCashDayId_fkey') THEN
    ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_posCashDayId_fkey"
      FOREIGN KEY ("posCashDayId") REFERENCES "PosCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDayDeposit_toAccountId_fkey') THEN
    ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_toAccountId_fkey"
      FOREIGN KEY ("toAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PosCashDayDeposit_createdById_fkey') THEN
    ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- POS tender/change columns (guarded for partial deploys)
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "posAmountTendered" DECIMAL(18,2);
ALTER TABLE "Sale" ADD COLUMN IF NOT EXISTS "posChangeGiven" DECIMAL(18,2);
