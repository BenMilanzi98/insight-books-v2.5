-- Phase 19 Wave 4 — Metrics/reliability, reports, Phase 8 Success Plan link.
-- Prefer: npx prisma db push + npx prisma generate.
-- Use when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS where supported).
--
-- Reliability gate fail → UNAVAILABLE / value null — never false zero.
-- Phase 8: link CsSuccessPlan.adoptionPlanId when resolvable; else UNKNOWN.
-- Never invent COMPLETED from historical foundation rows.

-- Phase 8 Success Plan reconcile link
ALTER TABLE "CsSuccessPlan"
  ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "CsSuccessPlan"
  ADD COLUMN IF NOT EXISTS "adoptionPlanId" TEXT;
ALTER TABLE "CsSuccessPlan"
  ADD COLUMN IF NOT EXISTS "migrationStatus" TEXT;
ALTER TABLE "CsSuccessPlan"
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "CsSuccessPlan"
  ADD COLUMN IF NOT EXISTS "sourceNote" TEXT;

CREATE INDEX IF NOT EXISTS "CsSuccessPlan_adoptionPlanId_idx"
  ON "CsSuccessPlan"("adoptionPlanId");
CREATE INDEX IF NOT EXISTS "CsSuccessPlan_migrationStatus_idx"
  ON "CsSuccessPlan"("migrationStatus");
CREATE INDEX IF NOT EXISTS "CsSuccessPlan_customerId_idx"
  ON "CsSuccessPlan"("customerId");

-- Optional metric snapshot stub (thin; app may use without rows)
CREATE TABLE IF NOT EXISTS "CustomerAdoptionMetricSnapshot" (
  "id" TEXT PRIMARY KEY,
  "metricKey" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "value" DOUBLE PRECISION,
  "honestyJson" JSONB,
  "definitionVersion" TEXT,
  "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerAdoptionMetricSnapshot_metric_captured_idx"
  ON "CustomerAdoptionMetricSnapshot"("metricKey", "capturedAt");
