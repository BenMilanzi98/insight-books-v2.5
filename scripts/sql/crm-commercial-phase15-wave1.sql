-- Phase 15 Wave 1 — Proposal Request + CrmCommercialDocument spine (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- Proposal ≠ Quotation; APPROVED ≠ ISSUED; Tenant Quotation = WRONG_DOMAIN.
-- Never auto-mutate Opportunity stage/probability/close date.

CREATE TABLE IF NOT EXISTS "CrmProposalRequest" (
  "id" TEXT PRIMARY KEY,
  "requestNumber" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "sourceRef" TEXT,
  "opportunityId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "demoId" TEXT,
  "leadId" TEXT,
  "requestedDocumentType" TEXT NOT NULL DEFAULT 'PROPOSAL',
  "currency" TEXT,
  "title" TEXT,
  "notes" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "convertedProposalDocumentId" TEXT,
  "convertedQuotationDocumentId" TEXT,
  "convertIdempotencyKey" TEXT,
  "rejectedReason" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposalRequest_requestNumber_key" ON "CrmProposalRequest"("requestNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposalRequest_convertIdempotencyKey_key" ON "CrmProposalRequest"("convertIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposalRequest_idempotencyKey_key" ON "CrmProposalRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_status_createdAt_idx" ON "CrmProposalRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_opportunityId_idx" ON "CrmProposalRequest"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_demoId_idx" ON "CrmProposalRequest"("demoId");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_accountId_idx" ON "CrmProposalRequest"("accountId");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_contactId_idx" ON "CrmProposalRequest"("contactId");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_owner_status_idx" ON "CrmProposalRequest"("ownerAdminId", "status");
CREATE INDEX IF NOT EXISTS "CrmProposalRequest_source_idx" ON "CrmProposalRequest"("source");

CREATE TABLE IF NOT EXISTS "CrmProposalRequestStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmProposalRequestStatusHistory_request_at_idx"
  ON "CrmProposalRequestStatusHistory"("requestId", "at");
CREATE INDEX IF NOT EXISTS "CrmProposalRequestStatusHistory_changedBy_idx"
  ON "CrmProposalRequestStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCommercialDocument" (
  "id" TEXT PRIMARY KEY,
  "documentNumber" TEXT NOT NULL,
  "documentFamily" TEXT NOT NULL,
  "requestId" TEXT,
  "opportunityId" TEXT,
  "accountId" TEXT,
  "contactId" TEXT,
  "demoId" TEXT,
  "leadId" TEXT,
  "title" TEXT,
  "currency" TEXT,
  "ownerAdminId" TEXT,
  "createdByAdminId" TEXT,
  "currentVersionId" TEXT,
  "latestVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "convertIdempotencyKey" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialDocument_documentNumber_key" ON "CrmCommercialDocument"("documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialDocument_convertIdempotencyKey_key" ON "CrmCommercialDocument"("convertIdempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialDocument_idempotencyKey_key" ON "CrmCommercialDocument"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_family_createdAt_idx" ON "CrmCommercialDocument"("documentFamily", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_requestId_idx" ON "CrmCommercialDocument"("requestId");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_opportunityId_idx" ON "CrmCommercialDocument"("opportunityId");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_demoId_idx" ON "CrmCommercialDocument"("demoId");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_ownerAdminId_idx" ON "CrmCommercialDocument"("ownerAdminId");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_accountId_idx" ON "CrmCommercialDocument"("accountId");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocument_contactId_idx" ON "CrmCommercialDocument"("contactId");

CREATE TABLE IF NOT EXISTS "CrmCommercialDocumentVersion" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "versionLabel" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "contentJson" JSONB,
  "revisionReason" TEXT,
  "immutable" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmCommercialDocumentVersion_document_version_key"
  ON "CrmCommercialDocumentVersion"("documentId", "versionNumber");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocumentVersion_document_status_idx"
  ON "CrmCommercialDocumentVersion"("documentId", "status");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocumentVersion_status_idx"
  ON "CrmCommercialDocumentVersion"("status");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocumentVersion_createdBy_idx"
  ON "CrmCommercialDocumentVersion"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmCommercialDocumentVersionStatusHistory" (
  "id" TEXT PRIMARY KEY,
  "versionId" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT NOT NULL,
  "reason" TEXT,
  "changedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmCommercialDocumentVersionStatusHistory_version_at_idx"
  ON "CrmCommercialDocumentVersionStatusHistory"("versionId", "at");
CREATE INDEX IF NOT EXISTS "CrmCommercialDocumentVersionStatusHistory_changedBy_idx"
  ON "CrmCommercialDocumentVersionStatusHistory"("changedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmProposal" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "title" TEXT,
  "narrativeJson" JSONB,
  "scopesJson" JSONB,
  "assumptionsJson" JSONB,
  "exclusionsJson" JSONB,
  "responsibilitiesJson" JSONB,
  "milestonesJson" JSONB,
  "pinnedQuotationVersionIds" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProposal_documentId_key" ON "CrmProposal"("documentId");
CREATE INDEX IF NOT EXISTS "CrmProposal_documentId_idx" ON "CrmProposal"("documentId");

CREATE TABLE IF NOT EXISTS "CrmQuotation" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL,
  "currency" TEXT,
  "lineItemsJson" JSONB,
  "pricingSnapshotJson" JSONB,
  "totalsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmQuotation_documentId_key" ON "CrmQuotation"("documentId");
CREATE INDEX IF NOT EXISTS "CrmQuotation_documentId_idx" ON "CrmQuotation"("documentId");
