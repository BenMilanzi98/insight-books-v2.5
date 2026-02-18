-- Benefit and EmployeeBenefit tables (safe: IF NOT EXISTS)
-- Run with: npx prisma db execute --file prisma/migrations/20260216140000_add_benefit_tables/migration.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "Benefit" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "defaultAmount" DOUBLE PRECISION DEFAULT 0,
  "defaultPercentage" DOUBLE PRECISION DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "tenantId" TEXT NOT NULL,

  CONSTRAINT "Benefit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Benefit_tenantId_idx" ON "Benefit"("tenantId");
CREATE INDEX IF NOT EXISTS "Benefit_isActive_idx" ON "Benefit"("isActive");

CREATE TABLE IF NOT EXISTS "EmployeeBenefit" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "benefitId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeBenefit_employeeId_benefitId_key" ON "EmployeeBenefit"("employeeId", "benefitId");
CREATE INDEX IF NOT EXISTS "EmployeeBenefit_employeeId_idx" ON "EmployeeBenefit"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeBenefit_benefitId_idx" ON "EmployeeBenefit"("benefitId");

-- Foreign keys only if tables exist and constraints don't
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Benefit_tenantId_fkey') THEN
    ALTER TABLE "Benefit" ADD CONSTRAINT "Benefit_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeBenefit_employeeId_fkey') THEN
    ALTER TABLE "EmployeeBenefit" ADD CONSTRAINT "EmployeeBenefit_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EmployeeBenefit_benefitId_fkey') THEN
    ALTER TABLE "EmployeeBenefit" ADD CONSTRAINT "EmployeeBenefit_benefitId_fkey"
      FOREIGN KEY ("benefitId") REFERENCES "Benefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
