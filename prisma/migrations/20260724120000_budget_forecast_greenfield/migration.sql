-- Wave 1: Rename legacy Budget* tables, create greenfield PlanningBudget / Forecast models.
-- Budgets/Forecasts never create journals or stock movements.

-- ── Rename legacy tables (idempotent if already renamed) ─────────────────────
DO $$
BEGIN
  IF to_regclass('"Budget"') IS NOT NULL AND to_regclass('"LegacyBudget"') IS NULL THEN
    ALTER TABLE "Budget" RENAME TO "LegacyBudget";
  END IF;
  IF to_regclass('"BudgetItem"') IS NOT NULL AND to_regclass('"LegacyBudgetItem"') IS NULL THEN
    ALTER TABLE "BudgetItem" RENAME TO "LegacyBudgetItem";
  END IF;
  IF to_regclass('"RevenueBudgetBreakdown"') IS NOT NULL AND to_regclass('"LegacyRevenueBudgetBreakdown"') IS NULL THEN
    ALTER TABLE "RevenueBudgetBreakdown" RENAME TO "LegacyRevenueBudgetBreakdown";
  END IF;
END $$;

-- Rename primary-key constraints when present under old names
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Budget_pkey') THEN
    ALTER TABLE "LegacyBudget" RENAME CONSTRAINT "Budget_pkey" TO "LegacyBudget_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetItem_pkey') THEN
    ALTER TABLE "LegacyBudgetItem" RENAME CONSTRAINT "BudgetItem_pkey" TO "LegacyBudgetItem_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RevenueBudgetBreakdown_pkey') THEN
    ALTER TABLE "LegacyRevenueBudgetBreakdown" RENAME CONSTRAINT "RevenueBudgetBreakdown_pkey" TO "LegacyRevenueBudgetBreakdown_pkey";
  END IF;
END $$;

