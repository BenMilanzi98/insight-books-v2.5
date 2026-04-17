-- Budget & Forecast module: CoA-linked expense budgets and revenue forecasts (actuals computed from GL, not stored here).

CREATE TABLE "BfExpenseBudgetHeader" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BfExpenseBudgetHeader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BfExpenseBudgetLine" (
    "id" TEXT NOT NULL,
    "expenseBudgetHeaderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BfExpenseBudgetLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BfRevenueForecastHeader" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "version" TEXT NOT NULL DEFAULT 'v1',
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BfRevenueForecastHeader_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BfRevenueForecastLine" (
    "id" TEXT NOT NULL,
    "revenueForecastHeaderId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "plannedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BfRevenueForecastLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BfExpenseBudgetHeader_tenantId_idx" ON "BfExpenseBudgetHeader"("tenantId");
CREATE INDEX "BfExpenseBudgetHeader_status_idx" ON "BfExpenseBudgetHeader"("status");
CREATE INDEX "BfExpenseBudgetHeader_periodType_idx" ON "BfExpenseBudgetHeader"("periodType");
CREATE INDEX "BfExpenseBudgetHeader_startDate_endDate_idx" ON "BfExpenseBudgetHeader"("startDate", "endDate");

CREATE UNIQUE INDEX "BfExpenseBudgetLine_expenseBudgetHeaderId_accountId_period_key" ON "BfExpenseBudgetLine"("expenseBudgetHeaderId", "accountId", "period");
CREATE INDEX "BfExpenseBudgetLine_expenseBudgetHeaderId_idx" ON "BfExpenseBudgetLine"("expenseBudgetHeaderId");
CREATE INDEX "BfExpenseBudgetLine_accountId_idx" ON "BfExpenseBudgetLine"("accountId");

CREATE INDEX "BfRevenueForecastHeader_tenantId_idx" ON "BfRevenueForecastHeader"("tenantId");
CREATE INDEX "BfRevenueForecastHeader_status_idx" ON "BfRevenueForecastHeader"("status");
CREATE INDEX "BfRevenueForecastHeader_periodType_idx" ON "BfRevenueForecastHeader"("periodType");
CREATE INDEX "BfRevenueForecastHeader_startDate_endDate_idx" ON "BfRevenueForecastHeader"("startDate", "endDate");

CREATE UNIQUE INDEX "BfRevenueForecastLine_revenueForecastHeaderId_accountId_period_key" ON "BfRevenueForecastLine"("revenueForecastHeaderId", "accountId", "period");
CREATE INDEX "BfRevenueForecastLine_revenueForecastHeaderId_idx" ON "BfRevenueForecastLine"("revenueForecastHeaderId");
CREATE INDEX "BfRevenueForecastLine_accountId_idx" ON "BfRevenueForecastLine"("accountId");

ALTER TABLE "BfExpenseBudgetHeader" ADD CONSTRAINT "BfExpenseBudgetHeader_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BfExpenseBudgetHeader" ADD CONSTRAINT "BfExpenseBudgetHeader_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BfExpenseBudgetLine" ADD CONSTRAINT "BfExpenseBudgetLine_expenseBudgetHeaderId_fkey" FOREIGN KEY ("expenseBudgetHeaderId") REFERENCES "BfExpenseBudgetHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BfExpenseBudgetLine" ADD CONSTRAINT "BfExpenseBudgetLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BfRevenueForecastHeader" ADD CONSTRAINT "BfRevenueForecastHeader_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BfRevenueForecastHeader" ADD CONSTRAINT "BfRevenueForecastHeader_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BfRevenueForecastLine" ADD CONSTRAINT "BfRevenueForecastLine_revenueForecastHeaderId_fkey" FOREIGN KEY ("revenueForecastHeaderId") REFERENCES "BfRevenueForecastHeader"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BfRevenueForecastLine" ADD CONSTRAINT "BfRevenueForecastLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
