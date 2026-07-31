-- Phase 12 Wave 2 — Opportunity contact roles, products, commercial, probability, close dates.
-- Apply when `prisma db push` / migrate hits Windows EPERM on the Prisma engine DLL.
-- Safe to re-run (IF NOT EXISTS / DO $$ guards).
--
-- After apply:
--   1. Retry `npx prisma generate` when the engine file is unlocked
--   2. App code uses hasCrmOpportunity*Model guards until client methods exist
--
-- Never posts Revenue / Subscription / Invoice. Weighted UI remains dark (Phase 16).

-- CrmOpportunity Wave 2 columns
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(18,2);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "currency" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "amountBasis" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "recurringAnnualAmount" DECIMAL(18,2);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "oneTimeAmount" DECIMAL(18,2);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "probability" INTEGER;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "probabilitySource" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "probabilityConfidence" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "probabilityOverrideReason" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "expectedCloseDate" TIMESTAMP(3);
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closeDateSource" TEXT;
ALTER TABLE "CrmOpportunity" ADD COLUMN IF NOT EXISTS "closeDateConfidence" TEXT;

CREATE INDEX IF NOT EXISTS "CrmOpportunity_currency_status_idx"
  ON "CrmOpportunity"("currency", "status");
CREATE INDEX IF NOT EXISTS "CrmOpportunity_expectedCloseDate_idx"
  ON "CrmOpportunity"("expectedCloseDate");

CREATE TABLE IF NOT EXISTS "CrmOpportunityContactRole" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "note" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmOpportunityContactRole_opportunityId_contactId_role_key"
  ON "CrmOpportunityContactRole"("opportunityId", "contactId", "role");
CREATE INDEX IF NOT EXISTS "CrmOpportunityContactRole_opportunityId_role_idx"
  ON "CrmOpportunityContactRole"("opportunityId", "role");
CREATE INDEX IF NOT EXISTS "CrmOpportunityContactRole_contactId_idx"
  ON "CrmOpportunityContactRole"("contactId");

CREATE TABLE IF NOT EXISTS "CrmOpportunityContactRoleHistory" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "previousContactId" TEXT,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmOpportunityContactRoleHistory_opportunityId_at_idx"
  ON "CrmOpportunityContactRoleHistory"("opportunityId", "at");
CREATE INDEX IF NOT EXISTS "CrmOpportunityContactRoleHistory_changedByAdminId_idx"
  ON "CrmOpportunityContactRoleHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmOpportunityProduct" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "featureCode" TEXT,
  "moduleCode" TEXT,
  "label" TEXT,
  "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1,
  "unitAmountEstimate" DECIMAL(18,2),
  "currency" TEXT,
  "binding" TEXT NOT NULL DEFAULT 'NON_BINDING_ESTIMATE',
  "unknownInterest" BOOLEAN NOT NULL DEFAULT false,
  "note" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmOpportunityProduct_opportunityId_createdAt_idx"
  ON "CrmOpportunityProduct"("opportunityId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmOpportunityProduct_featureCode_idx"
  ON "CrmOpportunityProduct"("featureCode");
CREATE INDEX IF NOT EXISTS "CrmOpportunityProduct_moduleCode_idx"
  ON "CrmOpportunityProduct"("moduleCode");

CREATE TABLE IF NOT EXISTS "CrmOpportunityAmountHistory" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" TEXT NOT NULL,
  "amountBasis" TEXT NOT NULL,
  "recurringAnnualAmount" DECIMAL(18,2),
  "oneTimeAmount" DECIMAL(18,2),
  "previousAmount" DECIMAL(18,2),
  "previousCurrency" TEXT,
  "previousAmountBasis" TEXT,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmOpportunityAmountHistory_opportunityId_at_idx"
  ON "CrmOpportunityAmountHistory"("opportunityId", "at");
CREATE INDEX IF NOT EXISTS "CrmOpportunityAmountHistory_changedByAdminId_idx"
  ON "CrmOpportunityAmountHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmOpportunityProbabilityHistory" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "probability" INTEGER NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" TEXT,
  "previousProbability" INTEGER,
  "stageCode" TEXT,
  "reason" TEXT,
  "approvalStatus" TEXT,
  "isMl" BOOLEAN NOT NULL DEFAULT false,
  "isRevenueCertainty" BOOLEAN NOT NULL DEFAULT false,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmOpportunityProbabilityHistory_opportunityId_at_idx"
  ON "CrmOpportunityProbabilityHistory"("opportunityId", "at");
CREATE INDEX IF NOT EXISTS "CrmOpportunityProbabilityHistory_changedByAdminId_idx"
  ON "CrmOpportunityProbabilityHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmOpportunityCloseDateHistory" (
  "id" TEXT PRIMARY KEY,
  "opportunityId" TEXT NOT NULL,
  "expectedCloseDate" TIMESTAMP(3) NOT NULL,
  "source" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "previousExpectedCloseDate" TIMESTAMP(3),
  "previousSource" TEXT,
  "previousConfidence" TEXT,
  "reason" TEXT,
  "forecastEligible" BOOLEAN NOT NULL DEFAULT false,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "CrmOpportunityCloseDateHistory_opportunityId_at_idx"
  ON "CrmOpportunityCloseDateHistory"("opportunityId", "at");
CREATE INDEX IF NOT EXISTS "CrmOpportunityCloseDateHistory_changedByAdminId_idx"
  ON "CrmOpportunityCloseDateHistory"("changedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmOpportunityCloseDateHistory_forecastEligible_expectedCloseDate_idx"
  ON "CrmOpportunityCloseDateHistory"("forecastEligible", "expectedCloseDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityContactRole_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityContactRole"
      ADD CONSTRAINT "CrmOpportunityContactRole_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityContactRole_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityContactRole"
      ADD CONSTRAINT "CrmOpportunityContactRole_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityContactRoleHistory_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityContactRoleHistory"
      ADD CONSTRAINT "CrmOpportunityContactRoleHistory_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityContactRoleHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityContactRoleHistory"
      ADD CONSTRAINT "CrmOpportunityContactRoleHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityProduct_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityProduct"
      ADD CONSTRAINT "CrmOpportunityProduct_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityProduct_createdByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityProduct"
      ADD CONSTRAINT "CrmOpportunityProduct_createdByAdminId_fkey"
      FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityAmountHistory_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityAmountHistory"
      ADD CONSTRAINT "CrmOpportunityAmountHistory_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityAmountHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityAmountHistory"
      ADD CONSTRAINT "CrmOpportunityAmountHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityProbabilityHistory_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityProbabilityHistory"
      ADD CONSTRAINT "CrmOpportunityProbabilityHistory_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityProbabilityHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityProbabilityHistory"
      ADD CONSTRAINT "CrmOpportunityProbabilityHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityCloseDateHistory_opportunityId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityCloseDateHistory"
      ADD CONSTRAINT "CrmOpportunityCloseDateHistory_opportunityId_fkey"
      FOREIGN KEY ("opportunityId") REFERENCES "CrmOpportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmOpportunityCloseDateHistory_changedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmOpportunityCloseDateHistory"
      ADD CONSTRAINT "CrmOpportunityCloseDateHistory_changedByAdminId_fkey"
      FOREIGN KEY ("changedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;
