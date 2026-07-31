-- Phase 11 — Equity Management V2 (additive)
-- Applied via prisma db push in dev; this file records the schema for migrate deploy.

CREATE TABLE IF NOT EXISTS "EqV2Configuration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "legalStructure" TEXT NOT NULL DEFAULT 'SOLE_PROPRIETORSHIP',
    "equityModel" TEXT NOT NULL DEFAULT 'OWNER_CAPITAL',
    "ownershipTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shareCapitalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "partnershipCapitalEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerCapitalEnabled" BOOLEAN NOT NULL DEFAULT true,
    "shareClassesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "votingRightsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dividendManagementEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ownerDrawingsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "retainedEarningsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reservesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ownershipPercentageScale" INTEGER NOT NULL DEFAULT 4,
    "shareQuantityScale" INTEGER NOT NULL DEFAULT 0,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'MWK',
    "requireContributionApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireDrawingApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireDividendApproval" BOOLEAN NOT NULL DEFAULT true,
    "requireSeparateApprover" BOOLEAN NOT NULL DEFAULT true,
    "architectureVersion" TEXT NOT NULL DEFAULT 'EQUITY_V2',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" DATE NOT NULL,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "EqV2Configuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2Configuration_tenantId_key" ON "EqV2Configuration"("tenantId");
CREATE INDEX IF NOT EXISTS "EqV2Configuration_status_idx" ON "EqV2Configuration"("status");

