-- Phase 13 Wave 4 — Reminders + Activity templates + automation + Activity report schedules (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Reminder delivery ≠ Activity complete; automation SoD; no full sequences.
-- Never alias billing subscription reminders or CS playbook automation.

CREATE TABLE IF NOT EXISTS "CrmReminder" (
  "id" TEXT PRIMARY KEY,
  "dedupeKey" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "activityId" TEXT,
  "recipientAdminId" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'IN_APP',
  "occurrenceKey" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "dueAt" TIMESTAMP(3) NOT NULL,
  "snoozeUntil" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmReminder_dedupeKey_key" ON "CrmReminder"("dedupeKey");
CREATE INDEX IF NOT EXISTS "CrmReminder_activityId_status_idx" ON "CrmReminder"("activityId", "status");
CREATE INDEX IF NOT EXISTS "CrmReminder_recipient_status_due_idx"
  ON "CrmReminder"("recipientAdminId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmReminder_status_dueAt_idx" ON "CrmReminder"("status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmReminder_rule_occurrence_idx" ON "CrmReminder"("ruleKey", "occurrenceKey");

CREATE TABLE IF NOT EXISTS "CrmActivityTemplate" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TASK',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "titleTemplate" TEXT,
  "bodyTemplate" TEXT,
  "defaultsJson" JSONB,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmActivityTemplate_code_version_key"
  ON "CrmActivityTemplate"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmActivityTemplate_code_status_idx" ON "CrmActivityTemplate"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmActivityTemplate_kind_status_idx" ON "CrmActivityTemplate"("kind", "status");
CREATE INDEX IF NOT EXISTS "CrmActivityTemplate_createdByAdminId_idx" ON "CrmActivityTemplate"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmAutomationRule" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "name" TEXT,
  "trigger" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "configJson" JSONB,
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmAutomationRule_code_key" ON "CrmAutomationRule"("code");
CREATE INDEX IF NOT EXISTS "CrmAutomationRule_status_trigger_idx" ON "CrmAutomationRule"("status", "trigger");
CREATE INDEX IF NOT EXISTS "CrmAutomationRule_requestedByAdminId_idx" ON "CrmAutomationRule"("requestedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmAutomationRule_approvedByAdminId_idx" ON "CrmAutomationRule"("approvedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmAutomationApproval" (
  "id" TEXT PRIMARY KEY,
  "ruleId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "actorAdminId" TEXT,
  "note" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmAutomationApproval_ruleId_at_idx" ON "CrmAutomationApproval"("ruleId", "at");
CREATE INDEX IF NOT EXISTS "CrmAutomationApproval_actorAdminId_idx" ON "CrmAutomationApproval"("actorAdminId");

CREATE TABLE IF NOT EXISTS "CrmAutomationExecution" (
  "id" TEXT PRIMARY KEY,
  "ruleId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "trigger" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "status" TEXT NOT NULL,
  "resultJson" JSONB,
  "executedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmAutomationExecution_idempotencyKey_key"
  ON "CrmAutomationExecution"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmAutomationExecution_ruleId_at_idx" ON "CrmAutomationExecution"("ruleId", "at");
CREATE INDEX IF NOT EXISTS "CrmAutomationExecution_subject_idx"
  ON "CrmAutomationExecution"("subjectType", "subjectId");
CREATE INDEX IF NOT EXISTS "CrmAutomationExecution_status_at_idx" ON "CrmAutomationExecution"("status", "at");
CREATE INDEX IF NOT EXISTS "CrmAutomationExecution_executedByAdminId_idx"
  ON "CrmAutomationExecution"("executedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmActivityReportSchedule" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "activityType" TEXT,
  "cronExpression" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmActivityReportSchedule_status_createdAt_idx"
  ON "CrmActivityReportSchedule"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmActivityReportSchedule_createdByAdminId_idx"
  ON "CrmActivityReportSchedule"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmActivityReportRun" (
  "id" TEXT PRIMARY KEY,
  "scheduleId" TEXT,
  "status" TEXT NOT NULL,
  "summaryJson" JSONB,
  "runByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmActivityReportRun_scheduleId_at_idx" ON "CrmActivityReportRun"("scheduleId", "at");
CREATE INDEX IF NOT EXISTS "CrmActivityReportRun_status_at_idx" ON "CrmActivityReportRun"("status", "at");
CREATE INDEX IF NOT EXISTS "CrmActivityReportRun_runByAdminId_idx" ON "CrmActivityReportRun"("runByAdminId");
