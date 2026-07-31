# Payroll Accounting Audit

Adapters: `postPayrollAccounting` · Reversal: `reversePayroll` · Mappings: `lib/payrollEngine/accountMappings.js` · Main path: `app/api/payroll/enhanced/route.js`

## Recognition path (current)

1. Build balanced `transactionLines` (expense, PAYE payable, NPS payable, net payable, advances, etc.).  
2. `assertPeriodOpen`.  
3. `postPayrollAccounting({ payrollId, lines, …, legacyPost: postGlEntry })` via cutover.  
4. Event: `AccountingEventType.PAYROLL_POSTED`, module `PAYROLL`, sourceId = payrollId.

**Strengths:** cutover adapter; balance validation before post; period check; sourceId for engine identity.

**Gaps:**

| Gap | Classification |
|-----|----------------|
| No `journalEntryId` on Payroll row | `EXTEND` |
| Recognition and payment may be conflated (process date = paymentDate) | `INCORRECT_ACCOUNTING` risk |
| Dual V2 + legacyPost | `CONSOLIDATE` under V2-only when cutover complete |
| Salary advance create also uses `postPayrollAccounting` | `DUPLICATED` event semantics |
| Component-level lines not persisted as payroll components | `INCOMPLETE` |
| Mapping changes can affect future only — historical OK if sourceId journals immutable | Verify | `EXTEND` audit |
| Idempotency: retry of enhanced create may create second Payroll row | `DUPLICATE_POSTING_RISK` |
| Arbitrary status PATCH can mark paid without journal | `UNSAFE` |

## Payment path

No first-class PayrollPaymentBatch model. Status transitions via string / process endpoints. Risk that “paid” does not create a distinct liability-settlement journal.

**Classification:** `REIMPLEMENT` payment batch.

## Reversal path

`reversePayroll` creates linked reversal and runs side effects (advance restore, gratuity). Good foundation (`REUSE` / `EXTEND`). Must ensure no silent delete of original journals (service comments claim linked reversal).

## Payslips / reports / email

Routes under payslips and hr-reports — must remain non-posting. Spot-check: generation should not call `postPayrollAccounting`. Treat as `REUSE` with regression tests required.

## Disposition

| Piece | Classification |
|-------|----------------|
| postPayrollAccounting adapter | `REUSE` |
| accountMappings | `EXTEND` |
| enhanced posting orchestration | `REFACTOR` |
| Payment vs recognition | `REIMPLEMENT` |
| Status endpoint | `REIMPLEMENT` (remove arbitrary setStatus) |
| reversePayroll | `EXTEND` |
