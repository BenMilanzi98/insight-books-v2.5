-- Phase 11 Wave 4 — timeline / notes / tasks / merge / recon / export (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- CrmLead ≠ Opportunity ≠ Customer ≠ SupportTicket ≠ CsCase.
-- Opportunity readiness never creates Opportunity.
-- Never store Tenant GL, payment secrets, or MRA credentials.

ALTER TABLE "CrmLead" ADD COLUMN IF NOT EXISTS "mergedIntoLeadId" TEXT;
CREATE INDEX IF NOT EXISTS "CrmLead_mergedIntoLeadId_idx" ON "CrmLead"("mergedIntoLeadId");

CREATE TABLE IF NOT EXISTS "CrmTimelineEvent" (
  "id" TEXT PRIMARY KEY,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "summary" TEXT,
  "payload" JSONB,
  "actorAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmTimelineEvent_subject_at_idx"
  ON "CrmTimelineEvent"("subjectType", "subjectId", "at");
CREATE INDEX IF NOT EXISTS "CrmTimelineEvent_eventType_at_idx"
  ON "CrmTimelineEvent"("eventType", "at");
CREATE INDEX IF NOT EXISTS "CrmTimelineEvent_actorAdminId_idx"
  ON "CrmTimelineEvent"("actorAdminId");

CREATE TABLE IF NOT EXISTS "CrmNote" (
  "id" TEXT PRIMARY KEY,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
  "authorAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmNote_subject_createdAt_idx"
  ON "CrmNote"("subjectType", "subjectId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmNote_visibility_idx" ON "CrmNote"("visibility");
CREATE INDEX IF NOT EXISTS "CrmNote_authorAdminId_idx" ON "CrmNote"("authorAdminId");

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id" TEXT PRIMARY KEY,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "dueAt" TIMESTAMP(3),
  "assigneeAdminId" TEXT,
  "createdByAdminId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmTask_subject_status_idx"
  ON "CrmTask"("subjectType", "subjectId", "status");
CREATE INDEX IF NOT EXISTS "CrmTask_assignee_status_idx"
  ON "CrmTask"("assigneeAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmTask_status_dueAt_idx" ON "CrmTask"("status", "dueAt");

CREATE TABLE IF NOT EXISTS "CrmMergeRequest" (
  "id" TEXT PRIMARY KEY,
  "entityType" TEXT NOT NULL DEFAULT 'LEAD',
  "survivorId" TEXT NOT NULL,
  "loserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "executedByAdminId" TEXT,
  "duplicateCandidateId" TEXT,
  "reason" TEXT,
  "evidenceJson" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmMergeRequest_status_createdAt_idx"
  ON "CrmMergeRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmMergeRequest_survivorId_idx" ON "CrmMergeRequest"("survivorId");
CREATE INDEX IF NOT EXISTS "CrmMergeRequest_loserId_idx" ON "CrmMergeRequest"("loserId");
CREATE INDEX IF NOT EXISTS "CrmMergeRequest_entity_status_idx"
  ON "CrmMergeRequest"("entityType", "status");

CREATE TABLE IF NOT EXISTS "CrmReconciliationRun" (
  "id" TEXT PRIMARY KEY,
  "status" TEXT NOT NULL,
  "summaryJson" JSONB,
  "runByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmReconciliationRun_at_idx" ON "CrmReconciliationRun"("at");
CREATE INDEX IF NOT EXISTS "CrmReconciliationRun_status_at_idx"
  ON "CrmReconciliationRun"("status", "at");

CREATE TABLE IF NOT EXISTS "CrmExportAudit" (
  "id" TEXT PRIMARY KEY,
  "dataset" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "exportedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmExportAudit_at_idx" ON "CrmExportAudit"("at");
CREATE INDEX IF NOT EXISTS "CrmExportAudit_dataset_at_idx"
  ON "CrmExportAudit"("dataset", "at");
