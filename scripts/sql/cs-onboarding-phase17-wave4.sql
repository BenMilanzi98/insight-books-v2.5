-- Phase 17 Wave 4 — Metrics/reliability, reports, Phase 8 link, owner pins.
-- Prefer: npx prisma db push + npx prisma generate.
-- Use when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where supported).
--
-- Reliability gate fail → UNAVAILABLE / value null — never false zero.
-- Phase 8: link CsOnboardingRecord.onboardingProjectId when resolvable; else UNKNOWN.
-- Never invent COMPLETED from historical foundation rows.

-- Owner pins for My Work / portfolio scope
ALTER TABLE "CustomerOnboardingProject"
  ADD COLUMN IF NOT EXISTS "csOwnerAdminId" TEXT;
ALTER TABLE "CustomerOnboardingProject"
  ADD COLUMN IF NOT EXISTS "ownerAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_csOwnerAdminId_idx"
  ON "CustomerOnboardingProject"("csOwnerAdminId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingProject_ownerAdminId_idx"
  ON "CustomerOnboardingProject"("ownerAdminId");

-- Phase 8 reconcile link
ALTER TABLE "CsOnboardingRecord"
  ADD COLUMN IF NOT EXISTS "onboardingProjectId" TEXT;
ALTER TABLE "CsOnboardingRecord"
  ADD COLUMN IF NOT EXISTS "migrationStatus" TEXT;

CREATE INDEX IF NOT EXISTS "CsOnboardingRecord_onboardingProjectId_idx"
  ON "CsOnboardingRecord"("onboardingProjectId");
CREATE INDEX IF NOT EXISTS "CsOnboardingRecord_migrationStatus_idx"
  ON "CsOnboardingRecord"("migrationStatus");

-- Optional report schedule / snapshot stubs (thin; app may use without rows)
CREATE TABLE IF NOT EXISTS "CustomerOnboardingReportSchedule" (
  "id" TEXT PRIMARY KEY,
  "reportKey" TEXT NOT NULL,
  "cronExpression" TEXT,
  "timezone" TEXT DEFAULT 'Africa/Blantyre',
  "createdByAdminId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingReportSchedule_reportKey_idx"
  ON "CustomerOnboardingReportSchedule"("reportKey");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingMetricSnapshot" (
  "id" TEXT PRIMARY KEY,
  "metricKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "honestyJson" JSONB,
  "definitionVersion" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingMetricSnapshot_metric_captured_idx"
  ON "CustomerOnboardingMetricSnapshot"("metricKey", "capturedAt");
