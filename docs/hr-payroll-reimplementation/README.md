# HR & Payroll Module Reimplementation

Forensic audit and redesign of InsightBooks V2 HR & Payroll:

**Employee → Contract → Pay Structure → Attendance / Leave / Benefits / Advances / Penalties → Payroll Calculation → Approval → Posting → Payment → Payslips / Statutory Reports / Reconciliation**

## Status (2026-07-25)

| Phase | Status |
|-------|--------|
| Forensic audit (§3 master prompt) | **Complete** |
| Gap register & reimplementation plan | **Complete** |
| Foundation hotfixes | **Complete** |
| EmploymentContract + UI + resolution | **Complete** |
| Decimal money migration | **Complete** (migration `20260725070000_hr_payroll_v2_full`) |
| Leave accrual + attendance approval / OT | **Complete** |
| Catalogues + disciplinary | **Complete** |
| Pension rules / advance unique recovery | **Complete** |
| Payroll V2 rules engine + snapshot + results | **Complete** (`lib/payrollV2`) |
| Run workbench UI | **Complete** (`/hr/payroll-v2`) |
| Recognition / payment posting + reconcile | **Complete** |
| Governance / readiness | **Conditional go** — see FINAL_READINESS_DECISION.md |

## How to use (operators)

1. Start Postgres (Laragon) and run `npx prisma migrate deploy`
2. Stop Next if needed, then `npx prisma generate`
3. Approve attendance for the period (`/api/attendance/approve-bulk` or per-record)
4. Open **HR → Payroll Workbench (V2)**
5. Create run → Load → Calculate → Submit → Approve
6. Save CoA `mappingSnapshot` → Post → Pay
7. Use Reconciliation panel for mismatches

Legacy **Payroll Processing** (`/hr/payroll`) remains during cutover.

## Source-of-truth rules (programme)

1. Chart of Accounts → Canonical posting engine → Journals → GL → Trial Balance → reports  
2. Employment contracts (versioned) are authoritative for pay terms  
3. Approved attendance / leave / OT / benefits / deductions / advances / penalties are authoritative payroll inputs  
4. Versioned payroll calculation rules produce immutable employee results  
5. Draft / unposted runs never affect the GL  
6. Posted runs are never silently edited — corrections use reversal + replacement  
7. Recognition posts once; payment posts once and never re-expenses salary  

## Document index

| Doc | Purpose |
|-----|---------|
| [FINAL_GAP_REGISTER.md](./FINAL_GAP_REGISTER.md) | Prioritised gaps |
| [REIMPLEMENTATION_PLAN.md](./REIMPLEMENTATION_PLAN.md) | Phased plan |
| [IMPLEMENTATION_TASKS.md](./IMPLEMENTATION_TASKS.md) | Executable checklist |
| [PAYROLL_ACCOUNTING_POSTING_MATRIX.md](./PAYROLL_ACCOUNTING_POSTING_MATRIX.md) | Target journals |
| [FOUNDATION_PHASE_NOTES.md](./FOUNDATION_PHASE_NOTES.md) | Early slice notes |
| [FINAL_READINESS_DECISION.md](./FINAL_READINESS_DECISION.md) | Go / no-go |
