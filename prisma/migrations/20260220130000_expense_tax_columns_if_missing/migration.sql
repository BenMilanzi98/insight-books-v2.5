-- Add Expense tax columns if missing (idempotent; safe when migrations were skipped or DB out of sync)
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "taxAmount" DOUBLE PRECISION DEFAULT 0;
ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "taxRate" DOUBLE PRECISION DEFAULT 0;
