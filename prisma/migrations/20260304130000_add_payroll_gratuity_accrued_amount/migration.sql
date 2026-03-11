-- Add gratuityAccruedAmount to Payroll (used for payroll reversal)
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "gratuityAccruedAmount" DOUBLE PRECISION DEFAULT 0;
