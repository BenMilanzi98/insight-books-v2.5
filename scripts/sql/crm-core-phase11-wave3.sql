-- Phase 11 Wave 3 — qualification, scoring, teams/territories/assignment, consent/DNC (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. Ensure Wave 1–2 tables exist
--   2. psql "$DATABASE_URL" -f scripts/sql/crm-core-phase11-wave3.sql
--   3. App code uses hasCrm*Model guards
--   4. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- CrmLead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase.
-- Score ≠ probability / conversion chance / expected revenue.
-- Never store Tenant GL, payment secrets, or MRA credentials.

-- Lead ownership / acceptance SLA foundation
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "territoryId" TEXT;
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3);
ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "CrmLead_teamId_status_idx" ON "CrmLead"("teamId", "status");
CREATE INDEX IF NOT EXISTS "CrmLead_territoryId_idx" ON "CrmLead"("territoryId");

CREATE TABLE IF NOT EXISTS "CrmQualificationDefinition" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmQualificationDefinition_key_key"
  ON "CrmQualificationDefinition"("key");
CREATE INDEX IF NOT EXISTS "CrmQualificationDefinition_status_idx"
  ON "CrmQualificationDefinition"("status");

CREATE TABLE IF NOT EXISTS "CrmQualificationDefinitionVersion" (
  "id" TEXT PRIMARY KEY,
  "definitionId" TEXT,
  "key" TEXT,
  "name" TEXT,
  "versionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "criteriaJson" JSONB NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmQualificationDefinitionVersion_versionId_key"
  ON "CrmQualificationDefinitionVersion"("versionId");
CREATE INDEX IF NOT EXISTS "CrmQualificationDefinitionVersion_status_createdAt_idx"
  ON "CrmQualificationDefinitionVersion"("status", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmQualificationResponse" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "definitionVersionId" TEXT NOT NULL,
  "criterionKey" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "note" TEXT,
  "answeredByAdminId" TEXT,
  "answeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "overrideReason" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmQualificationResponse_lead_version_criterion_key"
  ON "CrmQualificationResponse"("leadId", "definitionVersionId", "criterionKey");
CREATE INDEX IF NOT EXISTS "CrmQualificationResponse_leadId_definitionVersionId_idx"
  ON "CrmQualificationResponse"("leadId", "definitionVersionId");

CREATE TABLE IF NOT EXISTS "CrmScoreDefinition" (
  "id" TEXT PRIMARY KEY,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmScoreDefinition_key_key" ON "CrmScoreDefinition"("key");

CREATE TABLE IF NOT EXISTS "CrmScoreDefinitionVersion" (
  "id" TEXT PRIMARY KEY,
  "definitionId" TEXT,
  "key" TEXT,
  "name" TEXT,
  "versionId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "displayLabel" TEXT NOT NULL DEFAULT 'Lead fit score',
  "dimensionsJson" JSONB NOT NULL,
  "bandsJson" JSONB NOT NULL,
  "criticalCapsJson" JSONB NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmScoreDefinitionVersion_versionId_key"
  ON "CrmScoreDefinitionVersion"("versionId");

CREATE TABLE IF NOT EXISTS "CrmScoreEvaluation" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "definitionVersionId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "band" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "capped" BOOLEAN NOT NULL DEFAULT false,
  "capKey" TEXT,
  "displayLabel" TEXT NOT NULL DEFAULT 'Lead fit score',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmScoreEvaluation_leadId_createdAt_idx"
  ON "CrmScoreEvaluation"("leadId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmScoreEvaluation_definitionVersionId_idx"
  ON "CrmScoreEvaluation"("definitionVersionId");

CREATE TABLE IF NOT EXISTS "CrmScoreContribution" (
  "id" TEXT PRIMARY KEY,
  "evaluationId" TEXT NOT NULL,
  "dimensionKey" TEXT NOT NULL,
  "label" TEXT,
  "weight" DOUBLE PRECISION NOT NULL,
  "maxPoints" DOUBLE PRECISION NOT NULL,
  "rawValue" DOUBLE PRECISION,
  "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "missing" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS "CrmScoreContribution_evaluationId_idx"
  ON "CrmScoreContribution"("evaluationId");

CREATE TABLE IF NOT EXISTS "CrmSalesTeam" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmSalesTeam_code_key" ON "CrmSalesTeam"("code");

CREATE TABLE IF NOT EXISTS "CrmSalesTeamMember" (
  "id" TEXT PRIMARY KEY,
  "teamId" TEXT NOT NULL,
  "adminId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmSalesTeamMember_teamId_adminId_key"
  ON "CrmSalesTeamMember"("teamId", "adminId");

CREATE TABLE IF NOT EXISTS "CrmTerritory" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "defaultTeamId" TEXT,
  "defaultOwnerAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTerritory_code_key" ON "CrmTerritory"("code");

CREATE TABLE IF NOT EXISTS "CrmTerritoryRule" (
  "id" TEXT PRIMARY KEY,
  "territoryId" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "matchValue" TEXT NOT NULL,
  "precedence" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmTerritoryRule_territoryId_precedence_idx"
  ON "CrmTerritoryRule"("territoryId", "precedence");

CREATE TABLE IF NOT EXISTS "CrmAssignmentHistory" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "strategy" TEXT,
  "fromOwnerAdminId" TEXT,
  "toOwnerAdminId" TEXT,
  "fromTeamId" TEXT,
  "toTeamId" TEXT,
  "territoryId" TEXT,
  "changedByAdminId" TEXT,
  "reason" TEXT,
  "assignedAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmAssignmentHistory_leadId_at_idx"
  ON "CrmAssignmentHistory"("leadId", "at");
CREATE INDEX IF NOT EXISTS "CrmAssignmentHistory_toOwnerAdminId_at_idx"
  ON "CrmAssignmentHistory"("toOwnerAdminId", "at");

CREATE TABLE IF NOT EXISTS "CrmConsentRecord" (
  "id" TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT NOT NULL,
  "evidence" TEXT,
  "channel" TEXT,
  "grantedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmConsentRecord_contactId_purpose_key"
  ON "CrmConsentRecord"("contactId", "purpose");
CREATE INDEX IF NOT EXISTS "CrmConsentRecord_contactId_status_idx"
  ON "CrmConsentRecord"("contactId", "status");

CREATE TABLE IF NOT EXISTS "CrmCommunicationPreference" (
  "id" TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "preference" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "source" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommunicationPreference_contactId_channel_key"
  ON "CrmCommunicationPreference"("contactId", "channel");

CREATE TABLE IF NOT EXISTS "CrmDoNotContact" (
  "id" TEXT PRIMARY KEY,
  "contactId" TEXT NOT NULL,
  "flag" TEXT NOT NULL,
  "reason" TEXT,
  "source" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "setAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "setByAdminId" TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDoNotContact_contactId_flag_key"
  ON "CrmDoNotContact"("contactId", "flag");
CREATE INDEX IF NOT EXISTS "CrmDoNotContact_contactId_active_idx"
  ON "CrmDoNotContact"("contactId", "active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmQualificationResponse_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmQualificationResponse"
      ADD CONSTRAINT "CrmQualificationResponse_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmScoreEvaluation_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmScoreEvaluation"
      ADD CONSTRAINT "CrmScoreEvaluation_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmScoreContribution_evaluationId_fkey'
  ) THEN
    ALTER TABLE "CrmScoreContribution"
      ADD CONSTRAINT "CrmScoreContribution_evaluationId_fkey"
      FOREIGN KEY ("evaluationId") REFERENCES "CrmScoreEvaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmSalesTeamMember_teamId_fkey'
  ) THEN
    ALTER TABLE "CrmSalesTeamMember"
      ADD CONSTRAINT "CrmSalesTeamMember_teamId_fkey"
      FOREIGN KEY ("teamId") REFERENCES "CrmSalesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmTerritoryRule_territoryId_fkey'
  ) THEN
    ALTER TABLE "CrmTerritoryRule"
      ADD CONSTRAINT "CrmTerritoryRule_territoryId_fkey"
      FOREIGN KEY ("territoryId") REFERENCES "CrmTerritory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmAssignmentHistory_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmAssignmentHistory"
      ADD CONSTRAINT "CrmAssignmentHistory_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmConsentRecord_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmConsentRecord"
      ADD CONSTRAINT "CrmConsentRecord_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmCommunicationPreference_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmCommunicationPreference"
      ADD CONSTRAINT "CrmCommunicationPreference_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDoNotContact_contactId_fkey'
  ) THEN
    ALTER TABLE "CrmDoNotContact"
      ADD CONSTRAINT "CrmDoNotContact_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
