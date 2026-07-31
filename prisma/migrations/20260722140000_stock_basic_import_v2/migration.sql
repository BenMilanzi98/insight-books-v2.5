-- Hybrid stock: normalized item names + basic 4-column import batches.
-- Business-scoped; branch is hidden primary only (no user-facing warehouse column).

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "normalizedName" TEXT;

CREATE INDEX IF NOT EXISTS "Product_tenantId_normalizedName_idx"
  ON "Product"("tenantId", "normalizedName");

-- Active products: one normalized name per business (nulls allowed for legacy rows).
CREATE UNIQUE INDEX IF NOT EXISTS "Product_tenantId_normalizedName_active_uidx"
  ON "Product"("tenantId", "normalizedName")
  WHERE "isDeleted" = false AND "normalizedName" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "StockImportBatch" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "fileHash" TEXT NOT NULL,
  "fileName" TEXT,
  "purpose" TEXT NOT NULL DEFAULT 'STOCK_RECEIPT_IMPORT',
  "status" TEXT NOT NULL DEFAULT 'UPLOADED',
  "updateSellingPrice" BOOLEAN NOT NULL DEFAULT true,
  "forceAsNewReceipt" BOOLEAN NOT NULL DEFAULT false,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "validCount" INTEGER NOT NULL DEFAULT 0,
  "warningCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "createdById" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "errorSummary" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockImportBatch_tenantId_fileHash_purpose_key"
  ON "StockImportBatch"("tenantId", "fileHash", "purpose");

CREATE INDEX IF NOT EXISTS "StockImportBatch_tenantId_status_idx"
  ON "StockImportBatch"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "StockImportBatch_createdById_idx"
  ON "StockImportBatch"("createdById");

CREATE TABLE IF NOT EXISTS "StockImportRow" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "itemName" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "orderPrice" DECIMAL(18,2) NOT NULL,
  "sellingPrice" DECIMAL(18,2) NOT NULL,
  "matchStatus" TEXT NOT NULL,
  "productId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "message" TEXT,
  "quantityBefore" DECIMAL(18,4),
  "quantityAfter" DECIMAL(18,4),
  "valueBefore" DECIMAL(18,2),
  "valueAfter" DECIMAL(18,2),
  "wacBefore" DECIMAL(18,2),
  "wacAfter" DECIMAL(18,2),
  "movementId" TEXT,
  "batchLayerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockImportRow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StockImportRow_batchId_rowNumber_key"
  ON "StockImportRow"("batchId", "rowNumber");

CREATE INDEX IF NOT EXISTS "StockImportRow_tenantId_normalizedName_idx"
  ON "StockImportRow"("tenantId", "normalizedName");

CREATE INDEX IF NOT EXISTS "StockImportRow_productId_idx" ON "StockImportRow"("productId");
CREATE INDEX IF NOT EXISTS "StockImportRow_status_idx" ON "StockImportRow"("status");

DO $$ BEGIN
  ALTER TABLE "StockImportBatch"
    ADD CONSTRAINT "StockImportBatch_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockImportBatch"
    ADD CONSTRAINT "StockImportBatch_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockImportRow"
    ADD CONSTRAINT "StockImportRow_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "StockImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockImportRow"
    ADD CONSTRAINT "StockImportRow_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Backfill normalized names for active products (best-effort; duplicates left null for manual resolve).
UPDATE "Product" p
SET "normalizedName" = lower(regexp_replace(trim(both FROM regexp_replace(p."name", E'[\\u00A0\\s]+', ' ', 'g')), E'\\s+', ' ', 'g'))
WHERE p."isDeleted" = false
  AND p."normalizedName" IS NULL
  AND p."name" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Product" o
    WHERE o."tenantId" = p."tenantId"
      AND o."isDeleted" = false
      AND o."id" <> p."id"
      AND lower(regexp_replace(trim(both FROM regexp_replace(o."name", E'[\\u00A0\\s]+', ' ', 'g')), E'\\s+', ' ', 'g'))
        = lower(regexp_replace(trim(both FROM regexp_replace(p."name", E'[\\u00A0\\s]+', ' ', 'g')), E'\\s+', ' ', 'g'))
  );
