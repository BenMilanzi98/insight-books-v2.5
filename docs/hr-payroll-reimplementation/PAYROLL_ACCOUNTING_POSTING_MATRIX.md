# Payroll Accounting Posting Matrix (Target)

This is the **target** matrix for Phase 2+. Current system approximates recognition in `enhanced` + mappings JSON; payment/remittance separation is incomplete.

## 1. Payroll recognition (on APPROVED → POSTED)

**Trigger:** `postPayrollRun()`  
**Idempotency:** `tenantId + payrollRunId + version + PAYROLL_RECOGNITION`  
**State required:** APPROVED, not yet POSTED, accounting period open

| Component type | Debit | Credit |
|----------------|-------|--------|
| Basic / hourly / OT / bonus / taxable allowance | Salary / Wages / OT / Bonus Expense (mapped IDs) | — |
| Employer pension | Employer Pension Expense | Employer Pension Payable |
| Employer benefits (cash) | Benefit Expense | Liability or Net as configured |
| Gratuity accrual | Gratuity Expense | Gratuity Provision/Payable |
| Net pay | — | Salaries Payable |
| PAYE | — | PAYE Payable |
| Employee pension | — | Employee Pension Payable |
| Other post-tax deductions | — | Deduction Payables |
| Advance recovery | Salaries Payable (reduce net) / or net composition | Employee Advances Receivable |
| Loan recovery | (same pattern) | Employee Loans Receivable |

**Rules:** Advance/loan recovery is **not** expense. Misconduct penalties follow configured policy (not arbitrary income). Journal must balance. Draft/calculated runs: **no journal**.

## 2. Payroll payment

**Trigger:** `recordPayrollPayment()` / payment batch  
**Idempotency:** `tenantId + paymentBatchId + version + PAYROLL_PAYMENT`

| Debit | Credit |
|-------|--------|
| Salaries Payable | Cash / Bank |

**Must not** re-debit salary expense.

## 3. PAYE remittance

**Idempotency:** `… + STATUTORY_REMITTANCE`

| Debit | Credit |
|-------|--------|
| PAYE Payable | Cash / Bank |

## 4. Pension remittance

**Idempotency:** `… + PENSION_REMITTANCE`

| Debit | Credit |
|-------|--------|
| Employee Pension Payable | |
| Employer Pension Payable | Cash / Bank |

## 5. Salary advance disbursement

**Idempotency:** `… + ADVANCE_DISBURSEMENT`

| Debit | Credit |
|-------|--------|
| Employee Advances Receivable | Cash / Bank |

**Not** salary expense. Use dedicated event type (not `PAYROLL_POSTED`).

## 6. Advance recovery (if separate from consolidated payroll journal)

**Idempotency:** `tenantId + payrollRunId + employeeId + advanceId + period + ADVANCE_RECOVERY`

Must be unique; payroll reverse restores balance.

## 7. Gratuity settlement

| Step | Debit | Credit |
|------|-------|--------|
| Accrual | Gratuity Expense | Gratuity Payable |
| Payment | Gratuity Payable | Cash / Bank |

## 8. Reversal

Linked opposite journal; original immutable; new identity `… + REVERSAL`. Replacement run references reversed run.

## 9. Non-posting operations

Payslip generate/email/export, attendance approval, performance finalize, report generation — **no journals**.

## Mapping requirements

- All accounts by **ID** from CoA, validated type/subtype/tenant.  
- Store mapping version on PayrollRun snapshot.  
- Mapping changes do not rewrite historical journals.

## Current → target delta

| Current | Target |
|---------|--------|
| Per-employee Payroll sourceId | PayrollRun (+ optional employee sub-events) |
| paymentDate as recognition date | Separate recognition vs pay dates |
| advance via postPayrollAccounting | ADVANCE_DISBURSEMENT event |
| Json mappings | Versioned mapping set on snapshot |
