-- Payment WHT / cash-received columns (invoice partial payments).
-- Additive only — safe if columns already exist from an earlier db push.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "cashReceivedAmount" DECIMAL(18,2);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "withholdingAmount" DECIMAL(18,2);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "withholdingPercent" DECIMAL(8,4);
