-- HR / Payroll V2 full programme migration
-- Decimal money + attendance approval + leave accrual + payroll runs + catalogues

-- Employee money → Decimal
ALTER TABLE "Employee" ALTER COLUMN "salary" TYPE DECIMAL(18,2) USING ROUND("salary"::numeric, 2);
ALTER TABLE "Employee" ALTER COLUMN "grossSalary" TYPE DECIMAL(18,2) USING ROUND("grossSalary"::numeric, 2);
ALTER TABLE "Employee" ALTER COLUMN "hourlyRate" TYPE DECIMAL(18,2) USING ROUND("hourlyRate"::numeric, 2);

-- Payroll money → Decimal + optional run link
ALTER TABLE "Payroll" ALTER COLUMN "basicSalary" TYPE DECIMAL(18,2) USING ROUND("basicSalary"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "deductions" TYPE DECIMAL(18,2) USING ROUND("deductions"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "additions" TYPE DECIMAL(18,2) USING ROUND("additions"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "netPay" TYPE DECIMAL(18,2) USING ROUND("netPay"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "grossPay" TYPE DECIMAL(18,2) USING ROUND("grossPay"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "payeAmount" TYPE DECIMAL(18,2) USING ROUND("payeAmount"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "totalNpsAmount" TYPE DECIMAL(18,2) USING ROUND("totalNpsAmount"::numeric, 2);
ALTER TABLE "Payroll" ALTER COLUMN "gratuityAccruedAmount" TYPE DECIMAL(18,2) USING ROUND("gratuityAccruedAmount"::numeric, 2);
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "payrollRunId" TEXT;

-- Benefit / EmployeeBenefit / Deduction
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "isTaxable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "isPensionable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "Benefit" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);
ALTER TABLE "Benefit" ALTER COLUMN "defaultAmount" TYPE DECIMAL(18,2) USING ROUND(COALESCE("defaultAmount",0)::numeric, 2);
ALTER TABLE "Benefit" ALTER COLUMN "defaultPercentage" TYPE DECIMAL(8,4) USING ROUND(COALESCE("defaultPercentage",0)::numeric, 4);

ALTER TABLE "EmployeeBenefit" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "EmployeeBenefit" ADD COLUMN IF NOT EXISTS "effectiveFrom" TIMESTAMP(3);
ALTER TABLE "EmployeeBenefit" ADD COLUMN IF NOT EXISTS "effectiveTo" TIMESTAMP(3);
ALTER TABLE "EmployeeBenefit" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
CREATE INDEX IF NOT EXISTS "EmployeeBenefit_tenantId_idx" ON "EmployeeBenefit"("tenantId");

ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 100;
ALTER TABLE "Deduction" ADD COLUMN IF NOT EXISTS "isPreTax" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deduction" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "Deduction" ALTER COLUMN "percentage" TYPE DECIMAL(8,4) USING ROUND("percentage"::numeric, 4);

-- Gratuity / Advances Decimal
ALTER TABLE "GratuityAccount" ALTER COLUMN "accrualRate" TYPE DECIMAL(8,4) USING ROUND("accrualRate"::numeric, 4);
ALTER TABLE "GratuityAccount" ALTER COLUMN "totalAccrued" TYPE DECIMAL(18,2) USING ROUND("totalAccrued"::numeric, 2);
ALTER TABLE "GratuityAccount" ALTER COLUMN "totalPaid" TYPE DECIMAL(18,2) USING ROUND("totalPaid"::numeric, 2);
ALTER TABLE "GratuityAccount" ALTER COLUMN "outstandingAmount" TYPE DECIMAL(18,2) USING ROUND("outstandingAmount"::numeric, 2);

ALTER TABLE "GratuityPayment" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "GratuityPayment" ADD COLUMN IF NOT EXISTS "journalId" TEXT;
ALTER TABLE "GratuityPayment" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
CREATE INDEX IF NOT EXISTS "GratuityPayment_tenantId_idx" ON "GratuityPayment"("tenantId");

ALTER TABLE "SalaryAdvance" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
ALTER TABLE "SalaryAdvance" ALTER COLUMN "monthlyDeduction" TYPE DECIMAL(18,2) USING ROUND("monthlyDeduction"::numeric, 2);
ALTER TABLE "SalaryAdvance" ALTER COLUMN "totalDeducted" TYPE DECIMAL(18,2) USING ROUND("totalDeducted"::numeric, 2);
ALTER TABLE "SalaryAdvance" ALTER COLUMN "outstandingAmount" TYPE DECIMAL(18,2) USING ROUND("outstandingAmount"::numeric, 2);

ALTER TABLE "AdvanceDeduction" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;
ALTER TABLE "AdvanceDeduction" ADD COLUMN IF NOT EXISTS "payrollRunId" TEXT;
ALTER TABLE "AdvanceDeduction" ADD COLUMN IF NOT EXISTS "installmentNo" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "AdvanceDeduction" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING ROUND("amount"::numeric, 2);
CREATE INDEX IF NOT EXISTS "AdvanceDeduction_tenantId_idx" ON "AdvanceDeduction"("tenantId");
CREATE INDEX IF NOT EXISTS "AdvanceDeduction_payrollRunId_idx" ON "AdvanceDeduction"("payrollRunId");
CREATE UNIQUE INDEX IF NOT EXISTS "AdvanceDeduction_salaryAdvanceId_payrollRunId_installmentNo_key"
  ON "AdvanceDeduction"("salaryAdvanceId", "payrollRunId", "installmentNo");

-- Attendance approval + minutes
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "minutesWorked" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeMinutes" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "approvalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeApprovalStatus" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeApprovedAt" TIMESTAMP(3);
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "overtimeApprovedById" TEXT;
ALTER TABLE "AttendanceRecord" ADD COLUMN IF NOT EXISTS "payrollLocked" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS "AttendanceRecord_tenantId_approvalStatus_idx" ON "AttendanceRecord"("tenantId", "approvalStatus");

-- Backfill minutes from hours
UPDATE "AttendanceRecord"
SET "minutesWorked" = ROUND(COALESCE("hoursWorked", 0) * 60)::int,
    "overtimeMinutes" = ROUND(COALESCE("overtimeHours", 0) * 60)::int
WHERE "minutesWorked" = 0;

-- Employee deduction assignments
CREATE TABLE IF NOT EXISTS "EmployeeDeductionAssignment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "deductionId" TEXT NOT NULL,
    "amountOverride" DECIMAL(18,2),
    "percentOverride" DECIMAL(8,4),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeeDeductionAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeeDeductionAssignment_tenantId_employeeId_deductionId_effectiveFrom_key"
  ON "EmployeeDeductionAssignment"("tenantId", "employeeId", "deductionId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "EmployeeDeductionAssignment_tenantId_idx" ON "EmployeeDeductionAssignment"("tenantId");
CREATE INDEX IF NOT EXISTS "EmployeeDeductionAssignment_employeeId_idx" ON "EmployeeDeductionAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDeductionAssignment_deductionId_idx" ON "EmployeeDeductionAssignment"("deductionId");

-- Leave accrual ledger
CREATE TABLE IF NOT EXISTS "LeaveAccrualLedger" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leavePolicyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "daysAccrued" DECIMAL(8,2) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LeaveAccrualLedger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveAccrualLedger_tenantId_idempotencyKey_key"
  ON "LeaveAccrualLedger"("tenantId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "LeaveAccrualLedger_tenantId_employeeId_leavePolicyId_year_month_idx"
  ON "LeaveAccrualLedger"("tenantId", "employeeId", "leavePolicyId", "year", "month");

CREATE TABLE IF NOT EXISTS "OvertimeRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "overtimeMinutes" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "attendanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OvertimeRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "OvertimeRequest_tenantId_idx" ON "OvertimeRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "OvertimeRequest_employeeId_idx" ON "OvertimeRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "OvertimeRequest_status_idx" ON "OvertimeRequest"("status");
CREATE INDEX IF NOT EXISTS "OvertimeRequest_workDate_idx" ON "OvertimeRequest"("workDate");

CREATE TABLE IF NOT EXISTS "DisciplinaryCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_tenantId_idx" ON "DisciplinaryCase"("tenantId");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_employeeId_idx" ON "DisciplinaryCase"("employeeId");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_status_idx" ON "DisciplinaryCase"("status");

CREATE TABLE IF NOT EXISTS "DisciplinaryPenalty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "disciplinaryCaseId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectivePeriodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DisciplinaryPenalty_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DisciplinaryPenalty_tenantId_idx" ON "DisciplinaryPenalty"("tenantId");
CREATE INDEX IF NOT EXISTS "DisciplinaryPenalty_disciplinaryCaseId_idx" ON "DisciplinaryPenalty"("disciplinaryCaseId");
CREATE INDEX IF NOT EXISTS "DisciplinaryPenalty_status_idx" ON "DisciplinaryPenalty"("status");
CREATE INDEX IF NOT EXISTS "DisciplinaryPenalty_effectivePeriodEnd_idx" ON "DisciplinaryPenalty"("effectivePeriodEnd");

CREATE TABLE IF NOT EXISTS "PensionRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'NPS',
    "employeeRatePercent" DECIMAL(8,4) NOT NULL,
    "employerRatePercent" DECIMAL(8,4) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PensionRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PensionRule_tenantId_idx" ON "PensionRule"("tenantId");
CREATE INDEX IF NOT EXISTS "PensionRule_tenantId_isActive_effectiveFrom_idx"
  ON "PensionRule"("tenantId", "isActive", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "PensionRemittance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "journalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PensionRemittance_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PensionRemittance_tenantId_idx" ON "PensionRemittance"("tenantId");
CREATE INDEX IF NOT EXISTS "PensionRemittance_status_idx" ON "PensionRemittance"("status");

CREATE TABLE IF NOT EXISTS "PayrollComponentDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "calcMethod" TEXT NOT NULL DEFAULT 'FIXED',
    "isTaxable" BOOLEAN NOT NULL DEFAULT false,
    "isPensionable" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollComponentDefinition_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollComponentDefinition_tenantId_code_key"
  ON "PayrollComponentDefinition"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "PayrollComponentDefinition_tenantId_idx" ON "PayrollComponentDefinition"("tenantId");

CREATE TABLE IF NOT EXISTS "PayrollFormulaTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "expression" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollFormulaTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollFormulaTemplate_tenantId_code_version_key"
  ON "PayrollFormulaTemplate"("tenantId", "code", "version");
CREATE INDEX IF NOT EXISTS "PayrollFormulaTemplate_tenantId_idx" ON "PayrollFormulaTemplate"("tenantId");

CREATE TABLE IF NOT EXISTS "PayrollRun" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runNumber" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL DEFAULT 'MWK',
    "inputSnapshot" JSONB,
    "mappingSnapshot" JSONB,
    "totals" JSONB,
    "checksum" TEXT,
    "exceptions" JSONB,
    "recognitionJournalId" TEXT,
    "paymentBatchId" TEXT,
    "replacedRunId" TEXT,
    "reversedRunId" TEXT,
    "calculatedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRun_tenantId_periodStart_periodEnd_version_key"
  ON "PayrollRun"("tenantId", "periodStart", "periodEnd", "version");
CREATE INDEX IF NOT EXISTS "PayrollRun_tenantId_idx" ON "PayrollRun"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollRun_status_idx" ON "PayrollRun"("status");
CREATE INDEX IF NOT EXISTS "PayrollRun_periodEnd_idx" ON "PayrollRun"("periodEnd");

CREATE TABLE IF NOT EXISTS "PayrollRunEmployee" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "contractId" TEXT,
    "included" BOOLEAN NOT NULL DEFAULT true,
    "exclusionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollRunEmployee_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PayrollRunEmployee_payrollRunId_employeeId_key"
  ON "PayrollRunEmployee"("payrollRunId", "employeeId");
CREATE INDEX IF NOT EXISTS "PayrollRunEmployee_employeeId_idx" ON "PayrollRunEmployee"("employeeId");

CREATE TABLE IF NOT EXISTS "EmployeePayrollResult" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "grossPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "taxablePay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "payeAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "npsEmployee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "npsEmployer" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceRecovery" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "explanation" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmployeePayrollResult_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "EmployeePayrollResult_payrollRunId_employeeId_key"
  ON "EmployeePayrollResult"("payrollRunId", "employeeId");
CREATE INDEX IF NOT EXISTS "EmployeePayrollResult_tenantId_idx" ON "EmployeePayrollResult"("tenantId");
CREATE INDEX IF NOT EXISTS "EmployeePayrollResult_employeeId_idx" ON "EmployeePayrollResult"("employeeId");

CREATE TABLE IF NOT EXISTS "PayrollResultComponent" (
    "id" TEXT NOT NULL,
    "resultId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "isCredit" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 100,
    "meta" JSONB,
    CONSTRAINT "PayrollResultComponent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayrollResultComponent_resultId_idx" ON "PayrollResultComponent"("resultId");
CREATE INDEX IF NOT EXISTS "PayrollResultComponent_code_idx" ON "PayrollResultComponent"("code");

CREATE TABLE IF NOT EXISTS "PayrollPaymentBatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "paymentAccountId" TEXT,
    "journalId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPaymentBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PayrollPaymentBatch_tenantId_idx" ON "PayrollPaymentBatch"("tenantId");
CREATE INDEX IF NOT EXISTS "PayrollPaymentBatch_payrollRunId_idx" ON "PayrollPaymentBatch"("payrollRunId");
CREATE INDEX IF NOT EXISTS "PayrollPaymentBatch_status_idx" ON "PayrollPaymentBatch"("status");

CREATE TABLE IF NOT EXISTS "PensionContribution" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "employeeAmount" DECIMAL(18,2) NOT NULL,
    "employerAmount" DECIMAL(18,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "remittanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PensionContribution_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PensionContribution_tenantId_employeeId_payrollRunId_key"
  ON "PensionContribution"("tenantId", "employeeId", "payrollRunId");
CREATE INDEX IF NOT EXISTS "PensionContribution_tenantId_idx" ON "PensionContribution"("tenantId");
CREATE INDEX IF NOT EXISTS "PensionContribution_periodEnd_idx" ON "PensionContribution"("periodEnd");
CREATE INDEX IF NOT EXISTS "PensionContribution_remittanceId_idx" ON "PensionContribution"("remittanceId");

CREATE TABLE IF NOT EXISTS "GratuityProvisionEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gratuityAccountId" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "amount" DECIMAL(18,2) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "journalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GratuityProvisionEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GratuityProvisionEntry_tenantId_idx" ON "GratuityProvisionEntry"("tenantId");
CREATE INDEX IF NOT EXISTS "GratuityProvisionEntry_gratuityAccountId_idx" ON "GratuityProvisionEntry"("gratuityAccountId");
CREATE INDEX IF NOT EXISTS "GratuityProvisionEntry_payrollRunId_idx" ON "GratuityProvisionEntry"("payrollRunId");

-- FKs (idempotent-ish: ignore if already exist via DO blocks)
DO $$ BEGIN
  ALTER TABLE "EmployeeDeductionAssignment" ADD CONSTRAINT "EmployeeDeductionAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EmployeeDeductionAssignment" ADD CONSTRAINT "EmployeeDeductionAssignment_deductionId_fkey"
    FOREIGN KEY ("deductionId") REFERENCES "Deduction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveAccrualLedger" ADD CONSTRAINT "LeaveAccrualLedger_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "LeaveAccrualLedger" ADD CONSTRAINT "LeaveAccrualLedger_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "OvertimeRequest" ADD CONSTRAINT "OvertimeRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DisciplinaryCase" ADD CONSTRAINT "DisciplinaryCase_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DisciplinaryPenalty" ADD CONSTRAINT "DisciplinaryPenalty_disciplinaryCaseId_fkey"
    FOREIGN KEY ("disciplinaryCaseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionRule" ADD CONSTRAINT "PensionRule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionRemittance" ADD CONSTRAINT "PensionRemittance_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollComponentDefinition" ADD CONSTRAINT "PayrollComponentDefinition_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollFormulaTemplate" ADD CONSTRAINT "PayrollFormulaTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollRunEmployee" ADD CONSTRAINT "PayrollRunEmployee_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "EmployeePayrollResult" ADD CONSTRAINT "EmployeePayrollResult_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollResultComponent" ADD CONSTRAINT "PayrollResultComponent_resultId_fkey"
    FOREIGN KEY ("resultId") REFERENCES "EmployeePayrollResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollPaymentBatch" ADD CONSTRAINT "PayrollPaymentBatch_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PayrollPaymentBatch" ADD CONSTRAINT "PayrollPaymentBatch_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionContribution" ADD CONSTRAINT "PensionContribution_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionContribution" ADD CONSTRAINT "PensionContribution_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionContribution" ADD CONSTRAINT "PensionContribution_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "PensionContribution" ADD CONSTRAINT "PensionContribution_remittanceId_fkey"
    FOREIGN KEY ("remittanceId") REFERENCES "PensionRemittance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "GratuityProvisionEntry" ADD CONSTRAINT "GratuityProvisionEntry_gratuityAccountId_fkey"
    FOREIGN KEY ("gratuityAccountId") REFERENCES "GratuityAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_payrollRunId_fkey"
    FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "Payroll_payrollRunId_idx" ON "Payroll"("payrollRunId");
CREATE INDEX IF NOT EXISTS "Benefit_tenantId_code_idx" ON "Benefit"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "Deduction_tenantId_code_idx" ON "Deduction"("tenantId", "code");
