-- Phase 7 Wave 3 — Customer portfolios / ownership / segment foundation (PostgreSQL).
-- Prefer: npx prisma db push (or migrate). Use this when prisma db push hits Windows EPERM
-- on the query engine, or when applying schema without a full generate cycle.
-- Safe to re-run with IF NOT EXISTS where supported.

CREATE TABLE IF NOT EXISTS "CustomerPortfolio" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "type" TEXT NOT NULL DEFAULT 'CUSTOMER_SUCCESS',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "ownerAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerPortfolio_status_idx" ON "CustomerPortfolio"("status");
CREATE INDEX IF NOT EXISTS "CustomerPortfolio_ownerAdminId_idx" ON "CustomerPortfolio"("ownerAdminId");
CREATE INDEX IF NOT EXISTS "CustomerPortfolio_type_idx" ON "CustomerPortfolio"("type");

CREATE TABLE IF NOT EXISTS "CustomerOwnership" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "portfolioId" TEXT,
  "ownerAdminId" TEXT NOT NULL,
  "assignmentType" TEXT NOT NULL DEFAULT 'CUSTOMER_SUCCESS_OWNER',
  "isPrimary" BOOLEAN NOT NULL DEFAULT TRUE,
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt" TIMESTAMP(3),
  "reason" TEXT,
  "assignedByAdminId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerOwnership_tenantId_status_idx" ON "CustomerOwnership"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CustomerOwnership_ownerAdminId_status_idx" ON "CustomerOwnership"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CustomerOwnership_portfolioId_status_idx" ON "CustomerOwnership"("portfolioId", "status");
CREATE INDEX IF NOT EXISTS "CustomerOwnership_status_endAt_idx" ON "CustomerOwnership"("status", "endAt");
CREATE INDEX IF NOT EXISTS "CustomerOwnership_isPrimary_status_idx" ON "CustomerOwnership"("isPrimary", "status");

CREATE TABLE IF NOT EXISTS "CustomerSegment" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'SYSTEM',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CustomerSegment_status_idx" ON "CustomerSegment"("status");
CREATE INDEX IF NOT EXISTS "CustomerSegment_kind_idx" ON "CustomerSegment"("kind");

CREATE TABLE IF NOT EXISTS "CustomerSegmentMembership" (
  "id" TEXT PRIMARY KEY,
  "segmentId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerSegmentMembership_segmentId_tenantId_key" UNIQUE ("segmentId", "tenantId")
);

CREATE INDEX IF NOT EXISTS "CustomerSegmentMembership_tenantId_status_idx" ON "CustomerSegmentMembership"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CustomerSegmentMembership_segmentId_status_idx" ON "CustomerSegmentMembership"("segmentId", "status");

-- Optional FKs (skip if Admin/Tenant tables differ in your env)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerPortfolio_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CustomerPortfolio"
      ADD CONSTRAINT "CustomerPortfolio_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerOwnership_tenantId_fkey'
  ) THEN
    ALTER TABLE "CustomerOwnership"
      ADD CONSTRAINT "CustomerOwnership_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerOwnership_portfolioId_fkey'
  ) THEN
    ALTER TABLE "CustomerOwnership"
      ADD CONSTRAINT "CustomerOwnership_portfolioId_fkey"
      FOREIGN KEY ("portfolioId") REFERENCES "CustomerPortfolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerOwnership_ownerAdminId_fkey'
  ) THEN
    ALTER TABLE "CustomerOwnership"
      ADD CONSTRAINT "CustomerOwnership_ownerAdminId_fkey"
      FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerOwnership_assignedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CustomerOwnership"
      ADD CONSTRAINT "CustomerOwnership_assignedByAdminId_fkey"
      FOREIGN KEY ("assignedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerSegmentMembership_segmentId_fkey'
  ) THEN
    ALTER TABLE "CustomerSegmentMembership"
      ADD CONSTRAINT "CustomerSegmentMembership_segmentId_fkey"
      FOREIGN KEY ("segmentId") REFERENCES "CustomerSegment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CustomerSegmentMembership_tenantId_fkey'
  ) THEN
    ALTER TABLE "CustomerSegmentMembership"
      ADD CONSTRAINT "CustomerSegmentMembership_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
