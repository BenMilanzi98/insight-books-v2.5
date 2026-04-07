-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_tenantId_documentType_key" ON "DocumentSequence"("tenantId", "documentType");

-- CreateIndex
CREATE INDEX "DocumentSequence_tenantId_idx" ON "DocumentSequence"("tenantId");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Replace global PO number uniqueness with per-tenant uniqueness
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_poNumber_key";
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";

-- CreateIndex (per-tenant PO number)
CREATE UNIQUE INDEX "PurchaseOrder_tenantId_poNumber_key" ON "PurchaseOrder"("tenantId", "poNumber");

-- Replace global receipt number uniqueness with per-tenant uniqueness
ALTER TABLE "GoodsReceipt" DROP CONSTRAINT IF EXISTS "GoodsReceipt_receiptNumber_key";
DROP INDEX IF EXISTS "GoodsReceipt_receiptNumber_key";

-- CreateIndex (per-tenant receipt number)
CREATE UNIQUE INDEX "GoodsReceipt_tenantId_receiptNumber_key" ON "GoodsReceipt"("tenantId", "receiptNumber");

-- Invoice: per-tenant invoice number (fails if duplicate pairs exist)
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- Quotation: per-tenant quotation number (fails if duplicate pairs exist)
CREATE UNIQUE INDEX "Quotation_tenantId_quotationNumber_key" ON "Quotation"("tenantId", "quotationNumber");
