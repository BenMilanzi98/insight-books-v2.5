-- Phase 18 Wave 3 — Exercises, assessments, attempts, results, regrades,
-- participant/program completion, certificates.
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Assessment timing/attempt limits are server-authoritative.
-- Final results immutable (regrade preserves original).
-- Certificates: IB-TRN-CERT-YYYY-###### via CrmNumberSeq prefix IB-TRN-CERT.

CREATE TABLE IF NOT EXISTS "CustomerTrainingExercise" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "title" TEXT,
  "evidenceRef" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "reviewDecision" TEXT,
  "reviewReason" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewIdempotencyKey" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingExercise_idempotencyKey_key"
  ON "CustomerTrainingExercise"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingExercise_program_participant_idx"
  ON "CustomerTrainingExercise"("programId", "participantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingExercise_status_idx"
  ON "CustomerTrainingExercise"("status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAssessment" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "title" TEXT,
  "assessmentType" TEXT NOT NULL DEFAULT 'KNOWLEDGE_CHECK',
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingAssessment_idempotencyKey_key"
  ON "CustomerTrainingAssessment"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessment_program_status_idx"
  ON "CustomerTrainingAssessment"("programId", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAssessmentVersion" (
  "id" TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "maxAttempts" INTEGER NOT NULL DEFAULT 2,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "passScore" INTEGER NOT NULL DEFAULT 70,
  "questionsJson" JSONB,
  "immutable" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessmentVersion_assessment_idx"
  ON "CustomerTrainingAssessmentVersion"("assessmentId", "versionNumber");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAssessmentAttempt" (
  "id" TEXT PRIMARY KEY,
  "assessmentId" TEXT NOT NULL,
  "assessmentVersionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "programId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "attemptNumber" INTEGER NOT NULL DEFAULT 1,
  "serverStartedAt" TIMESTAMP(3),
  "serverEndsAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "answersJson" JSONB,
  "clientTimerExpiredClaim" BOOLEAN,
  "countsTowardLimit" BOOLEAN NOT NULL DEFAULT TRUE,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingAssessmentAttempt_idempotencyKey_key"
  ON "CustomerTrainingAssessmentAttempt"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessmentAttempt_version_participant_idx"
  ON "CustomerTrainingAssessmentAttempt"("assessmentVersionId", "participantId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessmentAttempt_program_idx"
  ON "CustomerTrainingAssessmentAttempt"("programId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAssessmentResult" (
  "id" TEXT PRIMARY KEY,
  "attemptId" TEXT NOT NULL,
  "assessmentVersionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "programId" TEXT,
  "score" INTEGER,
  "originalScore" INTEGER,
  "passed" BOOLEAN NOT NULL DEFAULT FALSE,
  "gradeMode" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "immutable" BOOLEAN NOT NULL DEFAULT FALSE,
  "finalisedAt" TIMESTAMP(3),
  "regradedAt" TIMESTAMP(3),
  "gradedByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingAssessmentResult_attemptId_key"
  ON "CustomerTrainingAssessmentResult"("attemptId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessmentResult_participant_idx"
  ON "CustomerTrainingAssessmentResult"("programId", "participantId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingAssessmentRegrade" (
  "id" TEXT PRIMARY KEY,
  "resultId" TEXT NOT NULL,
  "attemptId" TEXT,
  "originalScore" INTEGER,
  "newScore" INTEGER,
  "reason" TEXT,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingAssessmentRegrade_idempotencyKey_key"
  ON "CustomerTrainingAssessmentRegrade"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingAssessmentRegrade_result_idx"
  ON "CustomerTrainingAssessmentRegrade"("resultId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingCompletionPolicy" (
  "id" TEXT PRIMARY KEY,
  "policyVersion" TEXT NOT NULL,
  "requiresAttendance" BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresExercises" BOOLEAN NOT NULL DEFAULT TRUE,
  "requiresAssessments" BOOLEAN NOT NULL DEFAULT TRUE,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCompletionPolicy_policyVersion_key"
  ON "CustomerTrainingCompletionPolicy"("policyVersion");

CREATE TABLE IF NOT EXISTS "CustomerTrainingParticipantCompletion" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "gapsJson" JSONB,
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingParticipantCompletion_idempotencyKey_key"
  ON "CustomerTrainingParticipantCompletion"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingParticipantCompletion_program_participant_idx"
  ON "CustomerTrainingParticipantCompletion"("programId", "participantId");

CREATE TABLE IF NOT EXISTS "CustomerTrainingProgramCompletion" (
  "id" TEXT PRIMARY KEY,
  "programId" TEXT NOT NULL,
  "policyVersion" TEXT,
  "status" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingProgramCompletion_idempotencyKey_key"
  ON "CustomerTrainingProgramCompletion"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingProgramCompletion_program_status_idx"
  ON "CustomerTrainingProgramCompletion"("programId", "status");

CREATE TABLE IF NOT EXISTS "CustomerTrainingCertificate" (
  "id" TEXT PRIMARY KEY,
  "certificateNumber" TEXT NOT NULL,
  "participantCompletionId" TEXT NOT NULL,
  "programId" TEXT,
  "participantId" TEXT,
  "templateVersionId" TEXT,
  "certificateType" TEXT NOT NULL DEFAULT 'COMPLETION',
  "checksum" TEXT NOT NULL,
  "verificationCode" TEXT NOT NULL,
  "verificationStatus" TEXT NOT NULL DEFAULT 'VALID',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "revokeReason" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revokedByAdminId" TEXT,
  "issuedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCertificate_certificateNumber_key"
  ON "CustomerTrainingCertificate"("certificateNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCertificate_verificationCode_key"
  ON "CustomerTrainingCertificate"("verificationCode");
CREATE UNIQUE INDEX IF NOT EXISTS "CustomerTrainingCertificate_idempotencyKey_key"
  ON "CustomerTrainingCertificate"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CustomerTrainingCertificate_completion_idx"
  ON "CustomerTrainingCertificate"("participantCompletionId");
CREATE INDEX IF NOT EXISTS "CustomerTrainingCertificate_program_idx"
  ON "CustomerTrainingCertificate"("programId");
