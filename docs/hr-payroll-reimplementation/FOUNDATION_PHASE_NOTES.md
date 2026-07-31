# Foundation Phase Notes (2026-07-25)

Implementation started after audit approval (programme Phase 1 Foundation + Phase 2 Contracts kickoff).

## Delivered in this slice

| Item | Status |
|------|--------|
| Controlled payroll status transitions (`lib/payrollStatus.js`) | Done |
| Rewrite `PATCH /api/payroll/[id]/status` (tenant + permission + commands) | Done |
| Tenant-scope `details` / `payslip` GET | Done |
| `lib/money` in `calculatePayroll` / NPS / custom deductions | Done |
| `postSalaryAdvanceAccounting` + `SALARY_ADVANCE_DISBURSED` event | Done |
| Salary advances route uses advance adapter (not PAYROLL_POSTED) | Done |
| `EmploymentContract` model + migration | Done |
| Contracts API `GET/POST /api/employees/[id]/contracts` | Done |
| Tenant-scoped unique `(tenantId, employeeId)` / `(tenantId, department.name)` | Migration |
| Unit tests: `test/payrollStatus.test.js`, `test/employmentContract.test.js`, `test/resolveEmployeeCompensation.test.js` | Done |
| `resolveEmployeeCompensation` wired into calculate + enhanced payroll | Done |
| Employee UI: `EmploymentContractsPanel` on `/hr/employees` detail | Done |
| Tenant-scope static guards (`test/payrollStatusTenantScope.test.js`) | Done |

## Not yet in this slice

- Full Decimal migration of legacy Employee/Payroll Float columns (calc path uses money; DB Float remains until expand/contract migration)
- PayrollRun / input snapshot / formula engine
- HTTP integration IDOR test with seeded multi-tenant DB
- Leave/attendance engines

## Deploy steps

```bash
npx prisma migrate deploy
npx prisma generate   # stop npm run dev first on Windows if EPERM
```

## Cutover note

Payroll recognition continues via `postPayrollAccounting` / `PAYROLL_POSTED`.  
Advance disbursement must use `postSalaryAdvanceAccounting` / `SALARY_ADVANCE_DISBURSED` only.
