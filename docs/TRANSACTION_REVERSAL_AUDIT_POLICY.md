# Transaction removal, adjustment & audit policy

This codebase treats **financial records as immutable once posted**. Removing or materially changing them must go through **reversal** (equal-and-opposite entries) and **audit logging**, not silent edits or hard deletes.

## Principles

1. **No hard delete of posted money movement** — use reversal services in `lib/transactionReversalService.js` and related helpers.
2. **Mandatory reversal reason** — `validateReversalReason` (min 10 chars, max 1000) for user-initiated removals.
3. **Audit trail** — `prisma.auditLog` entries with structured `details` JSON for removals and material events.

## Implemented flows (reference)

| Area | Behaviour |
|------|-----------|
| **Expense DELETE** | If a posted `Transaction` exists (`sourceType: Expense`, `sourceId: expenseId`), runs `createExpenseReversal` first, then soft-deletes the expense; `auditLog` action `EXPENSE_SOFT_DELETED_AFTER_REVERSAL`. |
| **Expense PUT** | If posted expense journal exists, **blocks** material changes (amount, date, account, tax); cosmetic fields allowed. |
| **Expense batch delete** | Same reversal-then-soft-delete rules per row; `EXPENSE_BATCH_DELETED_AFTER_REVERSAL`. |
| **Payment DELETE** | Requires JSON body `reversalReason` / `reason`. Reverses `InvoicePayment` journal (via `findInvoicePaymentJournalTransactionId`), journals with `sourceId = paymentId`, mirrors `updateAccountBalance`, then `createPaymentReversal`; updates invoice totals; `PAYMENT_REMOVED_VIA_REVERSAL`. |
| **Payment PUT** | If status is completed-like, **blocks** changes to amount, date, method, or status (reverse + re-record instead). |
| **Supplier bill DELETE** | Requires reason; cancels bill and reverses `journalEntryId` when present; supplier balance adjusted. |
| **PO DELETE** | Cancellation + reversals (see `app/api/purchases/orders/[id]/route.js`). |
| **Sales clear history** | Requires `reversalReason` in DELETE body. **Blocked** if any posted `Sale` journal exists or any non-draft sale exists; only draft sales can be bulk-removed. POS UI collects reason. |

## Adding new features

- Prefer **reversal + status** over `delete()` on entities tied to `Transaction`, `Payment`, inventory, or AP/AR.
- Log with a dedicated `auditLog.action` string and include `reversalReason` where applicable.
