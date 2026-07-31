-- AlterTable
ALTER TABLE "AcctV2EventRegistry" ADD COLUMN     "approvalReference" TEXT,
ADD COLUMN     "approvedBy" TEXT,
ADD COLUMN     "failureRetryable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "accountingEventId" TEXT,
ADD COLUMN     "accountingPeriodId" TEXT,
ADD COLUMN     "adjustmentCategory" TEXT,
ADD COLUMN     "adjustmentReason" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "architectureVersion" TEXT NOT NULL DEFAULT 'LEGACY_V1',
ADD COLUMN     "baseCurrency" TEXT,
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "exchangeRate" DECIMAL(18,8),
ADD COLUMN     "financialYearLabel" TEXT,
ADD COLUMN     "journalNumber" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "postingDate" TIMESTAMP(3),
ADD COLUMN     "postingMode" TEXT,
ADD COLUMN     "relatedJournalId" TEXT,
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateVersion" INTEGER,
ADD COLUMN     "totalCredit" DECIMAL(18,2),
ADD COLUMN     "totalDebit" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN     "baseCredit" DECIMAL(18,2),
ADD COLUMN     "baseDebit" DECIMAL(18,2),
ADD COLUMN     "currency" TEXT,
ADD COLUMN     "dimensions" JSONB,
ADD COLUMN     "taxCode" TEXT;

-- CreateTable
CREATE TABLE "AcctV2JournalSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "scopeKey" TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2JournalSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcctV2OpeningBalanceBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "evidenceReference" TEXT,
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "journalEntryId" TEXT,
    "accountingEventId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2OpeningBalanceBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2JournalSequence_tenantId_scopeKey_key" ON "AcctV2JournalSequence"("tenantId", "scopeKey");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2OpeningBalanceBatch_journalEntryId_key" ON "AcctV2OpeningBalanceBatch"("journalEntryId");

-- CreateIndex
CREATE INDEX "AcctV2OpeningBalanceBatch_tenantId_status_idx" ON "AcctV2OpeningBalanceBatch"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AcctV2OpeningBalanceBatch_tenantId_effectiveDate_version_key" ON "AcctV2OpeningBalanceBatch"("tenantId", "effectiveDate", "version");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_accountingEventId_key" ON "JournalEntry"("accountingEventId");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_architectureVersion_status_idx" ON "JournalEntry"("tenantId", "architectureVersion", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_postingDate_idx" ON "JournalEntry"("tenantId", "postingDate");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_sourceType_sourceId_idx" ON "JournalEntry"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_journalNumber_key" ON "JournalEntry"("tenantId", "journalNumber");


-- ── Phase 4 database constraints (added as NOT VALID: enforced for new writes,
-- existing legacy rows are never validated or modified) ──

-- Journal lines: non-negative amounts, and never both debit and credit positive.
ALTER TABLE "JournalEntryLine"
  ADD CONSTRAINT "jel_non_negative_amounts"
  CHECK ("debitAmount" >= 0 AND "creditAmount" >= 0) NOT VALID;

ALTER TABLE "JournalEntryLine"
  ADD CONSTRAINT "jel_not_both_sides"
  CHECK (NOT ("debitAmount" > 0 AND "creditAmount" > 0)) NOT VALID;

-- V2-posted journals must carry number, posting date, tenant and event identity,
-- and exact totals must balance.
ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "je_v2_posted_requirements"
  CHECK (
    "architectureVersion" <> 'ACCOUNTING_V2'
    OR "status" <> 'Posted'
    OR (
      "postingDate" IS NOT NULL
      AND "journalNumber" IS NOT NULL
      AND "tenantId" IS NOT NULL
      AND "accountingEventId" IS NOT NULL
    )
  ) NOT VALID;

ALTER TABLE "JournalEntry"
  ADD CONSTRAINT "je_v2_balanced_totals"
  CHECK (
    "architectureVersion" <> 'ACCOUNTING_V2'
    OR "totalDebit" IS NULL
    OR "totalDebit" = "totalCredit"
  ) NOT VALID;

ALTER TABLE "AcctV2JournalSequence"
  ADD CONSTRAINT "seq_non_negative"
  CHECK ("lastValue" >= 0);
