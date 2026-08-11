-- JournalEntry.referenceNumber must be unique per tenant, not globally.
-- V2 posting sets referenceNumber = journalNumber (e.g. POS-2026-000001);
-- sequences are per-tenant so a global unique caused JOURNAL_PERSISTENCE on later tenants.

DROP INDEX IF EXISTS "JournalEntry_referenceNumber_key";

CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_tenantId_referenceNumber_key"
  ON "JournalEntry"("tenantId", "referenceNumber");
