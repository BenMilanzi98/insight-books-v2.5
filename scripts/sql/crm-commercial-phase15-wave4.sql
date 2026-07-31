-- Phase 15 Wave 4 — Closed-Won handoff, report schedules, DQ incidents, recon runs (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Handoff = payload only. Never Customer/Tenant/Subscription/Invoice.
-- Acceptance ≠ Closed Won. Gate fail ≠ fabricated zero.

CREATE TABLE IF NOT EXISTS "CrmClosedWonConversionHandoff" (
  "id" TEXT PRIMARY KEY,
  "acceptanceId" TEXT NOT NULL,
  "documentVersionId" TEXT,
  "opportunityId" TEXT,
  "payloadJson" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmClosedWonConversionHandoff_idempotencyKey_key"
  ON "CrmClosedWonConversionHandoff"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmClosedWonConversionHandoff_acceptanceId_idx"
  ON "CrmClosedWonConversionHandoff"("acceptanceId");
CREATE INDEX IF NOT EXISTS "CrmClosedWonConversionHandoff_documentVersionId_idx"
  ON "CrmClosedWonConversionHandoff"("documentVersionId");
CREATE INDEX IF NOT EXISTS "CrmClosedWonConversionHandoff_opportunityId_idx"
  ON "CrmClosedWonConversionHandoff"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmClosedWonConversionHandoff_createdByAdminId_idx"
  ON "CrmClosedWonConversionHandoff"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCommercialReportSchedule" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "cronExpression" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialReportSchedule_status_idx"
  ON "CrmCommercialReportSchedule"("status");
CREATE INDEX IF NOT EXISTS "CrmCommercialReportSchedule_createdByAdminId_idx"
  ON "CrmCommercialReportSchedule"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCommercialReportRun" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT,
  "status" TEXT NOT NULL,
  "summaryJson" JSONB,
  "runByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialReportRun_scheduleId_at_idx"
  ON "CrmCommercialReportRun"("scheduleId", "at");
CREATE INDEX IF NOT EXISTS "CrmCommercialReportRun_status_idx"
  ON "CrmCommercialReportRun"("status");
CREATE INDEX IF NOT EXISTS "CrmCommercialReportRun_runByAdminId_idx"
  ON "CrmCommercialReportRun"("runByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCommercialDqIncident" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "count" INTEGER NOT NULL DEFAULT 0,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialDqIncident_code_severity_idx"
  ON "CrmCommercialDqIncident"("code", "severity");

CREATE TABLE IF NOT EXISTS "CrmCommercialReconRun" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "cardsJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialReconRun_status_createdAt_idx"
  ON "CrmCommercialReconRun"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmCommercialReconRun_createdByAdminId_idx"
  ON "CrmCommercialReconRun"("createdByAdminId");
