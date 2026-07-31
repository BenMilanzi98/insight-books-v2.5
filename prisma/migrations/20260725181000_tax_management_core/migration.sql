-- Wave 3 — Tax code versioning fields, account mappings, tax subledger

ALTER TABLE "TaxType" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "TaxType" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);
ALTER TABLE "TaxType" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;

CREATE INDEX IF NOT EXISTS "TaxType_tenantId_effectiveFrom_effectiveTo_idx"
  ON "TaxType"("tenantId", "effectiveFrom", "effectiveTo");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaxType_supersededById_fkey'
  ) THEN
    ALTER TABLE "TaxType"
      ADD CONSTRAINT "TaxType_supersededById_fkey"
      FOREIGN KEY ("supersededById") REFERENCES "TaxType"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tax_account_mapping" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "taxTypeId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_account_mapping_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_account_mapping_tenantId_purpose_status_idx"
  ON "tax_account_mapping"("tenantId", "purpose", "status");
CREATE INDEX IF NOT EXISTS "tax_account_mapping_tenantId_accountId_idx"
  ON "tax_account_mapping"("tenantId", "accountId");
CREATE INDEX IF NOT EXISTS "tax_account_mapping_taxTypeId_idx"
  ON "tax_account_mapping"("taxTypeId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_account_mapping_tenantId_fkey'
  ) THEN
    ALTER TABLE "tax_account_mapping"
      ADD CONSTRAINT "tax_account_mapping_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_account_mapping_accountId_fkey'
  ) THEN
    ALTER TABLE "tax_account_mapping"
      ADD CONSTRAINT "tax_account_mapping_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tax_transaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "journalLineId" TEXT NOT NULL,
    "taxTypeId" TEXT,
    "purpose" TEXT,
    "direction" TEXT NOT NULL,
    "amountSigned" DECIMAL(18,2) NOT NULL,
    "postingDate" TIMESTAMP(3) NOT NULL,
    "sourceModule" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversedFromId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tax_transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_transaction_journalLineId_key"
  ON "tax_transaction"("journalLineId");
CREATE INDEX IF NOT EXISTS "tax_transaction_tenantId_postingDate_idx"
  ON "tax_transaction"("tenantId", "postingDate");
CREATE INDEX IF NOT EXISTS "tax_transaction_tenantId_taxTypeId_idx"
  ON "tax_transaction"("tenantId", "taxTypeId");
CREATE INDEX IF NOT EXISTS "tax_transaction_tenantId_purpose_idx"
  ON "tax_transaction"("tenantId", "purpose");
CREATE INDEX IF NOT EXISTS "tax_transaction_journalEntryId_idx"
  ON "tax_transaction"("journalEntryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_transaction_tenantId_fkey'
  ) THEN
    ALTER TABLE "tax_transaction"
      ADD CONSTRAINT "tax_transaction_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
