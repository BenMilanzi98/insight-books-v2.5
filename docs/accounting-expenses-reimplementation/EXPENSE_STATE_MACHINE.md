# Design Stub — Expense State Machine

**Date:** 2026-07-25  
**Current:** Free-form `Expense.status` and `paymentStatus` strings  
**Tag:** `EXTEND` / `REFACTOR` (GAP-009)

## Target enums

### `ExpenseStatus`

| Value | Meaning | GL |
|-------|---------|-----|
| `DRAFT` | Editable | None |
| `SUBMITTED` | Awaiting approval | None |
| `APPROVED` | Approved; posting attempted/succeeded | `EXPENSE_POSTED` required before leaving |
| `REJECTED` | Rejected | None |
| `REVERSED` | Reversal completed | Reverse journals |
| `VOID` | Cancelled without post | None |

### `ExpensePaymentStatus`

| Value | Meaning |
|-------|---------|
| `UNPAID` | Nothing paid (`paidAmount = 0`) |
| `PARTIALLY_PAID` | `0 < paidAmount < amount` |
| `PAID` | `paidAmount >= amount` |
| `REFUNDED` | Settlement reversed / refunded |

Replace defaults like `"Fully paid"` / `"Pending"` with the enum above (migrate existing strings).

## Transitions

```
DRAFT → SUBMITTED → APPROVED → REVERSED
DRAFT → VOID
SUBMITTED → REJECTED → DRAFT (re-edit)
APPROVED → (paymentStatus UNPAID → PARTIALLY_PAID → PAID)
```

### Guards

| Transition | Guard |
|------------|-------|
| → `APPROVED` | `expenseAccountId` or ≥1 line; period open; preview balanced |
| → `APPROVED` | `postExpenseAccounting` success or already idempotent |
| Payment create | Status ∈ {`APPROVED`}; remaining balance > 0 |
| → `REVERSED` | Permission; period allows; reverse source journals |

## Payment vs recognition

Recognition GL is tied to `APPROVED`, not to `PAID`.  
Cash-basis tenants that approve as paid still post recognition once; subsequent payment rows must not re-debit expense (GAP-008).

## API

Reject unknown status strings with `400` after migration cutover flag.
