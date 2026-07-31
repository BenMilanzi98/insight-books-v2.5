# Database Model Audit

Source: `prisma/schema.prisma` (HR/Payroll region ~1771–2908 + `TenantSettings` payroll fields).  
Audited: 2026-07-25

## Cross-cutting findings

| Issue | Evidence | Classification |
|-------|----------|----------------|
| Money as `Float` | All salary/pay/advance/gratuity/benefit amounts | `INCORRECT_CALCULATION` / migrate |
| No `branchId` on HR models | Employee, Payroll, Attendance, Leave, Advances | `INCOMPLETE` |
| No employment contract models | — | `INCOMPLETE` |
| No PayrollRun / lines / snapshot | Only `Payroll` aggregate | `REIMPLEMENT` |
| No journal FK on Payroll | Posting via sourceType/sourceId only | `EXTEND` |
| No Shift / Timesheet models | — | `INCOMPLETE` |
| No Pension contribution ledger | Rates on TenantSettings; total on Payroll | `INCOMPLETE` |
| Global uniqueness hazards | `Employee.employeeId @unique`, `Department.name @unique` | `CROSS_TENANT_RISK` |
| Child rows without tenantId | `EmployeeBenefit`, `GratuityPayment`, `AdvanceDeduction` | `CROSS_TENANT_RISK` / `EXTEND` |

## Model inventory

### Employee (1771–1825)

| Field group | Present | Gap |
|-------------|---------|-----|
| Identity | name, email, employeeId?, idNumber? | No structured first/middle/last; photo via uploads |
| Contact | phone, address, contactDetails Json, emergencyContact Json | Next of kin unstructured |
| Employment | startDate, status, isActive, employmentType, departmentId + department string, position, jobTitle, workLocation, suspend/terminate fields | No branch, grade, cost centre, contract version |
| Compensation | salary, grossSalary, hourlyRate Float; selectedDeductions Json | No effective-dated compensation; pay basis not explicit enum |
| Relations | attendance, benefits, leave, payrolls, performance*, advances, gratuity | No contracts |

**Disposition:** `EXTEND` master; compensation → `REIMPLEMENT` via contracts.

### Department (1827–1838)

- `name @unique` is **global**, not `@@unique([tenantId, name])`.  
**Disposition:** `REFACTOR` uniqueness; `EXTEND` manager/cost-centre later.

### Payroll (1841–1868)

Per-employee period row: basic/deductions/additions/net/gross/paye/totalNps/gratuityAccrued as **Float**; `status` string default `"Pending"`; notes string for some breakdown; **no** runId, formulaVersion, journalEntryId, checksum, paymentBatchId.

**Disposition:** `LEGACY_READ_ONLY` during migration; target `PayrollRun` + `EmployeePayrollResult` + `PayrollResultComponent` = `REIMPLEMENT`.

### PayrollTaxConfiguration (1871–1889)

Versionable bands (Json), effectiveFrom/To, monthlyTaxFreeAllowance Float.  
**Disposition:** `REUSE` / `EXTEND` (Decimal + NPS/statutory sibling tables).

### TenantSettings payroll fields

- `npsEmployeeRatePercent`, `npsEmployerRatePercent` Float?  
- `payrollAccountMappings` Json  

**Disposition:** `REUSE` mappings shape via `lib/payrollEngine/accountMappings.js`; rates → versioned pension rules `EXTEND`.

### Benefit / EmployeeBenefit / Deduction

| Model | Gaps |
|-------|------|
| Benefit | No taxable/pensionable/cash flags; no effective dates |
| EmployeeBenefit | No tenantId; no start/end; not line-linked to Payroll |
| Deduction | Catalogue only; assignment via Employee.selectedDeductions Json |

**Disposition:** catalogues `EXTEND`; assignment model `REIMPLEMENT`.

### GratuityAccount / GratuityPayment

Accrual Float on account; payments lack tenantId and journal link.  
**Disposition:** `EXTEND` + proper provision posting.

### SalaryAdvance / AdvanceDeduction

Advance has status/repayment fields; `AdvanceDeduction.payrollId` is optional **String** with index but **no Prisma relation** to Payroll.  
**Disposition:** `EXTEND` FK + unique recovery identity; lifecycle states `REIMPLEMENT`.

### AttendanceRecord / AttendanceRegister (2685–2726)

Per-day hours/OT as Float; finalize register exists. No shift, break, approval version, payroll-export lock.  
**Disposition:** `EXTEND` → attendance engine `REIMPLEMENT` for pay integration.

### LeavePolicy / LeaveRequest / LeaveBalance (2728–2806)

Paid flag, accrualRate Float, balances by year. No accrual ledger / idempotency key.  
**Disposition:** `EXTEND`; accrual jobs `REIMPLEMENT`.

### Performance* (2808–2908)

Reviews, criteria, goals, feedback. `PerformanceFeedback.reviewId` optional **without FK**. Not linked to payroll bonuses.  
**Disposition:** `EXTEND` HR; bonus bridge `REIMPLEMENT`.

## Target models (not present)

EmploymentContract, CompensationRevision, WorkSchedule, Shift, Timesheet, OvertimeRequest, DisciplinaryCase, PayrollCalendar, PayrollPeriod, PayrollRun, PayrollInputSnapshot, PayrollComponentDefinition, PayrollFormulaTemplate, EmployeePayrollResult, PayrollResultComponent, PensionContribution, PensionRemittance, GratuityProvisionEntry, PayrollPaymentBatch — all **`INCOMPLETE` / build in Phase 2+**.

## Constraint gaps

| Needed | Current |
|--------|---------|
| Unique (tenantId, employeeNumber) | Global employeeId unique |
| Unique (tenantId, payrollNumber) | N/A |
| Unique employee+period+run | Only soft period indexes |
| Unique advance recovery per instalment | Missing |
| Posted result immutability | Status string mutable via API |
| Decimal(18,2) money | Float |

## Disposition summary

| Area | Classification |
|------|----------------|
| Employee / Department UI data | `EXTEND` |
| Float money columns | `REIMPLEMENT` (migration) |
| Payroll aggregate | `LEGACY_READ_ONLY` → replace |
| Tax config | `REUSE` |
| Advances / gratuity tables | `EXTEND` |
| Attendance / leave | `EXTEND` then engines |
| Contracts / runs / components | `REIMPLEMENT` (new) |
