-- Phase 8 — Financial Calendar and Accounting Period control framework.
-- Additive, business-scoped, indexed, backward-compatible. The legacy
-- "AccountingPeriod" table is untouched; reversible by dropping these tables.

CREATE TABLE "AcctV2FinancialCalendarConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Standard Financial Calendar',
    "fyStartMonth" INTEGER NOT NULL DEFAULT 1,
    "fyStartDay" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Blantyre',
    "periodFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "postingDatePolicy" TEXT NOT NULL DEFAULT 'POSTING_DATE_DETERMINES_PERIOD',
    "backdatingPolicy" TEXT NOT NULL DEFAULT 'PERMISSION_AND_REASON',
    "futureDatingPolicy" TEXT NOT NULL DEFAULT 'TOLERANCE',
    "futureToleranceDays" INTEGER NOT NULL DEFAULT 31,
    "lockDate" TIMESTAMP(3),
    "checklistTemplateId" TEXT NOT NULL DEFAULT 'STANDARD_MONTHLY_CLOSE',
    "checklistTemplateVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "snapshotOnClose" BOOLEAN NOT NULL DEFAULT true,
    "recloseDeadlineDays" INTEGER NOT NULL DEFAULT 14,
    "allowAdjustmentPeriod" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2FinancialCalendarConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2FinancialCalendarConfig_tenantId_key" ON "AcctV2FinancialCalendarConfig"("tenantId");

CREATE TABLE "AcctV2FinancialYear" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "numberOfPeriods" INTEGER NOT NULL DEFAULT 12,
    "periodFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "previousFinancialYearId" TEXT,
    "architectureVersion" TEXT NOT NULL DEFAULT 'ACCOUNTING_V2',
    "createdBy" TEXT,
    "approvedBy" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "closedAt" TIMESTAMP(3),
    "reopenedBy" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "reopenReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2FinancialYear_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2FinancialYear_tenantId_code_key" ON "AcctV2FinancialYear"("tenantId", "code");
CREATE INDEX "AcctV2FinancialYear_tenantId_status_idx" ON "AcctV2FinancialYear"("tenantId", "status");
CREATE INDEX "AcctV2FinancialYear_tenantId_startDate_endDate_idx" ON "AcctV2FinancialYear"("tenantId", "startDate", "endDate");

CREATE TABLE "AcctV2AccountingPeriod" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "sequence" INTEGER NOT NULL,
    "lockDate" TIMESTAMP(3),
    "closeDate" TIMESTAMP(3),
    "reopenDate" TIMESTAMP(3),
    "recloseDate" TIMESTAMP(3),
    "isAdjustmentPeriod" BOOLEAN NOT NULL DEFAULT false,
    "isYearEndPeriod" BOOLEAN NOT NULL DEFAULT false,
    "legacyPeriodId" TEXT,
    "architectureVersion" TEXT NOT NULL DEFAULT 'ACCOUNTING_V2',
    "createdBy" TEXT,
    "closedBy" TEXT,
    "reopenedBy" TEXT,
    "reclosedBy" TEXT,
    "closeReason" TEXT,
    "reopenReason" TEXT,
    "currentCloseRunId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2AccountingPeriod_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2AccountingPeriod_financialYearId_periodNumber_key" ON "AcctV2AccountingPeriod"("financialYearId", "periodNumber");
CREATE UNIQUE INDEX "AcctV2AccountingPeriod_tenantId_code_key" ON "AcctV2AccountingPeriod"("tenantId", "code");
CREATE INDEX "AcctV2AccountingPeriod_tenantId_startDate_endDate_idx" ON "AcctV2AccountingPeriod"("tenantId", "startDate", "endDate");
CREATE INDEX "AcctV2AccountingPeriod_tenantId_status_idx" ON "AcctV2AccountingPeriod"("tenantId", "status");

