# Salary Advances Audit

Routes: `/hr/advances` · APIs: `/api/salary-advances/**`, deductions · Models: SalaryAdvance, AdvanceDeduction · GL: `lib/salaryAdvanceGlAccount.js`

## Findings

### Strengths

- Application fields: amount, repaymentMonths, monthlyDeduction, outstanding, status.  
- Deduction history table.  
- Receivable CoA helper + tests (`test/salaryAdvanceGlAccount.test.js`).  
- Reversal path restores advance side effects (`reversePayrollSideEffects`).

### Gaps

| Gap | Classification |
|-----|----------------|
| `AdvanceDeduction.payrollId` String without FK | `DUPLICATE_POSTING_RISK` / `EXTEND` |
| No unique (advanceId, payrollId, instalment) | `DUPLICATE_POSTING_RISK` |
| Full approval state machine thin (default Active) | `INCOMPLETE` |
| Create path calls `postPayrollAccounting` | Confusing event type — `REFACTOR` / risk `INCORRECT_ACCOUNTING` |
| Disbursement vs recovery accounting not clearly separated in all paths | `INCOMPLETE` |
| Over-recovery guard | Needs verification / tests | `INCOMPLETE` |
| Write-off / early settlement workflows | Incomplete | `INCOMPLETE` |
| Float money | `INCORRECT_CALCULATION` |

### Disposition

| Piece | Classification |
|-------|----------------|
| UI + CRUD | `EXTEND` |
| Receivable account helper | `REUSE` |
| Recovery identity + posting | `REIMPLEMENT` |
| Lifecycle states | `REIMPLEMENT` |
