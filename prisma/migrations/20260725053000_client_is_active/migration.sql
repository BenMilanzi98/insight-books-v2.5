-- Persist client Active/Inactive (was incorrectly derived from invoice/sale activity)
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS "Client_tenantId_isActive_idx" ON "Client"("tenantId", "isActive");
