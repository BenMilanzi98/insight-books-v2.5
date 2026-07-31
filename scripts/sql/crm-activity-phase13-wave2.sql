-- Phase 13 Wave 2 — CrmCall + CrmEmailActivity (SMTP) + templates (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Manual/planned Calls only; telephony + recording NOT_AVAILABLE.
-- SMTP accept ≠ delivered; no fabricated opens/replies; no tracking pixels.
-- Never alias Support email threads as CRM Email Activity.

CREATE TABLE IF NOT EXISTS "CrmCall" (
  "id" TEXT PRIMARY KEY,
  "callNumber" TEXT NOT NULL,
  "activityId" TEXT,
  "direction" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PLANNED',
  "outcome" TEXT,
  "contactId" TEXT,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "phoneNumber" TEXT,
  "scheduledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "consentBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "eligibilityJson" JSONB,
  "notes" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCall_callNumber_key" ON "CrmCall"("callNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCall_idempotencyKey_key" ON "CrmCall"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCall_activityId_idx" ON "CrmCall"("activityId");
CREATE INDEX IF NOT EXISTS "CrmCall_subject_status_idx"
  ON "CrmCall"("subjectType", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "CrmCall_status_scheduledAt_idx" ON "CrmCall"("status", "scheduledAt");
CREATE INDEX IF NOT EXISTS "CrmCall_owner_status_idx" ON "CrmCall"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmCall_contactId_idx" ON "CrmCall"("contactId");

CREATE TABLE IF NOT EXISTS "CrmEmailActivity" (
  "id" TEXT PRIMARY KEY,
  "activityId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "direction" TEXT NOT NULL DEFAULT 'OUTBOUND',
  "contactId" TEXT,
  "toAddress" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "bodyText" TEXT,
  "templateCode" TEXT,
  "templateVersion" INTEGER,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "purpose" TEXT,
  "consentBlocked" BOOLEAN NOT NULL DEFAULT FALSE,
  "eligibilityJson" JSONB,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmEmailActivity_idempotencyKey_key"
  ON "CrmEmailActivity"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_activityId_idx" ON "CrmEmailActivity"("activityId");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_subject_status_idx"
  ON "CrmEmailActivity"("subjectType", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_status_createdAt_idx"
  ON "CrmEmailActivity"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_owner_status_idx"
  ON "CrmEmailActivity"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_contactId_idx" ON "CrmEmailActivity"("contactId");
CREATE INDEX IF NOT EXISTS "CrmEmailActivity_toAddress_idx" ON "CrmEmailActivity"("toAddress");

CREATE TABLE IF NOT EXISTS "CrmEmailSendRequest" (
  "id" TEXT PRIMARY KEY,
  "emailActivityId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "providerMessageId" TEXT,
  "providerResponse" TEXT,
  "error" TEXT,
  "eligibilityJson" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmEmailSendRequest_idempotencyKey_key"
  ON "CrmEmailSendRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmEmailSendRequest_email_status_idx"
  ON "CrmEmailSendRequest"("emailActivityId", "status");
CREATE INDEX IF NOT EXISTS "CrmEmailSendRequest_status_requestedAt_idx"
  ON "CrmEmailSendRequest"("status", "requestedAt");

CREATE TABLE IF NOT EXISTS "CrmEmailDeliveryEvent" (
  "id" TEXT PRIMARY KEY,
  "sendRequestId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "evidenceJson" JSONB,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmEmailDeliveryEvent_request_at_idx"
  ON "CrmEmailDeliveryEvent"("sendRequestId", "at");
CREATE INDEX IF NOT EXISTS "CrmEmailDeliveryEvent_type_at_idx"
  ON "CrmEmailDeliveryEvent"("eventType", "at");

CREATE TABLE IF NOT EXISTS "CrmEmailTemplate" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "subjectTemplate" TEXT NOT NULL,
  "bodyHtmlTemplate" TEXT NOT NULL DEFAULT '',
  "bodyTextTemplate" TEXT NOT NULL DEFAULT '',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmEmailTemplate_code_version_key"
  ON "CrmEmailTemplate"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmEmailTemplate_code_status_idx"
  ON "CrmEmailTemplate"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmEmailTemplate_status_idx" ON "CrmEmailTemplate"("status");
