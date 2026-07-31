-- Wave 2 — Canonical Transaction Reversal register (additive)

CREATE TABLE IF NOT EXISTS "transaction_reversal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT NOT NULL,
    "requestedById" TEXT,
    "approvedById" TEXT,
    "executedById" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "periodPolicy" TEXT NOT NULL DEFAULT 'REVERSE_IN_CURRENT_OPEN_PERIOD',
    "crossPeriodDisclosure" BOOLEAN NOT NULL DEFAULT false,
    "originalDocumentDate" TIMESTAMP(3),
    "postingDate" TIMESTAMP(3),
    "reversalDocumentId" TEXT,
    "originalJournalEntryId" TEXT,
    "reversalJournalEntryId" TEXT,
    "idempotencyKey" TEXT,
    "impactSnapshot" JSONB,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "transaction_reversal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_reversal_tenantId_sourceType_sourceId_key"
  ON "transaction_reversal"("tenantId", "sourceType", "sourceId");

CREATE UNIQUE INDEX IF NOT EXISTS "transaction_reversal_tenantId_idempotencyKey_key"
  ON "transaction_reversal"("tenantId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "transaction_reversal_tenantId_status_idx"
  ON "transaction_reversal"("tenantId", "status");

CREATE INDEX IF NOT EXISTS "transaction_reversal_tenantId_createdAt_idx"
  ON "transaction_reversal"("tenantId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transaction_reversal_tenantId_fkey'
  ) THEN
    ALTER TABLE "transaction_reversal"
      ADD CONSTRAINT "transaction_reversal_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
