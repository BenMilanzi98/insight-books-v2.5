-- Payroll tax configuration (configurable PAYE bands per tenant) and GL account mappings.

CREATE TABLE IF NOT EXISTS "PayrollTaxConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'MW',
    "taxYear" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "bands" JSONB NOT NULL,
    "monthlyTaxFreeAllowance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollTaxConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PayrollTaxConfiguration_tenantId_idx" ON "PayrollTaxConfiguration"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollTaxConfiguration_tenantId_isActive_idx" ON "PayrollTaxConfiguration"("tenantId", "isActive");
CREATE INDEX IF NOT EXISTS "PayrollTaxConfiguration_effectiveFrom_idx" ON "PayrollTaxConfiguration"("effectiveFrom");

ALTER TABLE "PayrollTaxConfiguration"
ADD CONSTRAINT "PayrollTaxConfiguration_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "payrollAccountMappings" JSONB;
