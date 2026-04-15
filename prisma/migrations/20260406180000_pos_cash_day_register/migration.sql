-- POS cash register: opening/closing day + deposits

CREATE TABLE "PosCashDay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchKey" TEXT NOT NULL DEFAULT 'none',
    "businessDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "systemCashAccountId" TEXT NOT NULL,
    "openingBalance" DOUBLE PRECISION NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedById" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "autoClosed" BOOLEAN NOT NULL DEFAULT false,
    "totalSalesAtClose" DOUBLE PRECISION,
    "closingBalanceAtClose" DOUBLE PRECISION,
    "totalCashSalesSnapshot" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosCashDay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PosCashDayDeposit" (
    "id" TEXT NOT NULL,
    "posCashDayId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isAutoSweep" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "PosCashDayDeposit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PosCashDay_tenantId_branchKey_businessDate_key" ON "PosCashDay"("tenantId", "branchKey", "businessDate");

CREATE INDEX "PosCashDay_tenantId_businessDate_idx" ON "PosCashDay"("tenantId", "businessDate");
CREATE INDEX "PosCashDay_status_idx" ON "PosCashDay"("status");

CREATE INDEX "PosCashDayDeposit_posCashDayId_idx" ON "PosCashDayDeposit"("posCashDayId");

ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_systemCashAccountId_fkey" FOREIGN KEY ("systemCashAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PosCashDay" ADD CONSTRAINT "PosCashDay_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_posCashDayId_fkey" FOREIGN KEY ("posCashDayId") REFERENCES "PosCashDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "PaymentAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosCashDayDeposit" ADD CONSTRAINT "PosCashDayDeposit_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