-- ── Greenfield planning tables ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "PlanningBudget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "budgetType" TEXT NOT NULL DEFAULT 'OPERATING',
    "budgetMethod" TEXT NOT NULL DEFAULT 'CREATE_MANUALLY',
    "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "planningMode" TEXT NOT NULL DEFAULT 'POSTING_ACCOUNT_DETAIL',
    "fiscalYear" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "branchId" TEXT,
    "departmentId" TEXT,
    "projectId" TEXT,
    "costCentreId" TEXT,
    "parentBudgetId" TEXT,
    "copiedFromBudgetId" TEXT,
    "generatedFromActualsStart" TIMESTAMP(3),
    "generatedFromActualsEnd" TIMESTAMP(3),
    "assumptionSetId" TEXT,
    "approvalState" TEXT NOT NULL DEFAULT 'NONE',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningBudget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountCodeSnapshot" TEXT NOT NULL,
    "accountNameSnapshot" TEXT NOT NULL,
    "accountTypeSnapshot" TEXT,
    "accountCategorySnapshot" TEXT,
    "parentAccountIdSnapshot" TEXT,
    "branchId" TEXT,
    "departmentId" TEXT,
    "projectId" TEXT,
    "costCentreId" TEXT,
    "lineType" TEXT NOT NULL DEFAULT 'PLANNED',
    "calculationMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "annualAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "assumptions" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetPeriodAmount" (
    "id" TEXT NOT NULL,
    "budgetLineId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "monthNumber" INTEGER,
    "quarterNumber" INTEGER,
    "plannedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "sourceMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "growthRate" DOUBLE PRECISION,
    "distributionWeight" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "BudgetPeriodAmount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetVersion" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "revisionNumber" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL,
    "changeReason" TEXT,
    "snapshotJson" JSONB,
    "snapshotChecksum" TEXT,
    "createdById" TEXT,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BudgetApproval" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "versionId" TEXT,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "state" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "BudgetApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForecastAssumptionSet" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastAssumptionSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForecastAssumption" (
    "id" TEXT NOT NULL,
    "assumptionSetId" TEXT NOT NULL,
    "assumptionType" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'GLOBAL',
    "scopeId" TEXT,
    "accountId" TEXT,
    "value" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PERCENT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "ForecastAssumption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PlanningForecast" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "forecastType" TEXT NOT NULL DEFAULT 'ROLLING',
    "scenarioType" TEXT NOT NULL DEFAULT 'BASE_CASE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "cutoffDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "sourceBudgetId" TEXT,
    "sourceBudgetVersionId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "calculationVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "branchId" TEXT,
    "departmentId" TEXT,
    "projectId" TEXT,
    "costCentreId" TEXT,
    "assumptionSetId" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningForecast_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForecastLine" (
    "id" TEXT NOT NULL,
    "forecastId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountCodeSnapshot" TEXT NOT NULL,
    "accountNameSnapshot" TEXT NOT NULL,
    "accountTypeSnapshot" TEXT,
    "forecastMethod" TEXT NOT NULL DEFAULT 'MANUAL',
    "historicalActualMinor" INTEGER NOT NULL DEFAULT 0,
    "budgetAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "projectedAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "confidenceLevel" TEXT,
    "growthRate" DOUBLE PRECISION,
    "seasonalityFactor" DOUBLE PRECISION,
    "recurringAmountMinor" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ForecastLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForecastPeriodAmount" (
    "id" TEXT NOT NULL,
    "forecastLineId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "actualAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "budgetAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "forecastAmountMinor" INTEGER NOT NULL DEFAULT 0,
    "sourceType" TEXT NOT NULL DEFAULT 'FORECAST',
    "calculationVersion" TEXT NOT NULL DEFAULT '1.0.0',
    "assumptionReference" TEXT,

    CONSTRAINT "ForecastPeriodAmount_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "PlanningBudget_tenantId_businessId_idx" ON "PlanningBudget"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "PlanningBudget_tenantId_status_idx" ON "PlanningBudget"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlanningBudget_tenantId_startDate_endDate_idx" ON "PlanningBudget"("tenantId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "PlanningBudget_branchId_idx" ON "PlanningBudget"("branchId");

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetLine_budgetId_accountId_branchId_departmentId_projectId_costCentreId_key"
  ON "BudgetLine"("budgetId", "accountId", "branchId", "departmentId", "projectId", "costCentreId");
CREATE INDEX IF NOT EXISTS "BudgetLine_budgetId_idx" ON "BudgetLine"("budgetId");
CREATE INDEX IF NOT EXISTS "BudgetLine_accountId_idx" ON "BudgetLine"("accountId");

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetPeriodAmount_budgetLineId_periodStart_periodEnd_key"
  ON "BudgetPeriodAmount"("budgetLineId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "BudgetPeriodAmount_budgetLineId_idx" ON "BudgetPeriodAmount"("budgetLineId");

CREATE UNIQUE INDEX IF NOT EXISTS "BudgetVersion_budgetId_versionNumber_revisionNumber_key"
  ON "BudgetVersion"("budgetId", "versionNumber", "revisionNumber");
CREATE INDEX IF NOT EXISTS "BudgetVersion_budgetId_state_idx" ON "BudgetVersion"("budgetId", "state");

CREATE INDEX IF NOT EXISTS "BudgetApproval_budgetId_state_idx" ON "BudgetApproval"("budgetId", "state");

CREATE INDEX IF NOT EXISTS "ForecastAssumptionSet_tenantId_businessId_idx" ON "ForecastAssumptionSet"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "ForecastAssumption_assumptionSetId_idx" ON "ForecastAssumption"("assumptionSetId");

CREATE INDEX IF NOT EXISTS "PlanningForecast_tenantId_businessId_idx" ON "PlanningForecast"("tenantId", "businessId");
CREATE INDEX IF NOT EXISTS "PlanningForecast_tenantId_status_idx" ON "PlanningForecast"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "PlanningForecast_sourceBudgetId_idx" ON "PlanningForecast"("sourceBudgetId");

CREATE UNIQUE INDEX IF NOT EXISTS "ForecastLine_forecastId_accountId_key" ON "ForecastLine"("forecastId", "accountId");
CREATE INDEX IF NOT EXISTS "ForecastLine_forecastId_idx" ON "ForecastLine"("forecastId");
CREATE INDEX IF NOT EXISTS "ForecastLine_accountId_idx" ON "ForecastLine"("accountId");

CREATE UNIQUE INDEX IF NOT EXISTS "ForecastPeriodAmount_forecastLineId_periodStart_periodEnd_key"
  ON "ForecastPeriodAmount"("forecastLineId", "periodStart", "periodEnd");
CREATE INDEX IF NOT EXISTS "ForecastPeriodAmount_forecastLineId_idx" ON "ForecastPeriodAmount"("forecastLineId");

-- Foreign keys (guarded)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_tenantId_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_createdById_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_approvedById_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_lockedById_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_lockedById_fkey"
      FOREIGN KEY ("lockedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_parentBudgetId_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_parentBudgetId_fkey"
      FOREIGN KEY ("parentBudgetId") REFERENCES "PlanningBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningBudget_copiedFromBudgetId_fkey') THEN
    ALTER TABLE "PlanningBudget" ADD CONSTRAINT "PlanningBudget_copiedFromBudgetId_fkey"
      FOREIGN KEY ("copiedFromBudgetId") REFERENCES "PlanningBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetLine_budgetId_fkey') THEN
    ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey"
      FOREIGN KEY ("budgetId") REFERENCES "PlanningBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetLine_accountId_fkey') THEN
    ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetPeriodAmount_budgetLineId_fkey') THEN
    ALTER TABLE "BudgetPeriodAmount" ADD CONSTRAINT "BudgetPeriodAmount_budgetLineId_fkey"
      FOREIGN KEY ("budgetLineId") REFERENCES "BudgetLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetVersion_budgetId_fkey') THEN
    ALTER TABLE "BudgetVersion" ADD CONSTRAINT "BudgetVersion_budgetId_fkey"
      FOREIGN KEY ("budgetId") REFERENCES "PlanningBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetVersion_createdById_fkey') THEN
    ALTER TABLE "BudgetVersion" ADD CONSTRAINT "BudgetVersion_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetVersion_approvedById_fkey') THEN
    ALTER TABLE "BudgetVersion" ADD CONSTRAINT "BudgetVersion_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetApproval_budgetId_fkey') THEN
    ALTER TABLE "BudgetApproval" ADD CONSTRAINT "BudgetApproval_budgetId_fkey"
      FOREIGN KEY ("budgetId") REFERENCES "PlanningBudget"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetApproval_versionId_fkey') THEN
    ALTER TABLE "BudgetApproval" ADD CONSTRAINT "BudgetApproval_versionId_fkey"
      FOREIGN KEY ("versionId") REFERENCES "BudgetVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetApproval_requestedById_fkey') THEN
    ALTER TABLE "BudgetApproval" ADD CONSTRAINT "BudgetApproval_requestedById_fkey"
      FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'BudgetApproval_approverId_fkey') THEN
    ALTER TABLE "BudgetApproval" ADD CONSTRAINT "BudgetApproval_approverId_fkey"
      FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastAssumptionSet_tenantId_fkey') THEN
    ALTER TABLE "ForecastAssumptionSet" ADD CONSTRAINT "ForecastAssumptionSet_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastAssumptionSet_createdById_fkey') THEN
    ALTER TABLE "ForecastAssumptionSet" ADD CONSTRAINT "ForecastAssumptionSet_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastAssumption_assumptionSetId_fkey') THEN
    ALTER TABLE "ForecastAssumption" ADD CONSTRAINT "ForecastAssumption_assumptionSetId_fkey"
      FOREIGN KEY ("assumptionSetId") REFERENCES "ForecastAssumptionSet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastAssumption_accountId_fkey') THEN
    ALTER TABLE "ForecastAssumption" ADD CONSTRAINT "ForecastAssumption_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecast_tenantId_fkey') THEN
    ALTER TABLE "PlanningForecast" ADD CONSTRAINT "PlanningForecast_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecast_createdById_fkey') THEN
    ALTER TABLE "PlanningForecast" ADD CONSTRAINT "PlanningForecast_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecast_approvedById_fkey') THEN
    ALTER TABLE "PlanningForecast" ADD CONSTRAINT "PlanningForecast_approvedById_fkey"
      FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecast_sourceBudgetId_fkey') THEN
    ALTER TABLE "PlanningForecast" ADD CONSTRAINT "PlanningForecast_sourceBudgetId_fkey"
      FOREIGN KEY ("sourceBudgetId") REFERENCES "PlanningBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PlanningForecast_assumptionSetId_fkey') THEN
    ALTER TABLE "PlanningForecast" ADD CONSTRAINT "PlanningForecast_assumptionSetId_fkey"
      FOREIGN KEY ("assumptionSetId") REFERENCES "ForecastAssumptionSet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastLine_forecastId_fkey') THEN
    ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_forecastId_fkey"
      FOREIGN KEY ("forecastId") REFERENCES "PlanningForecast"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastLine_accountId_fkey') THEN
    ALTER TABLE "ForecastLine" ADD CONSTRAINT "ForecastLine_accountId_fkey"
      FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForecastPeriodAmount_forecastLineId_fkey') THEN
    ALTER TABLE "ForecastPeriodAmount" ADD CONSTRAINT "ForecastPeriodAmount_forecastLineId_fkey"
      FOREIGN KEY ("forecastLineId") REFERENCES "ForecastLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
