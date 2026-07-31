# Design Stub — Expense Posting Rules

**Date:** 2026-07-25  
**Recognition adapter:** `lib/accountingV2/adapters/expenseAdapter.js`  
**Payment path (current):** `app/api/expenses/partial-payment/route.js` — **incorrect for non-AP**

## Rule R1 — Recognition on approve

When status → `APPROVED`, call `postExpenseAccounting` once:

| Condition | Debit | Credit |
|-----------|-------|--------|
| Always | Expense leaf(s) for net | — |
| `taxAmount > 0` | VAT input (`VAT_INPUT` → `1240`) | — |
| `supplierId` && payment pending | — | AP (`2110`) |
| Else | — | Cash/bank from payment method / `CASH_ON_HAND` |

Amounts from `normalizeExpenseAmountsForGl`.

**Tag:** `REUSE` / `COMPLETE_AND_VERIFIED` happy path.

## Rule R2 — Payment never re-recognizes expense

On `ExpensePayment`:

| Condition | Debit | Credit |
|-----------|-------|--------|
| AP outstanding (supplier or AP credit exists) | AP | Cash/bank |
| Direct cash already fully recognized | **No GL** or clearing-only if needed | — |
| Partial pay after AP recognition | AP (payment amount) | Cash/bank |

**Forbidden:** Debit `expenseAccountId` on payment when `EXPENSE_POSTED` already exists for that expense.

**Tag today:** `INCORRECT_POSTING` — must become `COMPLETE_AND_VERIFIED`.

## Rule R3 — Idempotency

See [POSTING_IDEMPOTENCY.md](./POSTING_IDEMPOTENCY.md).

## Rule R4 — Headers

Engine rejects posts to `5100`, `1130`, `5000`, `5700` group headers.

## Rule R5 — Reversal

Expense reverse uses V2 reverse APIs; do not insert compensating manual journals that bypass registry.

## Rule R6 — Multi-line

One expense debit line per `ExpenseLine`; shared tax policy documented in adapter (header tax split or per-line tax).
