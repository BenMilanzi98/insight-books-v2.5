-- Phase 7 — Financial Reporting Engine (additive, business-scoped, indexed,
-- backward-compatible; reversible by dropping the three new tables).

CREATE TABLE "AcctV2ReportRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "definitionId" TEXT,
    "definitionVersion" TEXT,
    "filters" JSONB NOT NULL,
    "filtersHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "integrityStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "trialBalanceStatus" TEXT,
    "integrityWarnings" JSONB,
    "totals" JSONB,
    "resultChecksum" TEXT NOT NULL,
    "accountingDataVersion" TEXT,
    "generatedBy" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvalComment" TEXT,
    "supersededByRunId" TEXT,
    "supersededReason" TEXT,
    "requestId" TEXT,
    "correlationId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "AcctV2ReportRun_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctV2ReportRun_tenantId_reportType_generatedAt_idx" ON "AcctV2ReportRun"("tenantId", "reportType", "generatedAt");
CREATE INDEX "AcctV2ReportRun_tenantId_status_idx" ON "AcctV2ReportRun"("tenantId", "status");
CREATE INDEX "AcctV2ReportRun_tenantId_filtersHash_idx" ON "AcctV2ReportRun"("tenantId", "filtersHash");

CREATE TABLE "AcctV2ReportSnapshotV2" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "definitionVersion" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payload" JSONB NOT NULL,
    "checksum" TEXT NOT NULL,
    "accountingDataVersion" TEXT,
    "integrityStatus" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "supersededBySnapshotId" TEXT,
    "supersededReason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2ReportSnapshotV2_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AcctV2ReportSnapshotV2_tenantId_reportType_createdAt_idx" ON "AcctV2ReportSnapshotV2"("tenantId", "reportType", "createdAt");
CREATE INDEX "AcctV2ReportSnapshotV2_tenantId_status_idx" ON "AcctV2ReportSnapshotV2"("tenantId", "status");

ALTER TABLE "AcctV2ReportSnapshotV2" ADD CONSTRAINT "AcctV2ReportSnapshotV2_runId_fkey" FOREIGN KEY ("runId") REFERENCES "AcctV2ReportRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "AcctV2ReportCache" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filtersHash" TEXT NOT NULL,
    "definitionVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "sourceDataVersion" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "builtAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcctV2ReportCache_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AcctV2ReportCache_tenantId_reportType_filtersHash_definitio_key" ON "AcctV2ReportCache"("tenantId", "reportType", "filtersHash", "definitionVersion");
CREATE INDEX "AcctV2ReportCache_tenantId_reportType_idx" ON "AcctV2ReportCache"("tenantId", "reportType");
