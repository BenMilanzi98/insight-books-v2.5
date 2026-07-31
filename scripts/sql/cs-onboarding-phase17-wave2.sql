-- Phase 17 Wave 2 — Templates materialisation, kick-off, stakeholders, tasks/evidence, scope/CR.
-- Prefer: npx prisma db push + npx prisma generate.
-- Use when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Materialise Workstreams/Milestones/Tasks/Checklists once.
-- Kick-off links Phase 13 CrmMeeting; RSVP ≠ attendance.
-- Scope mismatch → Change Request; never mutates Subscription entitlements.
-- Customer evidence = admin attestation; portal = CUSTOMER_PORTAL_NOT_CONFIGURED.

ALTER TABLE "CustomerOnboardingTemplateVersion"
  ADD COLUMN IF NOT EXISTS "approvedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "activatedByAdminId" TEXT,
  ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTemplate" (
  "id" TEXT PRIMARY KEY,
  "templateCode" TEXT NOT NULL,
  "name" TEXT,
  "onboardingType" TEXT NOT NULL DEFAULT 'STANDARD',
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingTemplate_templateCode_key"
  ON "CustomerOnboardingTemplate"("templateCode");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTemplate_type_status_idx"
  ON "CustomerOnboardingTemplate"("onboardingType", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingMaterialisation" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "templateVersionId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "workstreamCount" INTEGER,
  "milestoneCount" INTEGER,
  "taskCount" INTEGER,
  "checklistCount" INTEGER,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingMaterialisation_idempotencyKey_key"
  ON "CustomerOnboardingMaterialisation"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingMaterialisation_projectId_key"
  ON "CustomerOnboardingMaterialisation"("projectId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingMaterialisation_templateVersionId_idx"
  ON "CustomerOnboardingMaterialisation"("templateVersionId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingWorkstream" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "templateVersionId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingWorkstream_project_code_key"
  ON "CustomerOnboardingWorkstream"("projectId", "code");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingWorkstream_project_seq_idx"
  ON "CustomerOnboardingWorkstream"("projectId", "sequence");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingMilestone" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "workstreamId" TEXT,
  "templateVersionId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingMilestone_project_code_key"
  ON "CustomerOnboardingMilestone"("projectId", "code");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingMilestone_project_seq_idx"
  ON "CustomerOnboardingMilestone"("projectId", "sequence");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTask" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "workstreamId" TEXT,
  "templateVersionId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "actorType" TEXT NOT NULL DEFAULT 'INTERNAL',
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "assigneeAdminId" TEXT,
  "assigneeContactId" TEXT,
  "completionSource" TEXT,
  "waiverReason" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedByAdminId" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingTask_project_code_key"
  ON "CustomerOnboardingTask"("projectId", "code");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTask_project_actor_status_idx"
  ON "CustomerOnboardingTask"("projectId", "actorType", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingChecklist" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "workstreamId" TEXT,
  "templateVersionId" TEXT,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingChecklist_project_code_key"
  ON "CustomerOnboardingChecklist"("projectId", "code");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingChecklist_project_seq_idx"
  ON "CustomerOnboardingChecklist"("projectId", "sequence");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingKickoff" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "crmMeetingId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "proposedAt" TIMESTAMP(3),
  "timezone" TEXT,
  "agendaJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "rsvpSummaryJson" JSONB,
  "attendanceSummaryJson" JSONB,
  "kickoffCompleted" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingKickoff_idempotencyKey_key"
  ON "CustomerOnboardingKickoff"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingKickoff_projectId_key"
  ON "CustomerOnboardingKickoff"("projectId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingKickoff_crmMeetingId_idx"
  ON "CustomerOnboardingKickoff"("crmMeetingId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingStakeholder" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  "party" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingStakeholder_project_contact_role_key"
  ON "CustomerOnboardingStakeholder"("projectId", "contactId", "role");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingStakeholder_project_role_idx"
  ON "CustomerOnboardingStakeholder"("projectId", "role");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingRequirement" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "confirmedScopeJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "confirmedByAdminId" TEXT,
  "confirmedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingRequirement_projectId_key"
  ON "CustomerOnboardingRequirement"("projectId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingScopeItem" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "itemType" TEXT NOT NULL,
  "itemKey" TEXT NOT NULL,
  "itemValue" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingScopeItem_project_type_idx"
  ON "CustomerOnboardingScopeItem"("projectId", "itemType");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingChangeRequest" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "title" TEXT,
  "description" TEXT,
  "requestedScopeJson" JSONB,
  "confirmedScopeJson" JSONB,
  "commercialHandoffRequired" BOOLEAN NOT NULL DEFAULT TRUE,
  "subscriptionMutated" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingChangeRequest_project_reason_status_idx"
  ON "CustomerOnboardingChangeRequest"("projectId", "reasonCode", "status");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTaskEvidence" (
  "id" TEXT PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "projectId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'EVIDENCE_SUBMITTED',
  "fileRef" TEXT,
  "note" TEXT,
  "contactId" TEXT,
  "attestedByAdminId" TEXT,
  "attestedAt" TIMESTAMP(3),
  "attestationReason" TEXT,
  "reviewDecision" TEXT,
  "reviewReason" TEXT,
  "rejectReason" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTaskEvidence_task_status_idx"
  ON "CustomerOnboardingTaskEvidence"("taskId", "status");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTaskEvidence_projectId_idx"
  ON "CustomerOnboardingTaskEvidence"("projectId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingTaskDependency" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "predecessorTaskId" TEXT NOT NULL,
  "successorTaskId" TEXT NOT NULL,
  "dependencyType" TEXT NOT NULL DEFAULT 'FINISH_TO_START',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerOnboardingTaskDependency_pred_succ_key"
  ON "CustomerOnboardingTaskDependency"("predecessorTaskId", "successorTaskId");
CREATE INDEX IF NOT EXISTS "CustomerOnboardingTaskDependency_projectId_idx"
  ON "CustomerOnboardingTaskDependency"("projectId");

CREATE TABLE IF NOT EXISTS "CustomerOnboardingResponsibility" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "party" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerOnboardingResponsibility_project_party_status_idx"
  ON "CustomerOnboardingResponsibility"("projectId", "party", "status");
