-- Idempotent script: add UserBranch and Tenant branch columns if missing.
-- Use when development (or another env) DB is missing these and you cannot run
-- "prisma migrate deploy" or a migration is marked applied but table wasn't created.
-- Safe to run multiple times. Does not drop or alter existing data.
-- See: docs/BRANCH_SCHEMA_RESOLUTION.md

-- Tenant: add columns if missing
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;

-- UserBranch: create table only if missing
CREATE TABLE IF NOT EXISTS "UserBranch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserBranch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBranch_userId_branchId_key" ON "UserBranch"("userId", "branchId");
CREATE INDEX IF NOT EXISTS "UserBranch_userId_idx" ON "UserBranch"("userId");
CREATE INDEX IF NOT EXISTS "UserBranch_branchId_idx" ON "UserBranch"("branchId");

-- User.defaultBranchId (if missing; from earlier migration)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "defaultBranchId" TEXT;

-- FKs only if missing (PostgreSQL)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_defaultBranchId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Tenant_ownerUserId_fkey') THEN
    ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_userId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserBranch_branchId_fkey') THEN
    ALTER TABLE "UserBranch" ADD CONSTRAINT "UserBranch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'User_defaultBranchId_fkey') THEN
    ALTER TABLE "User" ADD CONSTRAINT "User_defaultBranchId_fkey" FOREIGN KEY ("defaultBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
