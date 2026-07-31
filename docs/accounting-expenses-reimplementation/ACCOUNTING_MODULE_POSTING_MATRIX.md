# Accounting Module Posting Matrix

**Date:** 2026-07-25  
**Rule:** Operational modules must post only through V2 adapters → `executePosting`. Legacy writers = `LEGACY_POSTING_REMOVED`.

## Matrix

| Module | Source types | Adapter / entry | Status | Tags |
|--------|--------------|-----------------|--------|------|
| Expenses (recognition) | `Expense` / `EXPENSE_POSTED` | `lib/accountingV2/adapters/expenseAdapter.js` → `postExpenseAccounting` | Wired | `REUSE`, `EXTEND` |
| Expenses (payment) | `ExpensePayment` | `app/api/expenses/partial-payment` → `postTaxSettlementAccounting` | Wired **incorrectly** for non-AP | `INCORRECT_POSTING`, `DUPLICATE_POSTING_RISK` |
| POS sale | Sale / POS | `adapters/posSaleAdapter.js` | Wired | `REUSE` |
| Invoice | Invoice | `adapters/invoiceAdapter.js` | Wired | `REUSE` |
| Customer payment | Payment / AR | `adapters/customerPaymentAdapter.js` | Wired | `REUSE` |
| Customer refund | Refund | `adapters/customerRefundAdapter.js` | Wired | `REUSE` |
| Credit note | CreditNote | `adapters/creditNoteAdapter.js` | Wired | `REUSE` |
| Supplier bill | Bill | `adapters/supplierBillAdapter.js` | Wired | `REUSE` |
| Supplier payment | SupplierPayment | `adapters/supplierPaymentAdapter.js` | Wired | `REUSE` |
| Goods received | GRN | `adapters/goodsReceivedAdapter.js` | Wired | `REUSE` |
| Cost of sales | COGS event | `adapters/costOfSalesAdapter.js` | Wired | `REUSE` (watch header `5100`) |
| Stock adjustment | StockAdj | `adapters/stockAdjustmentAdapter.js` | Wired | `REUSE` / needs `5290` leaf |
| Banking / bank rec adjust | Bank | `adapters/bankingAdapter.js` | Wired | `REUSE` |
| Opening balances | OB batch | `application/openingBalanceService.js` → `executePosting` | Wired | `REUSE` |
| Manual journals | Manual | `application/manualJournalService.js` | Wired | `REUSE` |
| Assets / depreciation | Asset events | asset routes + remaining adapters | Wired (verify per route) | `EXTEND` audit if gaps |
| Payroll / salaries | Payroll | purpose `SALARIES_AND_WAGES` → adapters | Wired via payroll integration | `REUSE` |
| Tax settlement (generic) | TaxSettlement | `remainingAdapters.postTaxSettlementAccounting` | Wired; **overused** by expense payment | `REFACTOR` |
| Direct `/api/payments` GL | — | Fail-closed message to use V2 adapters | Blocked | `LEGACY_POSTING_REMOVED` |

## Expense lifecycle × expected GL

| Operational step | Expected posting | Actual (2026-07-25) |
|------------------|------------------|---------------------|
| Create draft | None | None |
| Approve / post recognition | Dr Expense (+ VAT in); Cr Cash or AP | `postExpenseAccounting` — OK |
| Partial/full pay (supplier / AP) | Dr AP; Cr Bank | partial-payment AP branch — OK shape |
| Partial/full pay (already expensed cash/partial) | Dr AP or clearing only; **never** re-debit expense | **Re-debits expense** — FAIL |
| Reverse | Reverse source journals via V2 reversal | Prefer `reverseSourceJournals` |

## Cutover modes

`submitViaCutover` supports NEW_ENGINE / SHADOW / LEGACY policy flags (`lib/accountingV2/infrastructure/featureFlags.js`). Fresh-books intent: NEW_ENGINE authoritative; legacy write path removed.

## Gaps tied to this matrix

- GAP-008 — expense payment adapter  
- GAP-007 — COGS purpose posts to header  
- GAP-004 — inventory adj / FX leaves for stock & FX adapters
