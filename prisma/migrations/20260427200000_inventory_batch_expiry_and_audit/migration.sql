-- AlterTable
ALTER TABLE "InventoryBatch" ADD COLUMN     "expiryDate" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "InventoryBatch_tenantId_expiryDate_idx" ON "InventoryBatch"("tenantId", "expiryDate");

-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "expiryWarnDaysEarly" INTEGER;
ALTER TABLE "TenantSettings" ADD COLUMN     "expiryWarnDaysUrgent" INTEGER;
ALTER TABLE "TenantSettings" ADD COLUMN     "inventoryAdjustmentLossAccountId" TEXT;

-- CreateTable
CREATE TABLE "InventoryExpiryAudit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "userId" TEXT,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "action" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(15,2),
    "lossAmount" DECIMAL(18,2),
    "restockBatchId" TEXT,
    "journalEntryId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryExpiryAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryExpiryAudit_tenantId_idx" ON "InventoryExpiryAudit"("tenantId");
CREATE INDEX "InventoryExpiryAudit_tenantId_createdAt_idx" ON "InventoryExpiryAudit"("tenantId", "createdAt");
CREATE INDEX "InventoryExpiryAudit_productId_idx" ON "InventoryExpiryAudit"("productId");
CREATE INDEX "InventoryExpiryAudit_batchId_idx" ON "InventoryExpiryAudit"("batchId");

-- AddForeignKey
ALTER TABLE "InventoryExpiryAudit" ADD CONSTRAINT "InventoryExpiryAudit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryExpiryAudit" ADD CONSTRAINT "InventoryExpiryAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InventoryExpiryAudit" ADD CONSTRAINT "InventoryExpiryAudit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
