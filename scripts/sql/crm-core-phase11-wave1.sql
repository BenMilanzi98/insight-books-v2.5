-- Phase 11 Wave 1 — CrmAccount, CrmContact, CrmLead, CrmLeadStatusHistory, CrmNumberSeq (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine,
-- or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. psql "$DATABASE_URL" -f scripts/sql/crm-core-phase11-wave1.sql
--      (or run via Laragon / pgAdmin)
--   2. Ensure app code uses hasCrmAccountModel / hasCrmContactModel / hasCrmLeadModel
--      guards so missing client methods degrade safely.
--   3. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- CrmLead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase.
-- Never store Tenant GL, payment secrets, or MRA credentials.

CREATE TABLE IF NOT EXISTS "CrmNumberSeq" (
  "prefix" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastIssued" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("prefix", "year")
);

CREATE TABLE IF NOT EXISTS "CrmAccount" (
  "id" TEXT PRIMARY KEY,
  "accountNumber" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'PROSPECT',
  "displayName" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "country" TEXT,
  "region" TEXT,
  "ownerAdminId" TEXT,
  "customerId" TEXT,
  "tenantId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmAccount_accountNumber_key"
  ON "CrmAccount"("accountNumber");
CREATE INDEX IF NOT EXISTS "CrmAccount_status_createdAt_idx"
  ON "CrmAccount"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmAccount_ownerAdminId_idx"
  ON "CrmAccount"("ownerAdminId");
CREATE INDEX IF NOT EXISTS "CrmAccount_tenantId_idx"
  ON "CrmAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "CrmAccount_customerId_idx"
  ON "CrmAccount"("customerId");
CREATE INDEX IF NOT EXISTS "CrmAccount_type_status_idx"
  ON "CrmAccount"("type", "status");

CREATE TABLE IF NOT EXISTS "CrmContact" (
  "id" TEXT PRIMARY KEY,
  "contactNumber" TEXT NOT NULL,
  "firstName" TEXT NOT NULL,
  "lastName" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" TEXT,
  "accountId" TEXT,
  "ownerAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmContact_contactNumber_key"
  ON "CrmContact"("contactNumber");
CREATE INDEX IF NOT EXISTS "CrmContact_accountId_idx"
  ON "CrmContact"("accountId");
CREATE INDEX IF NOT EXISTS "CrmContact_ownerAdminId_idx"
  ON "CrmContact"("ownerAdminId");
CREATE INDEX IF NOT EXISTS "CrmContact_email_idx"
  ON "CrmContact"("email");
CREATE INDEX IF NOT EXISTS "CrmContact_createdAt_idx"
  ON "CrmContact"("createdAt");

CREATE TABLE IF NOT EXISTS "CrmLead" (
  "id" TEXT PRIMARY KEY,
  "leadNumber" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "personOrOrganisation" TEXT NOT NULL,
  "accountId" TEXT,
  "contactId" TEXT,
  "source" TEXT NOT NULL,
  "channel" TEXT NOT NULL DEFAULT 'ADMIN_MANUAL',
  "sourceIdempotencyKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "disqualificationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmLead_leadNumber_key"
  ON "CrmLead"("leadNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmLead_sourceIdempotencyKey_key"
  ON "CrmLead"("sourceIdempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmLead_status_createdAt_idx"
  ON "CrmLead"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmLead_ownerAdminId_status_idx"
  ON "CrmLead"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmLead_accountId_idx"
  ON "CrmLead"("accountId");
CREATE INDEX IF NOT EXISTS "CrmLead_contactId_idx"
  ON "CrmLead"("contactId");
CREATE INDEX IF NOT EXISTS "CrmLead_source_channel_idx"
  ON "CrmLead"("source", "channel");
CREATE INDEX IF NOT EXISTS "CrmLead_type_status_idx"
  ON "CrmLead"("type", "status");

CREATE TABLE IF NOT EXISTS "CrmLeadStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmLeadStatusHistory_leadId_at_idx"
  ON "CrmLeadStatusHistory"("leadId", "at");
CREATE INDEX IF NOT EXISTS "CrmLeadStatusHistory_changedByAdminId_idx"
  ON "CrmLeadStatusHistory"("changedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmLeadStatusHistory_toStatus_at_idx"
  ON "CrmLeadStatusHistory"("toStatus", "at");

-- Foreign keys (idempotent; matches prisma/schema.prisma Crm* onDelete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmAccount_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmAccount"
      ADD CONSTRAINT "CrmAccount_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmAccount_tenantId_fkey'
  ) THEN
    ALTER TABLE "CrmAccount"
      ADD CONSTRAINT "CrmAccount_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmContact_accountId_fkey'
  ) THEN
    ALTER TABLE "CrmContact"
      ADD CONSTRAINT "CrmContact_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmContact_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmContact"
      ADD CONSTRAINT "CrmContact_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLead_accountId_fkey'
  ) THEN
    ALTER TABLE "CrmLead"
      ADD CONSTRAINT "CrmLead_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "CrmAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLead_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmLead"
      ADD CONSTRAINT "CrmLead_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLead_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmLead"
      ADD CONSTRAINT "CrmLead_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLead_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmLead"
      ADD CONSTRAINT "CrmLead_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLeadStatusHistory_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmLeadStatusHistory"
      ADD CONSTRAINT "CrmLeadStatusHistory_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmLeadStatusHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmLeadStatusHistory"
      ADD CONSTRAINT "CrmLeadStatusHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
