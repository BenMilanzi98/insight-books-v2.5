-- HR/Payroll foundation: tenant-scoped uniqueness + EmploymentContract

-- Employee.employeeId: global unique → (tenantId, employeeId)
DROP INDEX IF EXISTS "Employee_employeeId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Employee_tenantId_employeeId_key" ON "Employee"("tenantId", "employeeId");

-- Department.name: global unique → (tenantId, name)
DROP INDEX IF EXISTS "Department_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Department_tenantId_name_key" ON "Department"("tenantId", "name");

-- Versioned employment contracts (Decimal money from day one)
CREATE TABLE IF NOT EXISTS "EmploymentContract" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "payBasis" TEXT NOT NULL DEFAULT 'MONTHLY_SALARY',
    "payFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "basicSalary" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(18,2),
    "dailyRate" DECIMAL(18,2),
    "standardWeeklyHours" DECIMAL(8,2),
    "standardMonthlyHours" DECIMAL(8,2),
    "overtimeEligible" BOOLEAN NOT NULL DEFAULT true,
    "overtimeMultiplier" DECIMAL(8,4) NOT NULL DEFAULT 1.5,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "position" TEXT,
    "departmentId" TEXT,
    "branchId" TEXT,
    "employmentType" TEXT,
    "pensionEligible" BOOLEAN NOT NULL DEFAULT true,
    "gratuityEligible" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "EmploymentContract_tenantId_idx" ON "EmploymentContract"("tenantId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_employeeId_idx" ON "EmploymentContract"("employeeId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_tenantId_employeeId_status_idx" ON "EmploymentContract"("tenantId", "employeeId", "status");
CREATE INDEX IF NOT EXISTS "EmploymentContract_effectiveFrom_idx" ON "EmploymentContract"("effectiveFrom");

DO $$ BEGIN
  ALTER TABLE "EmploymentContract"
    ADD CONSTRAINT "EmploymentContract_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "EmploymentContract"
    ADD CONSTRAINT "EmploymentContract_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
