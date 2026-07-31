-- Phase 15 Wave 2 — Price Books, tax, discounts, pricing snapshots, approvals (PostgreSQL).
-- Prefer: npx prisma db push (or migrate) + npx prisma generate.
-- Use this when prisma generate / db push hits Windows EPERM on the query engine.
-- Safe to re-run with IF NOT EXISTS where supported.
--
-- ACTIVE Price Book versions immutable. No silent FX. No Tenant tax / MRA EIS fiscal.

CREATE TABLE IF NOT EXISTS "CrmPriceBook" (
  "id" TEXT PRIMARY KEY,
  "bookNumber" TEXT NOT NULL,
  "name" TEXT,
  "bookType" TEXT NOT NULL DEFAULT 'STANDARD',
  "currency" TEXT,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "currentVersionId" TEXT,
  "latestVersionNumber" INTEGER NOT NULL DEFAULT 1,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmPriceBook_bookNumber_key" ON "CrmPriceBook"("bookNumber");
CREATE INDEX IF NOT EXISTS "CrmPriceBook_status_createdAt_idx" ON "CrmPriceBook"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmPriceBook_bookType_idx" ON "CrmPriceBook"("bookType");
CREATE INDEX IF NOT EXISTS "CrmPriceBook_createdByAdminId_idx" ON "CrmPriceBook"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmPriceBookVersion" (
  "id" TEXT PRIMARY KEY,
  "priceBookId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "immutable" BOOLEAN NOT NULL DEFAULT false,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "activatedByAdminId" TEXT,
  "activatedAt" TIMESTAMP(3),
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmPriceBookVersion_priceBookId_versionNumber_key"
  ON "CrmPriceBookVersion"("priceBookId", "versionNumber");
CREATE INDEX IF NOT EXISTS "CrmPriceBookVersion_priceBook_status_idx"
  ON "CrmPriceBookVersion"("priceBookId", "status");
CREATE INDEX IF NOT EXISTS "CrmPriceBookVersion_status_idx" ON "CrmPriceBookVersion"("status");
CREATE INDEX IF NOT EXISTS "CrmPriceBookVersion_createdBy_idx" ON "CrmPriceBookVersion"("createdByAdminId");

CREATE TABLE IF NOT EXISTS "CrmPriceBookEntry" (
  "id" TEXT PRIMARY KEY,
  "priceBookVersionId" TEXT NOT NULL,
  "productRef" TEXT NOT NULL,
  "unit" TEXT,
  "listPrice" DECIMAL(18,4) NOT NULL,
  "minPrice" DECIMAL(18,4) NOT NULL,
  "currency" TEXT,
  "billingFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  "taxCategory" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmPriceBookEntry_version_idx" ON "CrmPriceBookEntry"("priceBookVersionId");
CREATE INDEX IF NOT EXISTS "CrmPriceBookEntry_productRef_idx" ON "CrmPriceBookEntry"("productRef");

CREATE TABLE IF NOT EXISTS "CrmTaxRule" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "jurisdiction" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "inclusiveDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTaxRule_code_key" ON "CrmTaxRule"("code");
CREATE INDEX IF NOT EXISTS "CrmTaxRule_jurisdiction_status_idx" ON "CrmTaxRule"("jurisdiction", "status");

CREATE TABLE IF NOT EXISTS "CrmTaxRateVersion" (
  "id" TEXT PRIMARY KEY,
  "taxRuleId" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "ratePercent" DECIMAL(8,4) NOT NULL,
  "effectiveFrom" TIMESTAMP(3),
  "effectiveTo" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTaxRateVersion_taxRuleId_version_key"
  ON "CrmTaxRateVersion"("taxRuleId", "version");
CREATE INDEX IF NOT EXISTS "CrmTaxRateVersion_taxRule_status_idx"
  ON "CrmTaxRateVersion"("taxRuleId", "status");

CREATE TABLE IF NOT EXISTS "CrmDiscountPolicy" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "maxPercent" DECIMAL(8,4) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmDiscountPolicy_code_version_key"
  ON "CrmDiscountPolicy"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmDiscountPolicy_code_status_idx"
  ON "CrmDiscountPolicy"("code", "status");

CREATE TABLE IF NOT EXISTS "CrmDiscountRequest" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "percent" DECIMAL(8,4) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "maxPolicyPercent" DECIMAL(8,4),
  "reason" TEXT,
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmDiscountRequest_doc_status_idx"
  ON "CrmDiscountRequest"("documentVersionId", "status");
CREATE INDEX IF NOT EXISTS "CrmDiscountRequest_requestedBy_idx"
  ON "CrmDiscountRequest"("requestedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmPricingException" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "exceptionType" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceJson" JSONB,
  "payloadJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedByAdminId" TEXT,
  "approvedByAdminId" TEXT,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmPricingException_doc_status_idx"
  ON "CrmPricingException"("documentVersionId", "status");

CREATE TABLE IF NOT EXISTS "CrmPricingSnapshot" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "priceBookVersionId" TEXT,
  "currency" TEXT NOT NULL,
  "calculationDate" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "snapshotJson" JSONB NOT NULL,
  "totalsJson" JSONB NOT NULL,
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmPricingSnapshot_doc_idem_key"
  ON "CrmPricingSnapshot"("documentVersionId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmPricingSnapshot_documentVersionId_idx"
  ON "CrmPricingSnapshot"("documentVersionId");
CREATE INDEX IF NOT EXISTS "CrmPricingSnapshot_priceBookVersionId_idx"
  ON "CrmPricingSnapshot"("priceBookVersionId");

CREATE TABLE IF NOT EXISTS "CrmApprovalPolicy" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "stepsJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmApprovalPolicy_code_version_key"
  ON "CrmApprovalPolicy"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmApprovalPolicy_code_status_idx"
  ON "CrmApprovalPolicy"("code", "status");

CREATE TABLE IF NOT EXISTS "CrmApprovalRequest" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL,
  "approvalPolicyId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "requestedByAdminId" TEXT,
  "idempotencyKey" TEXT,
  "materialFingerprint" TEXT,
  "invalidatedReason" TEXT,
  "invalidatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmApprovalRequest_idempotencyKey_key"
  ON "CrmApprovalRequest"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "CrmApprovalRequest_doc_status_idx"
  ON "CrmApprovalRequest"("documentVersionId", "status");
CREATE INDEX IF NOT EXISTS "CrmApprovalRequest_policy_idx"
  ON "CrmApprovalRequest"("approvalPolicyId");
CREATE INDEX IF NOT EXISTS "CrmApprovalRequest_requestedBy_idx"
  ON "CrmApprovalRequest"("requestedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmApprovalStep" (
  "id" TEXT PRIMARY KEY,
  "approvalRequestId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "role" TEXT,
  "protected" BOOLEAN NOT NULL DEFAULT true,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmApprovalStep_request_order_idx"
  ON "CrmApprovalStep"("approvalRequestId", "stepOrder");
CREATE INDEX IF NOT EXISTS "CrmApprovalStep_status_idx" ON "CrmApprovalStep"("status");

CREATE TABLE IF NOT EXISTS "CrmApprovalDecision" (
  "id" TEXT PRIMARY KEY,
  "approvalRequestId" TEXT NOT NULL,
  "approvalStepId" TEXT,
  "decision" TEXT NOT NULL,
  "reason" TEXT,
  "decidedByAdminId" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "CrmApprovalDecision_request_at_idx"
  ON "CrmApprovalDecision"("approvalRequestId", "at");
CREATE INDEX IF NOT EXISTS "CrmApprovalDecision_decidedBy_idx"
  ON "CrmApprovalDecision"("decidedByAdminId");

CREATE TABLE IF NOT EXISTS "CrmTerm" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT,
  "bodyJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmTerm_code_version_key" ON "CrmTerm"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmTerm_code_status_idx" ON "CrmTerm"("code", "status");

CREATE TABLE IF NOT EXISTS "CrmClause" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" TEXT,
  "bodyJson" JSONB,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "createdByAdminId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "CrmClause_code_version_key" ON "CrmClause"("code", "version");
CREATE INDEX IF NOT EXISTS "CrmClause_code_status_idx" ON "CrmClause"("code", "status");
