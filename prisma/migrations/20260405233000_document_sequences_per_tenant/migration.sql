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

-- Deduplicate Invoice: keep one row per (tenantId, invoiceNumber) — oldest by createdAt, then id — and rename the rest (required before unique index)
UPDATE "Invoice" AS i
SET "invoiceNumber" = i."invoiceNumber" || '-mig-' || REPLACE(SUBSTRING(i.id::text FROM 1 FOR 22), '-', '')
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "invoiceNumber"
      ORDER BY "createdAt" ASC NULLS LAST, id ASC
    ) AS rn
  FROM "Invoice"
) AS w
WHERE i.id = w.id AND w.rn > 1;

-- Deduplicate Quotation the same way (avoids 23505 on Quotation index if duplicates exist)
UPDATE "Quotation" AS q
SET "quotationNumber" = q."quotationNumber" || '-mig-' || REPLACE(SUBSTRING(q.id::text FROM 1 FOR 22), '-', '')
FROM (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "tenantId", "quotationNumber"
      ORDER BY "createdAt" ASC NULLS LAST, id ASC
    ) AS rn
  FROM "Quotation"
) AS w
WHERE q.id = w.id AND w.rn > 1;

-- Invoice: per-tenant invoice number
CREATE UNIQUE INDEX "Invoice_tenantId_invoiceNumber_key" ON "Invoice"("tenantId", "invoiceNumber");

-- Quotation: per-tenant quotation number
CREATE UNIQUE INDEX "Quotation_tenantId_quotationNumber_key" ON "Quotation"("tenantId", "quotationNumber");
