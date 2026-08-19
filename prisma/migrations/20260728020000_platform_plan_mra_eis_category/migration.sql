-- Extend PlatformPlanVersion for MRA EIS commercial plans (Phase 1).
-- Safe additive columns with defaults for existing rows.
-- Guarded: the table may be created by a later migration (20260802013000);
-- in that case the columns are added there, so this is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'PlatformPlanVersion'
  ) THEN
    RAISE NOTICE 'PlatformPlanVersion does not exist yet — skipping additive columns (will be applied when table is created).';
    RETURN;
  END IF;

  -- Additive columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='publicName') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "publicName" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='planCategory') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "planCategory" TEXT NOT NULL DEFAULT 'CORE';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='productCode') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "productCode" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='limitsJson') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "limitsJson" JSONB NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='eligibilityJson') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "eligibilityJson" JSONB NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='billingCyclesJson') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "billingCyclesJson" JSONB NOT NULL DEFAULT '[]';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='presentationJson') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "presentationJson" JSONB NOT NULL DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='isPublic') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='isFeatured') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "isFeatured" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='displayOrder') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='trialEnabled') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "trialEnabled" BOOLEAN NOT NULL DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='trialDays') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "trialDays" INTEGER;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='ctaText') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "ctaText" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='PlatformPlanVersion' AND column_name='highlightText') THEN
    ALTER TABLE "PlatformPlanVersion" ADD COLUMN "highlightText" TEXT;
  END IF;

  -- Indexes
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='PlatformPlanVersion' AND indexname='PlatformPlanVersion_planCategory_idx') THEN
    CREATE INDEX "PlatformPlanVersion_planCategory_idx" ON "PlatformPlanVersion"("planCategory");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE tablename='PlatformPlanVersion' AND indexname='PlatformPlanVersion_isPublic_planCategory_displayOrder_idx') THEN
    CREATE INDEX "PlatformPlanVersion_isPublic_planCategory_displayOrder_idx"
      ON "PlatformPlanVersion"("isPublic", "planCategory", "displayOrder");
  END IF;

  -- Categorize known EIS plan codes
  UPDATE "PlatformPlanVersion"
  SET
    "planCategory" = 'MRA_EIS',
    "productCode" = 'MRA_EIS',
    "publicName" = COALESCE("publicName", "name"),
    "isPublic" = true,
    "status" = CASE WHEN "status" = 'ACTIVE' THEN 'PUBLISHED' ELSE "status" END
  WHERE "planCode" IN ('eis-monthly', 'eis-yearly');

END $$;
