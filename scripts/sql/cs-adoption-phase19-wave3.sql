-- Phase 19 Wave 3 — Champions, dormancy cases, Phase 8 intervention links, expansion handoffs (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Champions: contact-verified; no engagement scores.
-- Dormancy: VALUE_THEN_INACTIVE / inactive-class; analytics missing → UNAVAILABLE.
-- RECOVERED requires usage-return snapshot and/or attested outreach.
-- Expansion: DRAFT → HANDED_OFF → ACKNOWLEDGED; no Subscription/entitlement/invoice/GL writes.

CREATE TABLE IF NOT EXISTS "CustomerAdoptionChampion" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'CHAMPION',
  "enablementStatus" TEXT NOT NULL DEFAULT 'IDENTIFIED',
  "lastEvidenceRef" TEXT,
  "tenantId" TEXT,
  "customerId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionChampion_planId_contactId_role_key"
  ON "CustomerAdoptionChampion"("planId", "contactId", "role");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionChampion_planId_enablementStatus_idx"
  ON "CustomerAdoptionChampion"("planId", "enablementStatus");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionChampion_contactId_idx"
  ON "CustomerAdoptionChampion"("contactId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionChampion_tenantId_idx"
  ON "CustomerAdoptionChampion"("tenantId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionDormancyCase" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "tenantId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "signalIdentity" TEXT,
  "signalCode" TEXT,
  "featureCode" TEXT,
  "interventionId" TEXT,
  "playbookExecutionId" TEXT,
  "usageReturnSnapshotJson" JSONB,
  "outreachAttestedAt" TIMESTAMP(3),
  "outreachAttestedByAdminId" TEXT,
  "outcomeReason" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionDormancyCase_idempotencyKey_key"
  ON "CustomerAdoptionDormancyCase"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionDormancyCase_planId_status_idx"
  ON "CustomerAdoptionDormancyCase"("planId", "status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionDormancyCase_tenantId_status_idx"
  ON "CustomerAdoptionDormancyCase"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionDormancyCase_signalCode_idx"
  ON "CustomerAdoptionDormancyCase"("signalCode");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionDormancyCase_interventionId_idx"
  ON "CustomerAdoptionDormancyCase"("interventionId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionInterventionLink" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "dormancyCaseId" TEXT NOT NULL,
  "interventionId" TEXT NOT NULL,
  "playbookExecutionId" TEXT,
  "outcomeAttestationJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionInterventionLink_dormancyCaseId_interventionId_key"
  ON "CustomerAdoptionInterventionLink"("dormancyCaseId", "interventionId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionInterventionLink_planId_idx"
  ON "CustomerAdoptionInterventionLink"("planId");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionInterventionLink_interventionId_idx"
  ON "CustomerAdoptionInterventionLink"("interventionId");

CREATE TABLE IF NOT EXISTS "CustomerAdoptionExpansionHandoff" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "tenantId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "targetQueue" TEXT NOT NULL,
  "signalPackageJson" JSONB,
  "evidenceRefsJson" JSONB,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "handedOffAt" TIMESTAMP(3),
  "handedOffByAdminId" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "acknowledgedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerAdoptionExpansionHandoff_idempotencyKey_key"
  ON "CustomerAdoptionExpansionHandoff"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionExpansionHandoff_planId_status_idx"
  ON "CustomerAdoptionExpansionHandoff"("planId", "status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionExpansionHandoff_tenantId_status_idx"
  ON "CustomerAdoptionExpansionHandoff"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "CustomerAdoptionExpansionHandoff_targetQueue_idx"
  ON "CustomerAdoptionExpansionHandoff"("targetQueue");
