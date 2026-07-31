-- Extend PlatformPlanVersion for MRA EIS commercial plans (Phase 1).
-- Safe additive columns with defaults for existing rows.

ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "publicName" TEXT;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "planCategory" TEXT NOT NULL DEFAULT 'CORE';
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "productCode" TEXT;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "limitsJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "eligibilityJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "billingCyclesJson" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "presentationJson" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "isPublic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "isFeatured" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "trialEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "trialDays" INTEGER;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "ctaText" TEXT;
ALTER TABLE "PlatformPlanVersion" ADD COLUMN IF NOT EXISTS "highlightText" TEXT;

CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_planCategory_idx" ON "PlatformPlanVersion"("planCategory");
CREATE INDEX IF NOT EXISTS "PlatformPlanVersion_isPublic_planCategory_displayOrder_idx"
  ON "PlatformPlanVersion"("isPublic", "planCategory", "displayOrder");

-- Categorize known EIS plan codes (public storefront-visible)
UPDATE "PlatformPlanVersion"
SET
  "planCategory" = 'MRA_EIS',
  "productCode" = 'MRA_EIS',
  "publicName" = COALESCE("publicName", "name"),
  "isPublic" = true,
  "status" = CASE WHEN "status" = 'ACTIVE' THEN 'PUBLISHED' ELSE "status" END
WHERE "planCode" IN ('eis-monthly', 'eis-yearly');
