-- Phase 13 Financial Planning V2 (PlanV2*) — additive; never posts to GL.

CREATE TABLE IF NOT EXISTS "PlanV2Configuration" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "planningEnabled" BOOLEAN NOT NULL DEFAULT true,
  "baseCurrency" TEXT NOT NULL DEFAULT 'MWK', "defaultForecastHorizonMonths" INTEGER NOT NULL DEFAULT 12,
  "defaultGranularity" TEXT NOT NULL DEFAULT 'MONTHLY', "defaultHistoricalLookbackMonths" INTEGER NOT NULL DEFAULT 24,
  "rollingForecastEnabled" BOOLEAN NOT NULL DEFAULT true, "rollingForecastMonths" INTEGER NOT NULL DEFAULT 12,
  "closedActualsPreferred" BOOLEAN NOT NULL DEFAULT true, "provisionalActualsAllowed" BOOLEAN NOT NULL DEFAULT true,
  "manualOverridesEnabled" BOOLEAN NOT NULL DEFAULT true, "aiSuggestionsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "architectureVersion" TEXT NOT NULL DEFAULT 'PLAN_V2', "effectiveFrom" DATE NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2Configuration_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2Configuration_tenantId_key" ON "PlanV2Configuration"("tenantId");

CREATE TABLE IF NOT EXISTS "PlanV2Scenario" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "code" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "scenarioType" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'ACTIVE', "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "PlanV2Scenario_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2Scenario_tenantId_code_key" ON "PlanV2Scenario"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "PlanV2Scenario_tenantId_scenarioType_idx" ON "PlanV2Scenario"("tenantId", "scenarioType");

CREATE TABLE IF NOT EXISTS "PlanV2AssumptionSet" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "name" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT, "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "PlanV2AssumptionSet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2AssumptionSet_scenarioId_version_key" ON "PlanV2AssumptionSet"("scenarioId", "version");
CREATE INDEX IF NOT EXISTS "PlanV2AssumptionSet_tenantId_scenarioId_idx" ON "PlanV2AssumptionSet"("tenantId", "scenarioId");

CREATE TABLE IF NOT EXISTS "PlanV2Assumption" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "assumptionSetId" TEXT NOT NULL, "category" TEXT NOT NULL, "key" TEXT NOT NULL,
  "assumptionType" TEXT NOT NULL, "valueNumeric" DECIMAL(18,6), "valueJson" JSONB, "unit" TEXT,
  "effectiveFromPeriod" TEXT, "effectiveToPeriod" TEXT, "reason" TEXT, "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2Assumption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2Assumption_assumptionSetId_key_key" ON "PlanV2Assumption"("assumptionSetId", "key");
CREATE INDEX IF NOT EXISTS "PlanV2Assumption_tenantId_category_idx" ON "PlanV2Assumption"("tenantId", "category");

CREATE TABLE IF NOT EXISTS "PlanV2Budget" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "budgetNumber" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "financialYearId" TEXT, "fromDate" DATE NOT NULL, "toDate" DATE NOT NULL, "granularity" TEXT NOT NULL DEFAULT 'MONTHLY',
  "currency" TEXT NOT NULL DEFAULT 'MWK', "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "preparedBy" TEXT, "approvedBy" TEXT, "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "PlanV2Budget_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2Budget_tenantId_budgetNumber_version_key" ON "PlanV2Budget"("tenantId", "budgetNumber", "version");
CREATE INDEX IF NOT EXISTS "PlanV2Budget_tenantId_status_idx" ON "PlanV2Budget"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "PlanV2BudgetLine" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "budgetId" TEXT NOT NULL, "periodKey" TEXT NOT NULL,
  "accountId" TEXT, "reportLineKey" TEXT, "amountMinor" BIGINT NOT NULL, "currency" TEXT NOT NULL DEFAULT 'MWK',
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2BudgetLine_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2BudgetLine_budgetId_periodKey_accountId_reportLineKey_key"
  ON "PlanV2BudgetLine"("budgetId", "periodKey", "accountId", "reportLineKey");
CREATE INDEX IF NOT EXISTS "PlanV2BudgetLine_tenantId_budgetId_idx" ON "PlanV2BudgetLine"("tenantId", "budgetId");

CREATE TABLE IF NOT EXISTS "PlanV2ForecastCycle" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "cycleNumber" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT,
  "actualsCutoffDate" DATE, "forecastStartDate" DATE NOT NULL, "forecastEndDate" DATE NOT NULL,
  "horizonMonths" INTEGER NOT NULL DEFAULT 12, "granularity" TEXT NOT NULL DEFAULT 'MONTHLY',
  "currency" TEXT NOT NULL DEFAULT 'MWK', "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "PlanV2ForecastCycle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2ForecastCycle_tenantId_cycleNumber_key" ON "PlanV2ForecastCycle"("tenantId", "cycleNumber");
