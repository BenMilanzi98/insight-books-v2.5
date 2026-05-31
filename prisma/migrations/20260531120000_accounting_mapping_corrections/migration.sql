-- Durable row-level audit trail for accounting mapping corrections.
CREATE TABLE "accounting_mapping_correction" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "fieldName" TEXT NOT NULL,
  "oldAccountId" TEXT,
  "oldAccountCode" TEXT,
  "oldAccountName" TEXT,
  "newAccountId" TEXT,
  "newAccountCode" TEXT,
  "newAccountName" TEXT,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "accounting_mapping_correction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_mapping_correction_tenantId_idx" ON "accounting_mapping_correction"("tenantId");
CREATE INDEX "accounting_mapping_correction_batchId_idx" ON "accounting_mapping_correction"("batchId");
CREATE INDEX "accounting_mapping_correction_entityType_entityId_idx" ON "accounting_mapping_correction"("entityType", "entityId");

ALTER TABLE "accounting_mapping_correction"
  ADD CONSTRAINT "accounting_mapping_correction_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
