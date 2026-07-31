-- Phase 10 Wave 1 — SupportTicket, SupportTicketStatusHistory, SupportTicketNumberSeq (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine,
-- or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave1.sql
--      (or run via Laragon / pgAdmin)
--   2. Ensure app code uses hasSupportTicketModel(prisma) guards
--      (lib/admin/support/tickets.js) so missing client methods degrade safely.
--   3. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- Support Ticket ≠ CsCase ≠ PlatformSupportAccess.
-- Never store Tenant GL lines, MRA credentials, or payment secrets.

CREATE TABLE IF NOT EXISTS "SupportTicketNumberSeq" (
  "year" INTEGER PRIMARY KEY,
  "lastIssued" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "SupportTicket" (
  "id" TEXT PRIMARY KEY,
  "ticketNumber" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "portfolioId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "type" TEXT NOT NULL,
  "impact" TEXT,
  "urgency" TEXT,
  "priority" TEXT,
  "severity" TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolutionCategory" TEXT,
  "createdByAdminId" TEXT,
  "assigneeAdminId" TEXT,
  "queueCode" TEXT,
  "sourceChannel" TEXT NOT NULL DEFAULT 'ADMIN_MANUAL',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3)
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupportTicket_ticketNumber_key"
  ON "SupportTicket"("ticketNumber");
CREATE INDEX IF NOT EXISTS "SupportTicket_tenantId_status_idx"
  ON "SupportTicket"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "SupportTicket_status_createdAt_idx"
  ON "SupportTicket"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "SupportTicket_assigneeAdminId_status_idx"
  ON "SupportTicket"("assigneeAdminId", "status");
CREATE INDEX IF NOT EXISTS "SupportTicket_queueCode_status_idx"
  ON "SupportTicket"("queueCode", "status");
CREATE INDEX IF NOT EXISTS "SupportTicket_portfolioId_idx"
  ON "SupportTicket"("portfolioId");
CREATE INDEX IF NOT EXISTS "SupportTicket_sourceChannel_idx"
  ON "SupportTicket"("sourceChannel");

CREATE TABLE IF NOT EXISTS "SupportTicketStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "ticketId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SupportTicketStatusHistory_ticketId_at_idx"
  ON "SupportTicketStatusHistory"("ticketId", "at");
CREATE INDEX IF NOT EXISTS "SupportTicketStatusHistory_changedByAdminId_idx"
  ON "SupportTicketStatusHistory"("changedByAdminId");
CREATE INDEX IF NOT EXISTS "SupportTicketStatusHistory_toStatus_at_idx"
  ON "SupportTicketStatusHistory"("toStatus", "at");

-- Foreign keys (idempotent; matches prisma/schema.prisma Support* onDelete)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_tenantId_fkey'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_portfolioId_fkey'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "CustomerPortfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicket_assigneeAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportTicket"
      ADD CONSTRAINT "SupportTicket_assigneeAdminId_fkey"
      FOREIGN KEY ("assigneeAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicketStatusHistory_ticketId_fkey'
  ) THEN
    ALTER TABLE "SupportTicketStatusHistory"
      ADD CONSTRAINT "SupportTicketStatusHistory_ticketId_fkey"
      FOREIGN KEY ("ticketId") REFERENCES "SupportTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SupportTicketStatusHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "SupportTicketStatusHistory"
      ADD CONSTRAINT "SupportTicketStatusHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
