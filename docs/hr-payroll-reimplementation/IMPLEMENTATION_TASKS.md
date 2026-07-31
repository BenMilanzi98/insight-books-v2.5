# Implementation Tasks — HR & Payroll

Executable checklist derived from [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md).  
Check boxes only when evidence exists (PR / test / doc).

## Phase 0 — Audit (done)

- [x] Route inventory  
- [x] Database model audit  
- [x] Domain audits  
- [x] Calc + accounting path trace  
- [x] Risk registers  
- [x] Test coverage audit  
- [x] Final gap register  
- [x] Posting matrix (target)  
- [x] Reimplementation plan  

## Phase 1 — Foundation

- [x] Remove or rewrite `PATCH /api/payroll/[id]/status`  
- [x] Tenant-scope payroll details/payslip/status mutations (`id` + `tenantId`)  
- [x] Cross-tenant IDOR guard (status/details/payslip tenant scope + static regression tests)  
- [ ] HTTP multi-tenant IDOR integration test (seeded DB) — deferred to CI  
- [x] Decimal migration of legacy Employee/Payroll Float columns (`20260725070000_hr_payroll_v2_full`)  
- [x] Adopt `lib/money` in `calculatePayroll` NPS/custom/net  
- [x] Split advance event type (`SALARY_ADVANCE_DISBURSED` + adapter + template)  

## Phase 2 — Contracts

- [x] Schema: EmploymentContract (+ indexes)  
- [x] API: create (+ activate/supersede) / list contracts  
- [x] UI: contract history on employee (`EmploymentContractsPanel`)  
- [x] Payroll preview/process resolves contract by period (`resolveEmployeeCompensation` on calculate + enhanced)  
- [x] Fix `Employee.employeeId` uniqueness to tenant scope (migration)  
- [x] Fix `Department.name` uniqueness to tenant scope (migration)  

## Phase 3 — Leave & attendance

- [x] Consolidate leave accrual via idempotent ledger API `POST /api/leave/accrue`  
- [x] Accrual idempotency key + ledger (`LeaveAccrualLedger`)  
- [x] Attendance approval states + `POST /api/attendance/[id]/approve` + bulk  
- [x] OT approved records (`OvertimeRequest` + attendance OT approval)  
- [x] Block unapproved time in payroll snapshot (V2); enhanced prefers APPROVED  
- [x] Minute-based duration storage (`minutesWorked` / `overtimeMinutes`)  

## Phase 4 — Catalogues & discipline

- [x] Benefit taxable/pensionable/effective fields  
- [x] EmployeeBenefit.tenantId  
- [x] Deduction assignment model (`EmployeeDeductionAssignment`)  
- [x] Disciplinary case + approved penalty → payroll input  

## Phase 5 — Pension / gratuity / advances

- [x] Versioned NPS rule table (`PensionRule` + `/api/pension/rules`)  
- [x] Contribution + remittance identities  
- [x] AdvanceDeduction FK fields + unique recovery `(salaryAdvanceId, payrollRunId, installmentNo)`  
- [x] ADVANCE_DISBURSEMENT posting path (`SALARY_ADVANCE_DISBURSED`)  
- [x] Gratuity provision entries model (`GratuityProvisionEntry`)  

## Phase 6 — Rules engine

- [x] Component definitions model  
- [x] Formula template + validation (no eval) — `lib/payrollV2/formula.js`  
- [x] Calculation order module  
- [x] Input snapshot  
- [x] EmployeePayrollResult + components  
- [x] Explanation persistence  
- [x] Deduction priority + min net pay  
- [x] Unit tests: monthly, OT, advance/min-net, formula, state machine  

## Phase 7 — Run & review UI

- [x] PayrollRun state machine commands  
- [x] Review workbench on `/hr/payroll-v2`  
- [x] Exceptions list on workbench  
- [x] Block recalculate when POSTED  

## Phase 8 — Accounting & payment

- [x] Recognition idempotency via sourceId `PayrollRun:…:RECOGNITION`  
- [x] Payment batch model + posting (`PAYROLL_PAYMENT_POSTED`)  
- [x] Remittance model (`PensionRemittance`)  
- [x] Reversal command on run  
- [x] journalId linkage on run / batch  
- [ ] Integration tests: TB balanced; no double expense — requires seeded DB  

## Phase 9 — Reports

- [x] Reconciliation centre (`/api/payroll-v2/reconcile` + workbench)  
- [x] Drill-down fields: recognitionJournalId / payment batch journalId  
- [x] Fix PAYE Summary nav (permission-filtered sidebar)  
- [x] False-zero: reconcile flags mismatches instead of silent zero  
- [x] Export permission re-check (existing paye-summary export permissions)  

## Phase 10 — Governance & release

- [x] Fine-grained permissions reuse (`payroll.*` / `hr.view` / `leave.*`)  
- [x] SoD guidance in FINAL_READINESS_DECISION  
- [x] Audit events: existing accounting V2 audit on post  
- [ ] Notifications — deferred (use existing in-app later)  
- [ ] Import Dry Run — deferred (employees import exists; dry-run flag later)  
- [x] Automated unit matrix for V2 engine  
- [ ] Production build gate — run `npm run build` before deploy  
- [x] FINAL_READINESS_DECISION  

## Definition of done (programme)

Critical/High gaps closed or explicitly deferred with owner in FINAL_READINESS_DECISION.  
Deploy: `npx prisma migrate deploy` (Postgres up) + `npx prisma generate` (stop Next on Windows if EPERM).
