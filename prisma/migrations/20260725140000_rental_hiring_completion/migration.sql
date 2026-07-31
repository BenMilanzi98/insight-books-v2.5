-- Rental/hiring completion: hire accrual clear fields + legacy booking gate

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "rentalLegacyBookingEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "HireAccrual" ADD COLUMN IF NOT EXISTS "supplierBillId" TEXT;
ALTER TABLE "HireAccrual" ADD COLUMN IF NOT EXISTS "clearedJournalId" TEXT;
ALTER TABLE "HireAccrual" ADD COLUMN IF NOT EXISTS "clearedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "HireAccrual_supplierBillId_idx" ON "HireAccrual"("supplierBillId");
CREATE INDEX IF NOT EXISTS "HireAccrual_status_idx" ON "HireAccrual"("status");
