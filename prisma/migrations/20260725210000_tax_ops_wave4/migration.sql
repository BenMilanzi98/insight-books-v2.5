-- Wave 4 — Tax periods, returns, payments, refunds, credits, withholding

CREATE TABLE IF NOT EXISTS "tax_period" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodType" TEXT NOT NULL DEFAULT 'MONTHLY',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenedById" TEXT,
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tax_period_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_period_tenantId_code_key" ON "tax_period"("tenantId", "code");
CREATE UNIQUE INDEX IF NOT EXISTS "tax_period_tenantId_startDate_endDate_periodType_key"
  ON "tax_period"("tenantId", "startDate", "endDate", "periodType");
CREATE INDEX IF NOT EXISTS "tax_period_tenantId_status_idx" ON "tax_period"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_period_tenantId_startDate_endDate_idx" ON "tax_period"("tenantId", "startDate", "endDate");

CREATE TABLE IF NOT EXISTS "tax_return" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxPeriodId" TEXT NOT NULL,
    "returnType" TEXT NOT NULL DEFAULT 'VAT',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "reference" TEXT,
    "outputTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "inputTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netTax" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "filedAt" TIMESTAMP(3),
    "filedById" TEXT,
    "amendedFromId" TEXT,
    "amendmentReason" TEXT,
    "notes" TEXT,
    "snapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_return_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_return_tenantId_status_idx" ON "tax_return"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_return_taxPeriodId_idx" ON "tax_return"("taxPeriodId");

CREATE TABLE IF NOT EXISTS "tax_payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxPeriodId" TEXT,
    "taxTypeId" TEXT,
    "taxReturnId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentDate" DATE NOT NULL,
    "paymentMethod" TEXT,
    "paymentAccountId" TEXT,
    "expenseId" TEXT,
    "paymentId" TEXT,
    "journalEntryId" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "allocationJson" JSONB,
    "reversedAt" TIMESTAMP(3),
    "reversedById" TEXT,
    "reversalPaymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_payment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_payment_tenantId_status_idx" ON "tax_payment"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_payment_tenantId_paymentDate_idx" ON "tax_payment"("tenantId", "paymentDate");
CREATE INDEX IF NOT EXISTS "tax_payment_taxPeriodId_idx" ON "tax_payment"("taxPeriodId");
CREATE INDEX IF NOT EXISTS "tax_payment_taxTypeId_idx" ON "tax_payment"("taxTypeId");

CREATE TABLE IF NOT EXISTS "tax_refund" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxPeriodId" TEXT,
    "taxTypeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2) NOT NULL,
    "refundDate" DATE,
    "paymentAccountId" TEXT,
    "journalEntryId" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_refund_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_refund_tenantId_status_idx" ON "tax_refund"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_refund_taxPeriodId_idx" ON "tax_refund"("taxPeriodId");

CREATE TABLE IF NOT EXISTS "tax_credit" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxPeriodId" TEXT,
    "taxTypeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "amount" DECIMAL(18,2) NOT NULL,
    "remaining" DECIMAL(18,2) NOT NULL,
    "source" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "appliedToPaymentId" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_credit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_credit_tenantId_status_idx" ON "tax_credit"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_credit_taxPeriodId_idx" ON "tax_credit"("taxPeriodId");

CREATE TABLE IF NOT EXISTS "tax_withholding_remittance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taxPeriodId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "amount" DECIMAL(18,2) NOT NULL,
    "remittanceDate" DATE,
    "counterparty" TEXT,
    "paymentAccountId" TEXT,
    "journalEntryId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "reversedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    CONSTRAINT "tax_withholding_remittance_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "tax_withholding_remittance_tenantId_status_idx"
  ON "tax_withholding_remittance"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "tax_withholding_remittance_taxPeriodId_idx"
  ON "tax_withholding_remittance"("taxPeriodId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_period_tenantId_fkey') THEN
    ALTER TABLE "tax_period" ADD CONSTRAINT "tax_period_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_return_tenantId_fkey') THEN
    ALTER TABLE "tax_return" ADD CONSTRAINT "tax_return_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_return_taxPeriodId_fkey') THEN
    ALTER TABLE "tax_return" ADD CONSTRAINT "tax_return_taxPeriodId_fkey"
      FOREIGN KEY ("taxPeriodId") REFERENCES "tax_period"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_return_amendedFromId_fkey') THEN
    ALTER TABLE "tax_return" ADD CONSTRAINT "tax_return_amendedFromId_fkey"
      FOREIGN KEY ("amendedFromId") REFERENCES "tax_return"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_payment_tenantId_fkey') THEN
    ALTER TABLE "tax_payment" ADD CONSTRAINT "tax_payment_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_payment_taxPeriodId_fkey') THEN
    ALTER TABLE "tax_payment" ADD CONSTRAINT "tax_payment_taxPeriodId_fkey"
      FOREIGN KEY ("taxPeriodId") REFERENCES "tax_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_refund_tenantId_fkey') THEN
    ALTER TABLE "tax_refund" ADD CONSTRAINT "tax_refund_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_refund_taxPeriodId_fkey') THEN
    ALTER TABLE "tax_refund" ADD CONSTRAINT "tax_refund_taxPeriodId_fkey"
      FOREIGN KEY ("taxPeriodId") REFERENCES "tax_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_credit_tenantId_fkey') THEN
    ALTER TABLE "tax_credit" ADD CONSTRAINT "tax_credit_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_credit_taxPeriodId_fkey') THEN
    ALTER TABLE "tax_credit" ADD CONSTRAINT "tax_credit_taxPeriodId_fkey"
      FOREIGN KEY ("taxPeriodId") REFERENCES "tax_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_withholding_remittance_tenantId_fkey') THEN
    ALTER TABLE "tax_withholding_remittance" ADD CONSTRAINT "tax_withholding_remittance_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_withholding_remittance_taxPeriodId_fkey') THEN
    ALTER TABLE "tax_withholding_remittance" ADD CONSTRAINT "tax_withholding_remittance_taxPeriodId_fkey"
      FOREIGN KEY ("taxPeriodId") REFERENCES "tax_period"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
