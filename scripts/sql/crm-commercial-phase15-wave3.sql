-- Phase 15 Wave 3 — Templates, PDF artifacts, issue/delivery, review, acceptance (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Artifacts append-only. Delivery ≠ view ≠ acceptance. E-sign NOT_CONFIGURED.

CREATE TABLE IF NOT EXISTS "CrmCommercialTemplate" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT,
  "projectionDefaultsJson" JSONB,
  "bodyHtml" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialTemplate_code_version_key"
  ON "CrmCommercialTemplate"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmCommercialTemplate_code_status_idx"
  ON "CrmCommercialTemplate"("code", "status");

CREATE TABLE IF NOT EXISTS "CrmCommercialBranding" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "legalName" TEXT,
  "primaryColor" TEXT,
  "logoStorageKey" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialBranding_code_key" ON "CrmCommercialBranding"("code");
CREATE INDEX IF NOT EXISTS "CrmCommercialBranding_status_idx" ON "CrmCommercialBranding"("status");

CREATE TABLE IF NOT EXISTS "CrmCommercialRenderJob" (
  "id" TEXT PRIMARY KEY,
  "versionId" TEXT NOT NULL,
  "documentVersionId" TEXT,
  "projection" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "idempotencyKey" TEXT,
  "htmlFingerprint" TEXT,
  "createdByAdminId" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialRenderJob_version_projection_idx"
  ON "CrmCommercialRenderJob"("versionId", "projection");
CREATE INDEX IF NOT EXISTS "CrmCommercialRenderJob_idempotencyKey_idx"
  ON "CrmCommercialRenderJob"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "CrmCommercialArtifact" (
  "id" TEXT PRIMARY KEY,
  "versionId" TEXT NOT NULL,
  "documentVersionId" TEXT,
  "projection" TEXT NOT NULL,
  "contentType" TEXT NOT NULL DEFAULT 'application/pdf',
  "storageKey" TEXT NOT NULL,
  "byteLength" INTEGER,
  "renderJobId" TEXT,
  "idempotencyKey" TEXT,
  "htmlSource" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialArtifact_version_projection_idem_key"
  ON "CrmCommercialArtifact"("versionId", "projection", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialArtifact_version_projection_idx"
  ON "CrmCommercialArtifact"("versionId", "projection");
CREATE INDEX IF NOT EXISTS "CrmCommercialArtifact_documentVersionId_idx"
  ON "CrmCommercialArtifact"("documentVersionId");

CREATE TABLE IF NOT EXISTS "CrmCommercialChecksum" (
  "id" TEXT PRIMARY KEY,
  "artifactId" TEXT NOT NULL,
  "algorithm" TEXT NOT NULL DEFAULT 'SHA256',
  "sha256" TEXT NOT NULL,
  "value" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialChecksum_artifactId_algorithm_key"
  ON "CrmCommercialChecksum"("artifactId", "algorithm");
CREATE INDEX IF NOT EXISTS "CrmCommercialChecksum_sha256_idx" ON "CrmCommercialChecksum"("sha256");

CREATE TABLE IF NOT EXISTS "CrmCommercialRecipient" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT,
  "email" TEXT,
  "name" TEXT,
  "authorityRole" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialRecipient_document_status_idx"
  ON "CrmCommercialRecipient"("documentId", "status");
CREATE INDEX IF NOT EXISTS "CrmCommercialRecipient_email_idx" ON "CrmCommercialRecipient"("email");

CREATE TABLE IF NOT EXISTS "CrmCommercialDelivery" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "documentId" TEXT,
  "recipientId" TEXT,
  "method" TEXT NOT NULL,
  "deliveryMethod" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DELIVERED',
  "artifactId" TEXT,
  "reviewAccessId" TEXT,
  "evidenceJson" JSONB,
  "validUntil" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialDelivery_idempotencyKey_key"
  ON "CrmCommercialDelivery"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialDelivery_doc_status_idx"
  ON "CrmCommercialDelivery"("documentVersionId", "status");
CREATE INDEX IF NOT EXISTS "CrmCommercialDelivery_validUntil_idx"
  ON "CrmCommercialDelivery"("validUntil");

CREATE TABLE IF NOT EXISTS "CrmCommercialReviewAccess" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "documentId" TEXT,
  "recipientId" TEXT,
  "artifactId" TEXT,
  "checksumSha256" TEXT,
  "tokenHash" TEXT NOT NULL,
  "tokenPlain" TEXT,
  "expiresAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialReviewAccess_tokenHash_key"
  ON "CrmCommercialReviewAccess"("tokenHash");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialReviewAccess_idempotencyKey_key"
  ON "CrmCommercialReviewAccess"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialReviewAccess_doc_revoked_idx"
  ON "CrmCommercialReviewAccess"("documentVersionId", "revokedAt");

CREATE TABLE IF NOT EXISTS "CrmCommercialReviewSession" (
  "id" TEXT PRIMARY KEY,
  "reviewAccessId" TEXT NOT NULL,
  "documentVersionId" TEXT NOT NULL,
  "recipientId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialReviewSession_access_idx"
  ON "CrmCommercialReviewSession"("reviewAccessId");
CREATE INDEX IF NOT EXISTS "CrmCommercialReviewSession_doc_idx"
  ON "CrmCommercialReviewSession"("documentVersionId");

CREATE TABLE IF NOT EXISTS "CrmCommercialCustomerView" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "reviewAccessId" TEXT,
  "recipientId" TEXT,
  "artifactId" TEXT,
  "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialCustomerView_doc_viewed_idx"
  ON "CrmCommercialCustomerView"("documentVersionId", "viewedAt");

CREATE TABLE IF NOT EXISTS "CrmCommercialCustomerComment" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "reviewAccessId" TEXT,
  "recipientId" TEXT,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialCustomerComment_doc_created_idx"
  ON "CrmCommercialCustomerComment"("documentVersionId", "createdAt");

CREATE TABLE IF NOT EXISTS "CrmCommercialRevisionRequest" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "reviewAccessId" TEXT,
  "recipientId" TEXT,
  "reason" TEXT NOT NULL,
  "detailsJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialRevisionRequest_idempotencyKey_key"
  ON "CrmCommercialRevisionRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialRevisionRequest_doc_status_idx"
  ON "CrmCommercialRevisionRequest"("documentVersionId", "status");

CREATE TABLE IF NOT EXISTS "CrmCommercialAcceptance" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "authorityRole" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialAcceptance_idempotencyKey_key"
  ON "CrmCommercialAcceptance"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialAcceptance_doc_idx"
  ON "CrmCommercialAcceptance"("documentVersionId");

CREATE TABLE IF NOT EXISTS "CrmCommercialRejection" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "checksumSha256" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "reason" TEXT,
  "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialRejection_idempotencyKey_key"
  ON "CrmCommercialRejection"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialRejection_doc_idx"
  ON "CrmCommercialRejection"("documentVersionId");

CREATE TABLE IF NOT EXISTS "CrmCommercialExpiry" (
  "id" TEXT PRIMARY KEY,
  "idempotencyKey" TEXT NOT NULL,
  "expiredCount" INTEGER NOT NULL DEFAULT 0,
  "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialExpiry_idempotencyKey_key"
  ON "CrmCommercialExpiry"("idempotencyKey");

CREATE TABLE IF NOT EXISTS "CrmCommercialSignatureRequest" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT,
  "recipientId" TEXT,
  "providerStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "status" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialSignatureRequest_doc_idx"
  ON "CrmCommercialSignatureRequest"("documentVersionId");
CREATE INDEX IF NOT EXISTS "CrmCommercialSignatureRequest_provider_idx"
  ON "CrmCommercialSignatureRequest"("providerStatus");
