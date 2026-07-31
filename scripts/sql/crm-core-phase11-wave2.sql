-- Phase 11 Wave 2 — CrmCaptureRecord, CrmDuplicateCandidate (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Apply steps (EPERM fallback):
--   1. Ensure Wave 1 tables exist (scripts/sql/crm-core-phase11-wave1.sql)
--   2. psql "$DATABASE_URL" -f scripts/sql/crm-core-phase11-wave2.sql
--   3. App code uses hasCrmCaptureRecordModel / hasCrmDuplicateCandidateModel guards
--   4. Retry `npx prisma generate` when the query-engine file lock clears.
--
-- CrmLead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase.
-- No auto-merge. Never store Tenant GL, payment secrets, or MRA credentials.

CREATE TABLE IF NOT EXISTS "CrmCaptureRecord" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "sourceCode" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "sourceIdempotencyKey" TEXT NOT NULL,
  "emailNormalized" TEXT,
  "phoneNormalized" TEXT,
  "handoffRefType" TEXT,
  "handoffRefId" TEXT,
  "businessName" TEXT,
  "contactName" TEXT,
  "payload" JSONB,
  "consentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "consentPurposes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmCaptureRecord_sourceIdempotencyKey_key"
  ON "CrmCaptureRecord"("sourceIdempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCaptureRecord_leadId_idx"
  ON "CrmCaptureRecord"("leadId");
CREATE INDEX IF NOT EXISTS "CrmCaptureRecord_emailNormalized_idx"
  ON "CrmCaptureRecord"("emailNormalized");
CREATE INDEX IF NOT EXISTS "CrmCaptureRecord_phoneNormalized_idx"
  ON "CrmCaptureRecord"("phoneNormalized");
CREATE INDEX IF NOT EXISTS "CrmCaptureRecord_handoffRefType_handoffRefId_idx"
  ON "CrmCaptureRecord"("handoffRefType", "handoffRefId");
CREATE INDEX IF NOT EXISTS "CrmCaptureRecord_sourceCode_createdAt_idx"
  ON "CrmCaptureRecord"("sourceCode", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmDuplicateCandidate" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT NOT NULL,
  "candidateLeadId" TEXT NOT NULL,
  "matchType" TEXT NOT NULL,
  "matchValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "confidence" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "decisionReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmDuplicateCandidate_leadId_candidateLeadId_matchType_key"
  ON "CrmDuplicateCandidate"("leadId", "candidateLeadId", "matchType");
CREATE INDEX IF NOT EXISTS "CrmDuplicateCandidate_status_createdAt_idx"
  ON "CrmDuplicateCandidate"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmDuplicateCandidate_leadId_idx"
  ON "CrmDuplicateCandidate"("leadId");
CREATE INDEX IF NOT EXISTS "CrmDuplicateCandidate_candidateLeadId_idx"
  ON "CrmDuplicateCandidate"("candidateLeadId");
CREATE INDEX IF NOT EXISTS "CrmDuplicateCandidate_reviewedByAdminId_idx"
  ON "CrmDuplicateCandidate"("reviewedByAdminId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmCaptureRecord_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmCaptureRecord"
      ADD CONSTRAINT "CrmCaptureRecord_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDuplicateCandidate_leadId_fkey'
  ) THEN
    ALTER TABLE "CrmDuplicateCandidate"
      ADD CONSTRAINT "CrmDuplicateCandidate_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDuplicateCandidate_candidateLeadId_fkey'
  ) THEN
    ALTER TABLE "CrmDuplicateCandidate"
      ADD CONSTRAINT "CrmDuplicateCandidate_candidateLeadId_fkey"
      FOREIGN KEY ("candidateLeadId") REFERENCES "CrmLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CrmDuplicateCandidate_reviewedByAdminId_fkey'
  ) THEN
    ALTER TABLE "CrmDuplicateCandidate"
      ADD CONSTRAINT "CrmDuplicateCandidate_reviewedByAdminId_fkey"
      FOREIGN KEY ("reviewedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;
