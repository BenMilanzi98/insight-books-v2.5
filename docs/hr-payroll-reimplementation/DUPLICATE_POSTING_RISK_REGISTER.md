# Duplicate Posting Risk Register

| ID | Risk | Evidence | Severity | Classification |
|----|------|----------|----------|----------------|
| DP-01 | Retry of enhanced payroll creates second Payroll + second journal | No idempotencyKey / unique (employee, period, run) | Critical | `DUPLICATE_POSTING_RISK` |
| DP-02 | Recognition and payment both debit expense | paymentDate used as process date; no distinct payment batch | Critical | `DUPLICATE_POSTING_RISK` / `INCORRECT_ACCOUNTING` |
| DP-03 | Advance recovery applied twice | AdvanceDeduction.payrollId untyped; no unique constraint | Critical | `DUPLICATE_POSTING_RISK` |
| DP-04 | Salary advance create uses `postPayrollAccounting` | Same adapter as payroll recognition | High | `DUPLICATED` semantics |
| DP-05 | Dual calc paths (calculatePayroll vs Malawi) produce divergent posts | Two libs | High | `DUPLICATED` |
| DP-06 | NPS remittance clear + payroll liability both reduced incorrectly | Clear API separate from remittance identity | High | `DUPLICATE_POSTING_RISK` |
| DP-07 | Gratuity accrual on payroll + manual accrual double-expense | Weak linkage | High | `DUPLICATE_POSTING_RISK` |
| DP-08 | Leave accrual recalculation doubles balance | on-demand calculate without period key | Medium | `DUPLICATE_POSTING_RISK` |
| DP-09 | Attendance OT paid twice if manual OT + timesheet later | No export lock | Medium | `DUPLICATE_POSTING_RISK` |
| DP-10 | Legacy postGlEntry + V2 both fire if cutover misconfigured | legacyPost callback in enhanced | High | `DUPLICATE_POSTING_RISK` |
| DP-11 | Payslip email/resend accidentally posts | Must regression-test | Medium | Watch / `UNSAFE` if found |
| DP-12 | Status PATCH to Paid without journal | `/api/payroll/[id]/status` | Critical | `UNSAFE` |

## Mitigations (Phase 2+)

1. PayrollRun + unique employee result per period.  
2. Stable idempotency identities (see posting matrix).  
3. Separate PAYROLL_RECOGNITION vs PAYROLL_PAYMENT events.  
4. FK + unique on AdvanceDeduction.  
5. Remove arbitrary status mutation; command API only.  
6. Single calculation engine version recorded on result.
