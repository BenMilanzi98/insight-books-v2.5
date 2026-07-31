-- Store COA used at hire accrual so supplier bill finalize can auto-clear
ALTER TABLE "HireAccrual" ADD COLUMN IF NOT EXISTS "expenseAccountId" TEXT;
ALTER TABLE "HireAccrual" ADD COLUMN IF NOT EXISTS "accruedLiabilityAccountId" TEXT;