CREATE INDEX IF NOT EXISTS "PlanV2ForecastCycle_tenantId_status_idx" ON "PlanV2ForecastCycle"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "PlanV2ForecastVersion" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "forecastCycleId" TEXT NOT NULL, "scenarioId" TEXT NOT NULL,
  "assumptionSetId" TEXT NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "integrityStatus" TEXT NOT NULL DEFAULT 'NOT_CALCULATED',
  "modelVersion" TEXT NOT NULL DEFAULT 'THREE_STATEMENT_V1', "sourceActualsVersion" TEXT,
  "baseRevenueMinor" BIGINT, "openingBalances" JSONB, "assumptionsSnapshot" JSONB, "resultPayload" JSONB,
  "checksum" TEXT, "preparedBy" TEXT, "reviewedBy" TEXT, "approvedBy" TEXT, "generatedAt" TIMESTAMP(3), "approvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "metadata" JSONB,
  CONSTRAINT "PlanV2ForecastVersion_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2ForecastVersion_forecastCycleId_scenarioId_version_key"
  ON "PlanV2ForecastVersion"("forecastCycleId", "scenarioId", "version");
CREATE INDEX IF NOT EXISTS "PlanV2ForecastVersion_tenantId_status_idx" ON "PlanV2ForecastVersion"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlanV2ForecastVersion_tenantId_forecastCycleId_idx" ON "PlanV2ForecastVersion"("tenantId", "forecastCycleId");

CREATE TABLE IF NOT EXISTS "PlanV2ManualOverride" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "forecastVersionId" TEXT NOT NULL, "periodKey" TEXT NOT NULL,
  "lineKey" TEXT NOT NULL, "calculatedMinor" BIGINT NOT NULL, "overrideMinor" BIGINT NOT NULL, "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT', "createdBy" TEXT, "approvedBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2ManualOverride_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanV2ManualOverride_tenantId_forecastVersionId_idx" ON "PlanV2ManualOverride"("tenantId", "forecastVersionId");

CREATE TABLE IF NOT EXISTS "PlanV2ForecastSnapshot" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "forecastVersionId" TEXT NOT NULL, "snapshotType" TEXT NOT NULL,
  "payload" JSONB NOT NULL, "checksum" TEXT, "generatedBy" TEXT, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2ForecastSnapshot_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlanV2ForecastSnapshot_forecastVersionId_snapshotType_key"
  ON "PlanV2ForecastSnapshot"("forecastVersionId", "snapshotType");
CREATE INDEX IF NOT EXISTS "PlanV2ForecastSnapshot_tenantId_forecastVersionId_idx" ON "PlanV2ForecastSnapshot"("tenantId", "forecastVersionId");

CREATE TABLE IF NOT EXISTS "PlanV2AISuggestion" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "forecastVersionId" TEXT, "category" TEXT NOT NULL,
  "suggestionKey" TEXT NOT NULL, "proposedValue" JSONB NOT NULL, "reason" TEXT, "confidence" TEXT NOT NULL DEFAULT 'LOW',
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW', "sourceDataRange" JSONB, "modelProvider" TEXT,
  "reviewedBy" TEXT, "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanV2AISuggestion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PlanV2AISuggestion_tenantId_status_idx" ON "PlanV2AISuggestion"("tenantId", "status");

DO $$ BEGIN
  ALTER TABLE "PlanV2AssumptionSet" ADD CONSTRAINT "PlanV2AssumptionSet_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "PlanV2Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2Assumption" ADD CONSTRAINT "PlanV2Assumption_assumptionSetId_fkey"
    FOREIGN KEY ("assumptionSetId") REFERENCES "PlanV2AssumptionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2BudgetLine" ADD CONSTRAINT "PlanV2BudgetLine_budgetId_fkey"
    FOREIGN KEY ("budgetId") REFERENCES "PlanV2Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2ForecastVersion" ADD CONSTRAINT "PlanV2ForecastVersion_forecastCycleId_fkey"
    FOREIGN KEY ("forecastCycleId") REFERENCES "PlanV2ForecastCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2ForecastVersion" ADD CONSTRAINT "PlanV2ForecastVersion_scenarioId_fkey"
    FOREIGN KEY ("scenarioId") REFERENCES "PlanV2Scenario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2ForecastVersion" ADD CONSTRAINT "PlanV2ForecastVersion_assumptionSetId_fkey"
    FOREIGN KEY ("assumptionSetId") REFERENCES "PlanV2AssumptionSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2ManualOverride" ADD CONSTRAINT "PlanV2ManualOverride_forecastVersionId_fkey"
    FOREIGN KEY ("forecastVersionId") REFERENCES "PlanV2ForecastVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2ForecastSnapshot" ADD CONSTRAINT "PlanV2ForecastSnapshot_forecastVersionId_fkey"
    FOREIGN KEY ("forecastVersionId") REFERENCES "PlanV2ForecastVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PlanV2AISuggestion" ADD CONSTRAINT "PlanV2AISuggestion_forecastVersionId_fkey"
    FOREIGN KEY ("forecastVersionId") REFERENCES "PlanV2ForecastVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Pre-enable financial planning flags globally
INSERT INTO "AcctV2FeatureFlag" ("id", "tenantId", "flagKey", "moduleKey", "eventType", "enabled", "reason", "updatedBy", "createdAt", "updatedAt")
VALUES
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'financialPlanningV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'budgetingV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'forecastingV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'assumptionsEngineV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'scenarioPlanningV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'threeStatementProjectionV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'varianceAnalysisV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (concat('planflag_', md5(random()::text || clock_timestamp()::text)), '*', 'forecastSnapshotsV2Enabled', '*', '*', true, 'Phase 13 pre-enabled', 'system', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("tenantId", "flagKey", "moduleKey", "eventType")
DO UPDATE SET "enabled" = true, "reason" = EXCLUDED."reason", "updatedAt" = CURRENT_TIMESTAMP;