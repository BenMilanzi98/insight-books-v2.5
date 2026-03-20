# Transaction removal, adjustment & audit trail

This document summarizes how Insight Books handles **removals and accounting changes** so effects are **reversed in the general ledger** (not silently dropped) and **tracked for auditing**.

## Principles

1. **No silent hard-delete** of posted economic events where a journal exists—use **reversal entries** (equal and opposite) and keep originals.
2. **Mandatory audit context** for removals: callers must supply `reversalReason` or `reason` (**≥ 10 characters**, validated by `validateReversalReason` in `lib/transactionReversalService.js`).
3. **Posted records**: material field changes (amount, date, accounts, tax) are **blocked** on PUT; users must **reverse** and re-enter a corrected transaction.

## Implemented flows (API)

| Area | Endpoint / action | Behaviour |
|------|---------------------|-----------|
| **Expense** | `DELETE /api/expenses/[id]` | If a posted `Transaction` exists (`sourceType: Expense`, `sourceId: expense`), runs `createExpenseReversal` (incl. tax reversals), then **soft-deletes** the expense. `auditLog`: `EXPENSE_SOFT_DELETED_AFTER_REVERSAL`. |
| **Expense** | `PUT /api/expenses/[id]` | If posted journal exists, **blocks** material changes; allows cosmetic edits only. `auditLog`: `EXPENSE_UPDATED`. |
| **Expense** | `POST /api/expenses/batch-delete` | Same reversal-before-soft-delete pattern per expense; requires validated reason. |
| **Payment** | `DELETE /api/payments/[id]` | Requires JSON body with `reversalReason` / `reason`. Reverses **InvoicePayment** journal (matched by amount/day), journals with `sourceId = paymentId`, **payment processing balances** (`updateAccountBalance`), then `createPaymentReversal`. Recalculates invoice `totalPaid` / `remainingBalance` / `status`. `auditLog`: `PAYMENT_REMOVED_VIA_REVERSAL` (+ service logs). |
| **Payment** | `PUT /api/payments/[id]` | **Blocks** amount/date/method/status changes on completed payments; use reversal + new payment. |
| **Purchase order** | `DELETE /api/purchases/orders/[id]` | **Cancellation + reversals** (expenses, bill journals, supplier balance); no hard delete. |
| **Supplier bill** | `DELETE /api/purchases/bills/[id]` | **Cancel** bill, reverse linked journal if `journalEntryId`, supplier balance adjustment; requires reason; blocks if `amountPaid > 0`. |
| **Reversals UI** | `/api/transactions/reverse`, `/transactions/reversals` | Central reversal entry points; ledger + `auditLog` entries. |

## Helper modules

- `lib/transactionReversalService.js` — core reversal creation, eligibility, period locks, `auditLog` on reversals.
- `lib/financialReversalHelpers.js` — locate **invoice payment** journals (`sourceId = invoiceId`) and reverse journals keyed by **payment id**.

## Frontend notes

- **Payment delete** must send a JSON body (e.g. `{ "reversalReason": "…" }`) — empty `DELETE` bodies will fail validation.
- Prefer the **Reversal** actions in the UI where available for consistency.

## Extending

When adding new **delete** or **material update** APIs that touch **posted** `Transaction` rows:

1. Prefer **reversal** (`createTransactionReversal` or domain-specific `create*Reversal`) over hard delete.
2. Write **`auditLog`** with action, entity type, entity id, and JSON `details` (reason, amounts, linked ids).
3. Keep **tenant** and **period** checks consistent with `checkAccountingPeriodLock`.