CREATE TABLE IF NOT EXISTS "EqV2PartyRelationship" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "partyName" TEXT NOT NULL,
    "partyType" TEXT NOT NULL DEFAULT 'PERSON',
    "relationshipType" TEXT NOT NULL,
    "ownershipStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "ownerNumber" TEXT,
    "shareholderNumber" TEXT,
    "partnerNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "taxIdentifierRef" TEXT,
    "address" TEXT,
    "beneficialOwnershipStatus" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "legacyEquityAccountId" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "EqV2PartyRelationship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2PartyRelationship_tenantId_relationshipType_partyName_effectiveFrom_key" ON "EqV2PartyRelationship"("tenantId", "relationshipType", "partyName", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "EqV2PartyRelationship_tenantId_ownershipStatus_idx" ON "EqV2PartyRelationship"("tenantId", "ownershipStatus");
CREATE INDEX IF NOT EXISTS "EqV2PartyRelationship_tenantId_relationshipType_idx" ON "EqV2PartyRelationship"("tenantId", "relationshipType");

CREATE TABLE IF NOT EXISTS "EqV2ShareClass" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "classCode" TEXT NOT NULL,
    "className" TEXT NOT NULL,
    "description" TEXT,
    "nominalValue" DECIMAL(18,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "authorizedQuantity" DECIMAL(18,6),
    "issuedQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "paidQuantity" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "votingRightsPerShare" DECIMAL(18,6) NOT NULL DEFAULT 1,
    "dividendRights" TEXT,
    "liquidationRights" TEXT,
    "isRedeemable" BOOLEAN NOT NULL DEFAULT false,
    "isConvertible" BOOLEAN NOT NULL DEFAULT false,
    "equityAccountId" TEXT,
    "sharePremiumAccountId" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "EqV2ShareClass_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2ShareClass_tenantId_classCode_key" ON "EqV2ShareClass"("tenantId", "classCode");
CREATE INDEX IF NOT EXISTS "EqV2ShareClass_tenantId_status_idx" ON "EqV2ShareClass"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "EqV2OwnershipHolding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "shareClassId" TEXT,
    "quantityHeld" DECIMAL(18,6) NOT NULL DEFAULT 0,
    "nominalValueHeld" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidValue" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ownershipPercentage" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "votingPercentage" DECIMAL(18,8) NOT NULL DEFAULT 0,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "sourceTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "EqV2OwnershipHolding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2OwnershipHolding_tenantId_relationshipId_status_idx" ON "EqV2OwnershipHolding"("tenantId", "relationshipId", "status");
CREATE INDEX IF NOT EXISTS "EqV2OwnershipHolding_tenantId_effectiveFrom_effectiveTo_idx" ON "EqV2OwnershipHolding"("tenantId", "effectiveFrom", "effectiveTo");
CREATE INDEX IF NOT EXISTS "EqV2OwnershipHolding_shareClassId_idx" ON "EqV2OwnershipHolding"("shareClassId");

CREATE TABLE IF NOT EXISTS "EqV2OwnershipMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "movementType" TEXT NOT NULL,
    "fromRelationshipId" TEXT,
    "toRelationshipId" TEXT,
    "shareClassId" TEXT,
    "quantity" DECIMAL(18,6) NOT NULL,
    "ownershipPercentage" DECIMAL(18,8),
    "effectiveDate" DATE NOT NULL,
    "considerationRef" TEXT,
    "createsCompanyJournal" BOOLEAN NOT NULL DEFAULT false,
    "equityTransactionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "EqV2OwnershipMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2OwnershipMovement_tenantId_effectiveDate_idx" ON "EqV2OwnershipMovement"("tenantId", "effectiveDate");
CREATE INDEX IF NOT EXISTS "EqV2OwnershipMovement_equityTransactionId_idx" ON "EqV2OwnershipMovement"("equityTransactionId");

CREATE TABLE IF NOT EXISTS "EqV2EquityTransaction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "relationshipId" TEXT,
    "shareClassId" TEXT,
    "transactionDate" DATE NOT NULL,
    "requestedPostingDate" DATE,
    "amount" DECIMAL(18,2) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "shareQuantity" DECIMAL(18,6),
    "nominalValue" DECIMAL(18,6),
    "issuePrice" DECIMAL(18,6),
    "premiumAmount" DECIMAL(18,2),
    "description" TEXT,
    "reason" TEXT,
    "sourceReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalStatus" TEXT NOT NULL DEFAULT 'NONE',
    "accountingStatus" TEXT NOT NULL DEFAULT 'NOT_POSTED',
    "accountingEventId" TEXT,
    "journalEntryId" TEXT,
    "reversalTransactionId" TEXT,
    "originalTransactionId" TEXT,
    "effectiveOwnershipDate" DATE,
    "altersOwnership" BOOLEAN NOT NULL DEFAULT false,
    "bankAccountId" TEXT,
    "assetAccountId" TEXT,
    "offsetAccountId" TEXT,
    "equityAccountId" TEXT,
    "assetId" TEXT,
    "liabilityId" TEXT,
    "dividendDeclarationId" TEXT,
    "createdBy" TEXT,
    "submittedBy" TEXT,
    "approvedBy" TEXT,
    "postedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "EqV2EquityTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2EquityTransaction_tenantId_transactionNumber_key" ON "EqV2EquityTransaction"("tenantId", "transactionNumber");
CREATE INDEX IF NOT EXISTS "EqV2EquityTransaction_tenantId_transactionType_status_idx" ON "EqV2EquityTransaction"("tenantId", "transactionType", "status");
CREATE INDEX IF NOT EXISTS "EqV2EquityTransaction_tenantId_accountingStatus_idx" ON "EqV2EquityTransaction"("tenantId", "accountingStatus");
CREATE INDEX IF NOT EXISTS "EqV2EquityTransaction_journalEntryId_idx" ON "EqV2EquityTransaction"("journalEntryId");
CREATE INDEX IF NOT EXISTS "EqV2EquityTransaction_accountingEventId_idx" ON "EqV2EquityTransaction"("accountingEventId");
CREATE INDEX IF NOT EXISTS "EqV2EquityTransaction_relationshipId_idx" ON "EqV2EquityTransaction"("relationshipId");

CREATE TABLE IF NOT EXISTS "EqV2DividendDeclaration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "declarationNumber" TEXT NOT NULL,
    "declarationDate" DATE NOT NULL,
    "recordDate" DATE,
    "paymentDate" DATE,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "totalAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "allocationMethod" TEXT NOT NULL DEFAULT 'OWNERSHIP_PERCENTAGE',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "equityTransactionId" TEXT,
    "journalEntryId" TEXT,
    "retainedEarningsAccountId" TEXT,
    "dividendsPayableAccountId" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "EqV2DividendDeclaration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2DividendDeclaration_tenantId_declarationNumber_key" ON "EqV2DividendDeclaration"("tenantId", "declarationNumber");
CREATE INDEX IF NOT EXISTS "EqV2DividendDeclaration_tenantId_status_idx" ON "EqV2DividendDeclaration"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "EqV2DividendAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "relationshipId" TEXT NOT NULL,
    "eligibleQuantity" DECIMAL(18,6),
    "ownershipPercentage" DECIMAL(18,8),
    "grossAmount" DECIMAL(18,2) NOT NULL,
    "grossAmountMinor" INTEGER NOT NULL,
    "withholdingMinor" INTEGER NOT NULL DEFAULT 0,
    "netAmountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "paidAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EqV2DividendAllocation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2DividendAllocation_declarationId_idx" ON "EqV2DividendAllocation"("declarationId");
CREATE INDEX IF NOT EXISTS "EqV2DividendAllocation_relationshipId_idx" ON "EqV2DividendAllocation"("relationshipId");

CREATE TABLE IF NOT EXISTS "EqV2DividendPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "declarationId" TEXT NOT NULL,
    "allocationId" TEXT,
    "relationshipId" TEXT NOT NULL,
    "paymentDate" DATE NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "withholdingMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "bankAccountId" TEXT,
    "paymentReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "equityTransactionId" TEXT,
    "journalEntryId" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "EqV2DividendPayment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2DividendPayment_declarationId_status_idx" ON "EqV2DividendPayment"("declarationId", "status");
CREATE INDEX IF NOT EXISTS "EqV2DividendPayment_paymentReference_idx" ON "EqV2DividendPayment"("paymentReference");

CREATE TABLE IF NOT EXISTS "EqV2EquityApproval" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "equityTransactionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EqV2EquityApproval_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2EquityApproval_equityTransactionId_action_idx" ON "EqV2EquityApproval"("equityTransactionId", "action");

CREATE TABLE IF NOT EXISTS "EqV2EquityDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "equityTransactionId" TEXT,
    "relationshipId" TEXT,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT,
    "certificateNumber" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,
    CONSTRAINT "EqV2EquityDocument_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2EquityDocument_tenantId_documentType_idx" ON "EqV2EquityDocument"("tenantId", "documentType");
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2EquityDocument_tenantId_certificateNumber_key" ON "EqV2EquityDocument"("tenantId", "certificateNumber");

CREATE TABLE IF NOT EXISTS "EqV2EquityReconciliationRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "overallOk" BOOLEAN NOT NULL DEFAULT false,
    "summary" JSONB,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EqV2EquityReconciliationRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2EquityReconciliationRun_tenantId_asOfDate_idx" ON "EqV2EquityReconciliationRun"("tenantId", "asOfDate");

CREATE TABLE IF NOT EXISTS "EqV2EquityReconciliationFinding" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "message" TEXT NOT NULL,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EqV2EquityReconciliationFinding_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EqV2EquityReconciliationFinding_runId_ruleCode_idx" ON "EqV2EquityReconciliationFinding"("runId", "ruleCode");

CREATE TABLE IF NOT EXISTS "EqV2EquitySnapshot" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "snapshotType" TEXT NOT NULL,
    "asOfDate" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "checksum" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EqV2EquitySnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EqV2EquitySnapshot_tenantId_snapshotType_asOfDate_version_key" ON "EqV2EquitySnapshot"("tenantId", "snapshotType", "asOfDate", "version");
CREATE INDEX IF NOT EXISTS "EqV2EquitySnapshot_tenantId_createdAt_idx" ON "EqV2EquitySnapshot"("tenantId", "createdAt");

-- FKs (IF NOT EXISTS pattern via DO blocks omitted; safe on fresh deploy)
DO $$ BEGIN
  ALTER TABLE "EqV2OwnershipHolding" ADD CONSTRAINT "EqV2OwnershipHolding_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "EqV2PartyRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2OwnershipHolding" ADD CONSTRAINT "EqV2OwnershipHolding_shareClassId_fkey" FOREIGN KEY ("shareClassId") REFERENCES "EqV2ShareClass"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2OwnershipMovement" ADD CONSTRAINT "EqV2OwnershipMovement_toRelationshipId_fkey" FOREIGN KEY ("toRelationshipId") REFERENCES "EqV2PartyRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2EquityTransaction" ADD CONSTRAINT "EqV2EquityTransaction_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "EqV2PartyRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2DividendAllocation" ADD CONSTRAINT "EqV2DividendAllocation_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "EqV2DividendDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2DividendAllocation" ADD CONSTRAINT "EqV2DividendAllocation_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "EqV2PartyRelationship"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2DividendPayment" ADD CONSTRAINT "EqV2DividendPayment_declarationId_fkey" FOREIGN KEY ("declarationId") REFERENCES "EqV2DividendDeclaration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2EquityApproval" ADD CONSTRAINT "EqV2EquityApproval_equityTransactionId_fkey" FOREIGN KEY ("equityTransactionId") REFERENCES "EqV2EquityTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2EquityDocument" ADD CONSTRAINT "EqV2EquityDocument_equityTransactionId_fkey" FOREIGN KEY ("equityTransactionId") REFERENCES "EqV2EquityTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EqV2EquityReconciliationFinding" ADD CONSTRAINT "EqV2EquityReconciliationFinding_runId_fkey" FOREIGN KEY ("runId") REFERENCES "EqV2EquityReconciliationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
