# Supplier Payment Audit

## Classification: `EXTEND` / `INCOMPLETE` (idempotency & advances)

### Model

- Allocations table links payment → bills.
- Reversal fields present on payment (`isReversal`, `reversedTransactionId`, …) — better than bill/GR.
- `paymentNumber` globally unique.
- Amounts often Float.

### Accounting

Payment adapter / templates: **Dr AP / Cr cash-bank** — correct settlement pattern (`REUSE` direction).  
Must verify no expense/inventory debit on payment path (regression tests Scenario 4).

### Gaps

| Gap | Classification |
|-----|----------------|
| Weak/missing idempotencyKey on create + callbacks | `DUPLICATE_POSTING_RISK` |
| Unallocated / supplier advance first-class | `INCOMPLETE` |
| WHT / FX difference on allocation | `INCOMPLETE` |
| Approval state machine | `INCOMPLETE` |
| Funds check (payment account balance) | Partially elsewhere in app; verify purchases payments page |
| Allocation uniqueness (paymentId, billId) | Missing DB unique |

### Disposition

Harden posting idempotency and allocation constraints before UI polish; keep settlement accounting pattern.
