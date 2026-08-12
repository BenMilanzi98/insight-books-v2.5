-- AlterTable
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "tillFloatAccountId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "openFundingJournalId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "closeSweepJournalId" TEXT;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "fundingCashAmount" DOUBLE PRECISION;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "fundingCapitalAmount" DOUBLE PRECISION;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "openCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "PosCashDay" ADD COLUMN IF NOT EXISTS "reopenedAt" TIMESTAMP(3);

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "PosCashDay"
    ADD CONSTRAINT "PosCashDay_tillFloatAccountId_fkey"
    FOREIGN KEY ("tillFloatAccountId") REFERENCES "PaymentAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "PosCashDay_tillFloatAccountId_idx" ON "PosCashDay"("tillFloatAccountId");
