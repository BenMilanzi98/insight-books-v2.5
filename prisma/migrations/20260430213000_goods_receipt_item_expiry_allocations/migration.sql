-- Add JSON column for per-line multi-expiry receiving allocations
ALTER TABLE "GoodsReceiptItem"
ADD COLUMN IF NOT EXISTS "expiryAllocations" JSONB;
