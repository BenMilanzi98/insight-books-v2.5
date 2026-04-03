-- AlterTable
ALTER TABLE "GoodsReceipt" ADD COLUMN "inventoryAppliedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "GoodsReceipt_status_inventoryAppliedAt_receiptDate_idx" ON "GoodsReceipt"("status", "inventoryAppliedAt", "receiptDate");

-- Backfill: receipts that already posted to GL had inventory applied at posting time
UPDATE "GoodsReceipt"
SET "inventoryAppliedAt" = COALESCE("postedDate", "updatedAt", "createdAt")
WHERE "journalEntryId" IS NOT NULL AND "inventoryAppliedAt" IS NULL;
