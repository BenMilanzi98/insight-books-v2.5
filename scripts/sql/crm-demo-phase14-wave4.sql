-- Phase 14 Wave 4 — Delivery + attendance + recording gov + feedback + outcomes + handoffs + reports
-- Safe to re-run (IF NOT EXISTS). Apply when prisma generate hits EPERM.

ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "latestDeliverySessionId" TEXT;
ALTER TABLE "CrmDemo" ADD COLUMN IF NOT EXISTS "latestOutcomeId" TEXT;
CREATE INDEX IF NOT EXISTS "CrmDemo_latestDeliverySessionId_idx" ON "CrmDemo"("latestDeliverySessionId");
CREATE INDEX IF NOT EXISTS "CrmDemo_latestOutcomeId_idx" ON "CrmDemo"("latestOutcomeId");

CREATE TABLE IF NOT EXISTS "CrmDemoDeliverySession" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "startedByAdminId" TEXT,
  "endedByAdminId" TEXT,
  "agendaCoverageJson" JSONB,
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoDeliverySession_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoDeliverySession_idempotencyKey_key" ON "CrmDemoDeliverySession"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoDeliverySession_demoId_status_idx" ON "CrmDemoDeliverySession"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoDeliverySession_startedByAdminId_idx" ON "CrmDemoDeliverySession"("startedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoDeliverySession_endedByAdminId_idx" ON "CrmDemoDeliverySession"("endedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoLiveIssue" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "deliverySessionId" TEXT,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "detail" TEXT,
  "recordedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoLiveIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmDemoLiveIssue_demoId_status_idx" ON "CrmDemoLiveIssue"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoLiveIssue_deliverySessionId_idx" ON "CrmDemoLiveIssue"("deliverySessionId");
CREATE INDEX IF NOT EXISTS "CrmDemoLiveIssue_severity_idx" ON "CrmDemoLiveIssue"("severity");
CREATE INDEX IF NOT EXISTS "CrmDemoLiveIssue_recordedByAdminId_idx" ON "CrmDemoLiveIssue"("recordedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoCustomerQuestion" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "deliverySessionId" TEXT,
  "question" TEXT NOT NULL,
  "answer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "askedBy" TEXT,
  "recordedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoCustomerQuestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmDemoCustomerQuestion_demoId_status_idx" ON "CrmDemoCustomerQuestion"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoCustomerQuestion_deliverySessionId_idx" ON "CrmDemoCustomerQuestion"("deliverySessionId");
CREATE INDEX IF NOT EXISTS "CrmDemoCustomerQuestion_recordedByAdminId_idx" ON "CrmDemoCustomerQuestion"("recordedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoAttendance" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "participantRecordId" TEXT,
  "participantType" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "attendanceStatus" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "meetingParticipantId" TEXT,
  "recordedByAdminId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoAttendance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoAttendance_idempotencyKey_key" ON "CrmDemoAttendance"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoAttendance_demoId_attendanceStatus_idx" ON "CrmDemoAttendance"("demoId", "attendanceStatus");
CREATE INDEX IF NOT EXISTS "CrmDemoAttendance_participantType_participantId_idx" ON "CrmDemoAttendance"("participantType", "participantId");
CREATE INDEX IF NOT EXISTS "CrmDemoAttendance_source_idx" ON "CrmDemoAttendance"("source");
CREATE INDEX IF NOT EXISTS "CrmDemoAttendance_recordedByAdminId_idx" ON "CrmDemoAttendance"("recordedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoRecordingGov" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OFF',
  "consentStatus" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "contactId" TEXT,
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "deniedByAdminId" TEXT,
  "requestedAt" TIMESTAMP(3),
  "decidedAt" TIMESTAMP(3),
  "providerStatus" TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
  "mediaFileId" TEXT,
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoRecordingGov_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoRecordingGov_idempotencyKey_key" ON "CrmDemoRecordingGov"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_demoId_status_idx" ON "CrmDemoRecordingGov"("demoId", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_consentStatus_idx" ON "CrmDemoRecordingGov"("consentStatus");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_contactId_idx" ON "CrmDemoRecordingGov"("contactId");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_requestedByAdminId_idx" ON "CrmDemoRecordingGov"("requestedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_approvedByAdminId_idx" ON "CrmDemoRecordingGov"("approvedByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoRecordingGov_deniedByAdminId_idx" ON "CrmDemoRecordingGov"("deniedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoFeedbackForm" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "name" TEXT,
  "fieldsJson" JSONB,
  "authoredByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoFeedbackForm_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoFeedbackForm_code_version_key" ON "CrmDemoFeedbackForm"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackForm_code_status_idx" ON "CrmDemoFeedbackForm"("code", "status");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackForm_status_idx" ON "CrmDemoFeedbackForm"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackForm_authoredByAdminId_idx" ON "CrmDemoFeedbackForm"("authoredByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoFeedbackResponse" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "formId" TEXT,
  "score" DOUBLE PRECISION,
  "responsesJson" JSONB,
  "submittedBy" TEXT,
  "recordedByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoFeedbackResponse_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoFeedbackResponse_idempotencyKey_key" ON "CrmDemoFeedbackResponse"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackResponse_demoId_idx" ON "CrmDemoFeedbackResponse"("demoId");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackResponse_formId_idx" ON "CrmDemoFeedbackResponse"("formId");
CREATE INDEX IF NOT EXISTS "CrmDemoFeedbackResponse_recordedByAdminId_idx" ON "CrmDemoFeedbackResponse"("recordedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoOutcome" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "outcomeCode" TEXT NOT NULL,
  "completeness" TEXT NOT NULL DEFAULT 'COMPLETE',
  "success" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "opportunityId" TEXT,
  "recordedByAdminId" TEXT,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoOutcome_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoOutcome_idempotencyKey_key" ON "CrmDemoOutcome"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoOutcome_demoId_outcomeCode_idx" ON "CrmDemoOutcome"("demoId", "outcomeCode");
CREATE INDEX IF NOT EXISTS "CrmDemoOutcome_opportunityId_idx" ON "CrmDemoOutcome"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmDemoOutcome_recordedByAdminId_idx" ON "CrmDemoOutcome"("recordedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoHandoff" (
  "id" TEXT NOT NULL,
  "demoId" TEXT NOT NULL,
  "handoffType" TEXT NOT NULL,
  "payloadJson" JSONB,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoHandoff_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDemoHandoff_idempotencyKey_key" ON "CrmDemoHandoff"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmDemoHandoff_demoId_handoffType_idx" ON "CrmDemoHandoff"("demoId", "handoffType");
CREATE INDEX IF NOT EXISTS "CrmDemoHandoff_createdByAdminId_idx" ON "CrmDemoHandoff"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoReportSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cronExpression" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "lastRunStatus" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoReportSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmDemoReportSchedule_status_idx" ON "CrmDemoReportSchedule"("status");
CREATE INDEX IF NOT EXISTS "CrmDemoReportSchedule_createdByAdminId_idx" ON "CrmDemoReportSchedule"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmDemoReportRun" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT,
  "status" TEXT NOT NULL,
  "summaryJson" JSONB,
  "runByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDemoReportRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "CrmDemoReportRun_scheduleId_at_idx" ON "CrmDemoReportRun"("scheduleId", "at");
CREATE INDEX IF NOT EXISTS "CrmDemoReportRun_runByAdminId_idx" ON "CrmDemoReportRun"("runByAdminId");
CREATE INDEX IF NOT EXISTS "CrmDemoReportRun_status_idx" ON "CrmDemoReportRun"("status");