ALTER TABLE "AcctV2AccountingPeriod" ADD CONSTRAINT "AcctV2AccountingPeriod_financialYearId_fkey" FOREIGN KEY ("financialYearId") REFERENCES "AcctV2FinancialYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcctV2PeriodStatusHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "accountingPeriodId" TEXT,
    "previousStatus" TEXT,
    "newStatus" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "executedBy" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2PeriodStatusHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctV2PeriodStatusHistory_tenantId_accountingPeriodId_idx" ON "AcctV2PeriodStatusHistory"("tenantId", "accountingPeriodId");
CREATE INDEX "AcctV2PeriodStatusHistory_tenantId_financialYearId_idx" ON "AcctV2PeriodStatusHistory"("tenantId", "financialYearId");

CREATE TABLE "AcctV2PeriodCloseRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "closeNumber" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "checklistTemplateId" TEXT NOT NULL,
    "checklistTemplateVersion" TEXT NOT NULL,
    "initiatedBy" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "approvedBy" TEXT,
    "closedBy" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expectedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "completedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "blockedTaskCount" INTEGER NOT NULL DEFAULT 0,
    "warningTaskCount" INTEGER NOT NULL DEFAULT 0,
    "trialBalanceStatus" TEXT,
    "reportStatus" TEXT,
    "integrityStatus" TEXT,
    "snapshotReferences" JSONB,
    "reason" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2PeriodCloseRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2PeriodCloseRun_accountingPeriodId_closeNumber_key" ON "AcctV2PeriodCloseRun"("accountingPeriodId", "closeNumber");
CREATE INDEX "AcctV2PeriodCloseRun_tenantId_status_idx" ON "AcctV2PeriodCloseRun"("tenantId", "status");
CREATE INDEX "AcctV2PeriodCloseRun_tenantId_accountingPeriodId_idx" ON "AcctV2PeriodCloseRun"("tenantId", "accountingPeriodId");

ALTER TABLE "AcctV2PeriodCloseRun" ADD CONSTRAINT "AcctV2PeriodCloseRun_accountingPeriodId_fkey" FOREIGN KEY ("accountingPeriodId") REFERENCES "AcctV2AccountingPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcctV2PeriodCloseTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "closeRunId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "evidence" JSONB,
    "comment" TEXT,
    "completedBy" TEXT,
    "completedAt" TIMESTAMP(3),
    "waivedBy" TEXT,
    "waiveReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2PeriodCloseTask_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2PeriodCloseTask_closeRunId_taskKey_key" ON "AcctV2PeriodCloseTask"("closeRunId", "taskKey");
CREATE INDEX "AcctV2PeriodCloseTask_tenantId_closeRunId_idx" ON "AcctV2PeriodCloseTask"("tenantId", "closeRunId");

ALTER TABLE "AcctV2PeriodCloseTask" ADD CONSTRAINT "AcctV2PeriodCloseTask_closeRunId_fkey" FOREIGN KEY ("closeRunId") REFERENCES "AcctV2PeriodCloseRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcctV2PeriodCloseException" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT,
    "accountingPeriodId" TEXT NOT NULL,
    "closeRunId" TEXT,
    "taskKey" TEXT,
    "category" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "amountMinor" BIGINT,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "description" TEXT NOT NULL,
    "rootCause" TEXT,
    "evidence" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "acceptedBy" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "resolutionTarget" TEXT,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2PeriodCloseException_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctV2PeriodCloseException_tenantId_accountingPeriodId_stat_idx" ON "AcctV2PeriodCloseException"("tenantId", "accountingPeriodId", "status");

CREATE TABLE "AcctV2PeriodReopenRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "financialYearId" TEXT NOT NULL,
    "accountingPeriodId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "expectedCorrections" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "impactAnalysis" JSONB,
    "correctionScope" JSONB,
    "recloseDeadline" TIMESTAMP(3),
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "executedAt" TIMESTAMP(3),
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcctV2PeriodReopenRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctV2PeriodReopenRequest_tenantId_accountingPeriodId_stat_idx" ON "AcctV2PeriodReopenRequest"("tenantId", "accountingPeriodId", "status");
