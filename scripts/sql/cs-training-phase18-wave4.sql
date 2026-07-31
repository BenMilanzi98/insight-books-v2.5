-- Phase 18 Wave 4 — Metrics/reliability, reports, Phase 8 Program link.
-- Prefer: npx prisma db push + npx prisma generate.
-- Use when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where supported).
--
-- Reliability gate fail → UNAVAILABLE / value null — never false zero.
-- Phase 8: link CsTrainingRecord.trainingProgramId when resolvable; else UNKNOWN.
-- Never invent COMPLETED from historical foundation rows.

-- Phase 8 reconcile link
ALTER TABLE "CsTrainingRecord"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "CsTrainingRecord"
  ADD COLUMN IF NOT EXISTS "trainingProgramId" TEXT;
ALTER TABLE "CsTrainingRecord"
  ADD COLUMN IF NOT EXISTS "migrationStatus" TEXT;

CREATE INDEX IF NOT EXISTS "CsTrainingRecord_trainingProgramId_idx"
  ON "CsTrainingRecord"("trainingProgramId");
CREATE INDEX IF NOT EXISTS "CsTrainingRecord_migrationStatus_idx"
  ON "CsTrainingRecord"("migrationStatus");
CREATE INDEX IF NOT EXISTS "CsTrainingRecord_customerId_idx"
  ON "CsTrainingRecord"("customerId");

-- Optional report schedule / snapshot stubs (thin; app may use without rows)
CREATE TABLE IF NOT EXISTS "CustomerTrainingReportSchedule" (
  "id" TEXT PRIMARY KEY,
  "reportKey" TEXT NOT NULL,
  "cronExpression" TEXT,
  "timezone" TEXT DEFAULT 'Africa/Blantyre',
  "createdByAdminId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingReportSchedule_reportKey_idx"
  ON "CustomerTrainingReportSchedule"("reportKey");

CREATE TABLE IF NOT EXISTS "CustomerTrainingMetricSnapshot" (
  "id" TEXT PRIMARY KEY,
  "metricKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "honestyJson" JSONB,
  "definitionVersion" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingMetricSnapshot_metric_captured_idx"
  ON "CustomerTrainingMetricSnapshot"("metricKey", "capturedAt");
