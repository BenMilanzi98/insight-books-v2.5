-- Phase 16 Wave 4 — CS assignment, domain handoffs, completion certificate, DQ/recon (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Handoff ≠ execute. Gate fail ≠ fabricated zero. No MRA fiscal/credentials.
-- Completion certificate checksum stable; compensation never deletes acceptance.

CREATE TABLE IF NOT EXISTS "CrmConversionCsAssignment" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT,
  "tenantId" TEXT NOT NULL,
  "ownerAdminId" TEXT NOT NULL,
  "portfolioId" TEXT,
  "ownershipId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ASSIGNED',
  "idempotencyKey" TEXT NOT NULL,
  "metaJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionCsAssignment_idempotencyKey_key"
  ON "CrmConversionCsAssignment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionCsAssignment_conversionId_idx"
  ON "CrmConversionCsAssignment"("conversionId");
CREATE INDEX IF NOT EXISTS "CrmConversionCsAssignment_tenantId_status_idx"
  ON "CrmConversionCsAssignment"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CrmConversionCsAssignment_ownerAdminId_idx"
  ON "CrmConversionCsAssignment"("ownerAdminId");

CREATE TABLE IF NOT EXISTS "CrmConversionDomainHandoff" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT,
  "tenantId" TEXT,
  "handoffType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'EMITTED',
  "executionStatus" TEXT NOT NULL DEFAULT 'NOT_STARTED',
  "idempotencyKey" TEXT NOT NULL,
  "payloadJson" JSONB,
  "checksumSha256" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionDomainHandoff_idempotencyKey_key"
  ON "CrmConversionDomainHandoff"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionDomainHandoff_conversion_type_idx"
  ON "CrmConversionDomainHandoff"("conversionId", "handoffType");
CREATE INDEX IF NOT EXISTS "CrmConversionDomainHandoff_tenant_type_idx"
  ON "CrmConversionDomainHandoff"("tenantId", "handoffType");
CREATE INDEX IF NOT EXISTS "CrmConversionDomainHandoff_status_idx"
  ON "CrmConversionDomainHandoff"("status");

CREATE TABLE IF NOT EXISTS "CrmConversionCompletionCertificate" (
  "id" TEXT PRIMARY KEY,
  "conversionId" TEXT NOT NULL,
  "acceptanceId" TEXT,
  "documentVersionId" TEXT,
  "tenantId" TEXT,
  "checksumSha256" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "idempotencyKey" TEXT NOT NULL,
  "payloadJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConversionCompletionCertificate_idempotencyKey_key"
  ON "CrmConversionCompletionCertificate"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmConversionCompletionCertificate_conversionId_idx"
  ON "CrmConversionCompletionCertificate"("conversionId");
CREATE INDEX IF NOT EXISTS "CrmConversionCompletionCertificate_acceptanceId_idx"
  ON "CrmConversionCompletionCertificate"("acceptanceId");
CREATE INDEX IF NOT EXISTS "CrmConversionCompletionCertificate_checksum_idx"
  ON "CrmConversionCompletionCertificate"("checksumSha256");

CREATE TABLE IF NOT EXISTS "CrmConversionDqIncident" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "count" INTEGER NOT NULL DEFAULT 0,
  "detailJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionDqIncident_code_createdAt_idx"
  ON "CrmConversionDqIncident"("code", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmConversionDqIncident_severity_idx"
  ON "CrmConversionDqIncident"("severity");

CREATE TABLE IF NOT EXISTS "CrmConversionReconRun" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "cardsJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmConversionReconRun_status_createdAt_idx"
  ON "CrmConversionReconRun"("status", "createdAt");
