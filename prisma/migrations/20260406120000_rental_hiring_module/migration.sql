-- Rental & Hiring module: bookable assets, transactions, availability (anti double-booking), invoice flag

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "isRentalInvoice" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "Invoice_isRentalInvoice_idx" ON "Invoice"("isRentalInvoice");

CREATE TABLE IF NOT EXISTS "RentalAsset" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "totalQuantity" INTEGER NOT NULL DEFAULT 1,
    "defaultRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rateUnit" TEXT NOT NULL DEFAULT 'day',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalAsset_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RentalAsset_tenantId_kind_idx" ON "RentalAsset"("tenantId", "kind");
CREATE INDEX IF NOT EXISTS "RentalAsset_tenantId_isActive_idx" ON "RentalAsset"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "RentalAsset_branchId_idx" ON "RentalAsset"("branchId");

CREATE TABLE IF NOT EXISTS "RentalTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RentalTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RentalTransaction_invoiceId_key" ON "RentalTransaction"("invoiceId");
CREATE INDEX IF NOT EXISTS "RentalTransaction_tenantId_idx" ON "RentalTransaction"("tenantId");
CREATE INDEX IF NOT EXISTS "RentalTransaction_tenantId_kind_idx" ON "RentalTransaction"("tenantId", "kind");
CREATE INDEX IF NOT EXISTS "RentalTransaction_clientId_idx" ON "RentalTransaction"("clientId");
CREATE INDEX IF NOT EXISTS "RentalTransaction_startAt_endAt_idx" ON "RentalTransaction"("startAt", "endAt");
CREATE INDEX IF NOT EXISTS "RentalTransaction_status_idx" ON "RentalTransaction"("status");

CREATE TABLE IF NOT EXISTS "RentalItem" (
    "id" TEXT NOT NULL,
    "rentalTransactionId" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitRate" DOUBLE PRECISION NOT NULL,
    "billableUnits" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "returnedQuantity" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RentalItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RentalItem_rentalTransactionId_idx" ON "RentalItem"("rentalTransactionId");
CREATE INDEX IF NOT EXISTS "RentalItem_rentalAssetId_idx" ON "RentalItem"("rentalAssetId");

CREATE TABLE IF NOT EXISTS "RentalAssetAvailability" (
    "id" TEXT NOT NULL,
    "rentalAssetId" TEXT NOT NULL,
    "rentalTransactionId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'booked',
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "RentalAssetAvailability_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "RentalAssetAvailability_rentalAssetId_startAt_endAt_idx"
  ON "RentalAssetAvailability"("rentalAssetId", "startAt", "endAt");
CREATE INDEX IF NOT EXISTS "RentalAssetAvailability_rentalTransactionId_idx" ON "RentalAssetAvailability"("rentalTransactionId");

ALTER TABLE "RentalAsset" ADD CONSTRAINT "RentalAsset_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalAsset" ADD CONSTRAINT "RentalAsset_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "RentalTransaction" ADD CONSTRAINT "RentalTransaction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalTransaction" ADD CONSTRAINT "RentalTransaction_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalTransaction" ADD CONSTRAINT "RentalTransaction_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RentalTransaction" ADD CONSTRAINT "RentalTransaction_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_rentalTransactionId_fkey"
  FOREIGN KEY ("rentalTransactionId") REFERENCES "RentalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalItem" ADD CONSTRAINT "RentalItem_rentalAssetId_fkey"
  FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RentalAssetAvailability" ADD CONSTRAINT "RentalAssetAvailability_rentalAssetId_fkey"
  FOREIGN KEY ("rentalAssetId") REFERENCES "RentalAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RentalAssetAvailability" ADD CONSTRAINT "RentalAssetAvailability_rentalTransactionId_fkey"
  FOREIGN KEY ("rentalTransactionId") REFERENCES "RentalTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
