-- Phase 23 Wave 1 - Marketing domain foundation (Campaign + taxonomy + numbering).
-- Does not invent attribution/spend/visitor planes.

CREATE TABLE IF NOT EXISTS "MarketingNumberSeq" (
    "prefix" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastIssued" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingNumberSeq_pkey" PRIMARY KEY ("prefix","year")
);

CREATE TABLE IF NOT EXISTS "MarketingChannel" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingChannel_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingChannel_code_key" ON "MarketingChannel"("code");
CREATE INDEX IF NOT EXISTS "MarketingChannel_status_sortOrder_idx" ON "MarketingChannel"("status", "sortOrder");

CREATE TABLE IF NOT EXISTS "MarketingSource" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "channelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSource_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingSource_code_key" ON "MarketingSource"("code");
CREATE INDEX IF NOT EXISTS "MarketingSource_status_sortOrder_idx" ON "MarketingSource"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "MarketingSource_channelId_idx" ON "MarketingSource"("channelId");

CREATE TABLE IF NOT EXISTS "MarketingMedium" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingMedium_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingMedium_code_key" ON "MarketingMedium"("code");
CREATE INDEX IF NOT EXISTS "MarketingMedium_status_sortOrder_idx" ON "MarketingMedium"("status", "sortOrder");
CREATE INDEX IF NOT EXISTS "MarketingMedium_sourceId_idx" ON "MarketingMedium"("sourceId");

CREATE TABLE IF NOT EXISTS "MarketingSourceNormalisationRule" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rawSourcePattern" TEXT NOT NULL,
    "rawMediumPattern" TEXT,
    "channelCode" TEXT NOT NULL,
    "sourceCode" TEXT NOT NULL,
    "mediumCode" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdByAdminId" TEXT,
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingSourceNormalisationRule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingSourceNormalisationRule_ruleCode_version_key" ON "MarketingSourceNormalisationRule"("ruleCode", "version");
CREATE INDEX IF NOT EXISTS "MarketingSourceNormalisationRule_status_priority_idx" ON "MarketingSourceNormalisationRule"("status", "priority");
CREATE INDEX IF NOT EXISTS "MarketingSourceNormalisationRule_effectiveFrom_effectiveTo_idx" ON "MarketingSourceNormalisationRule"("effectiveFrom", "effectiveTo");

CREATE TABLE IF NOT EXISTS "MarketingCampaign" (
    "id" TEXT NOT NULL,
    "campaignNumber" TEXT NOT NULL,
    "campaignCode" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "objective" TEXT,
    "campaignType" TEXT NOT NULL DEFAULT 'LEAD_GENERATION',
    "parentCampaignId" TEXT,
    "channelId" TEXT,
    "sourceId" TEXT,
    "mediumId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "timezone" TEXT DEFAULT 'Africa/Blantyre',
    "ownerAdminId" TEXT,
    "teamId" TEXT,
    "territoryId" TEXT,
    "createdByAdminId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MarketingCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketingCampaign_campaignNumber_key" ON "MarketingCampaign"("campaignNumber");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_status_createdAt_idx" ON "MarketingCampaign"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_ownerAdminId_status_idx" ON "MarketingCampaign"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_channelId_idx" ON "MarketingCampaign"("channelId");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_sourceId_idx" ON "MarketingCampaign"("sourceId");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_mediumId_idx" ON "MarketingCampaign"("mediumId");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_parentCampaignId_idx" ON "MarketingCampaign"("parentCampaignId");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_campaignType_status_idx" ON "MarketingCampaign"("campaignType", "status");
CREATE INDEX IF NOT EXISTS "MarketingCampaign_startDate_endDate_idx" ON "MarketingCampaign"("startDate", "endDate");

DO $$ BEGIN
  ALTER TABLE "MarketingSource" ADD CONSTRAINT "MarketingSource_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingMedium" ADD CONSTRAINT "MarketingMedium_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MarketingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_parentCampaignId_fkey" FOREIGN KEY ("parentCampaignId") REFERENCES "MarketingCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "MarketingChannel"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "MarketingSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_mediumId_fkey" FOREIGN KEY ("mediumId") REFERENCES "MarketingMedium"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_ownerAdminId_fkey" FOREIGN KEY ("ownerAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "MarketingCampaign" ADD CONSTRAINT "MarketingCampaign_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
