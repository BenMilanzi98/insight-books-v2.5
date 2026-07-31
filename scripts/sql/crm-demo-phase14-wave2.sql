-- Phase 14 Wave 2 — Demo Agenda / Script / Scenario / Content versioning + Demo pin columns.
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- ACTIVE versions are not directly editable; SoD author ≠ approver for material approve.
-- RESTRICTED Script never on invitations / Customer APIs.
-- Historical Demo retains pinned version ids.

ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "pinnedAgendaId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "pinnedScriptId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "pinnedScenarioId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "pinnedContentId" TEXT;
CREATE INDEX IF NOT EXISTS "CrmDemo_pinnedAgendaId_idx" ON "CrmDemo"("pinnedAgendaId");
CREATE INDEX IF NOT EXISTS "CrmDemo_pinnedScriptId_idx" ON "CrmDemo"("pinnedScriptId");
CREATE INDEX IF NOT EXISTS "CrmDemo_pinnedScenarioId_idx" ON "CrmDemo"("pinnedScenarioId");
CREATE INDEX IF NOT EXISTS "CrmDemo_pinnedContentId_idx" ON "CrmDemo"("pinnedContentId");

CREATE TABLE IF NOT EXISTS "CrmDemoAgenda" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "itemsJson" JSONB,
  "customerSafeSummary" TEXT,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoAgenda_code_version_key" ON "CrmDemoAgenda"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoAgenda_code_status_idx" ON "CrmDemoAgenda"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoAgenda_status_idx" ON "CrmDemoAgenda"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoAgenda_authoredByAdminId_idx" ON "CrmDemoAgenda"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoAgenda_approvedByAdminId_idx" ON "CrmDemoAgenda"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoScript" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
  "bodyInternal" TEXT,
  "bodyCustomerSafe" TEXT,
  "labelsJson" JSONB,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoScript_code_version_key" ON "CrmDemoScript"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoScript_code_status_idx" ON "CrmDemoScript"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoScript_status_classification_idx" ON "CrmDemoScript"("status", "classification");
CREATE INDEX IF NOT EXISTS "CrmDemoScript_authoredByAdminId_idx" ON "CrmDemoScript"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoScript_approvedByAdminId_idx" ON "CrmDemoScript"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoScenario" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
  "bodyJson" JSONB,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoScenario_code_version_key" ON "CrmDemoScenario"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoScenario_code_status_idx" ON "CrmDemoScenario"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoScenario_status_idx" ON "CrmDemoScenario"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoScenario_authoredByAdminId_idx" ON "CrmDemoScenario"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoScenario_approvedByAdminId_idx" ON "CrmDemoScenario"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoContent" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "kind" TEXT NOT NULL DEFAULT 'OTHER',
  "classification" TEXT NOT NULL DEFAULT 'INTERNAL',
  "assetRef" TEXT,
  "bodyJson" JSONB,
  "authoredByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoContent_code_version_key" ON "CrmDemoContent"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoContent_code_status_idx" ON "CrmDemoContent"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoContent_kind_status_idx" ON "CrmDemoContent"("kind", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoContent_status_classification_idx" ON "CrmDemoContent"("status", "classification");
CREATE INDEX IF NOT EXISTS "CrmDemoContent_authoredByAdminId_idx" ON "CrmDemoContent"("authoredByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoContent_approvedByAdminId_idx" ON "CrmDemoContent"("approvedByAdminId");
