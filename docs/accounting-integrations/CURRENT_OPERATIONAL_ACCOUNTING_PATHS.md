# Current Operational Accounting Paths

Inventory date: 2026-07-21. Complements Phase 1
`ACCOUNTING_POSTING_MATRIX.md` with a live re-sweep.

## Cross-cutting

| Path | Role | V2 |
| --- | --- | --- |
| `lib/accountingEngine/postGlEntry.js` | Primary legacy GL (`Transaction` + lines + balances) | Calls `assertLegacyPostingAllowed` only |
| `lib/journalService.js` | Manual JE lifecycle | Guard on post |
| `lib/transactionReversalService.js` | Mixed reverseGlEntry + **direct** `transaction.create` | Bypass risk |
| `lib/accountingV2/engine/postingEngine.js` | Authoritative V2 | Used by manuals / OB / reversal / repair **only** |

**Finding:** No Sales, POS, Payment, Purchase, Expense, Payroll, Inventory,
Banking, Asset, Loan, Tax, or Equity operational route calls `executePosting`.

---

## By module

### Sales / Invoices / Credit
- `lib/transactionJournalHelpers.js` — `createSaleJournalEntries`, `createInvoiceJournalEntry`, `createInvoicePaymentJournalEntry`, credit/debit note helpers → `postGlEntry`
- Triggers: `app/api/sales/**`, `app/api/invoices/**`, quotations convert, rentals, credit-notes, debit-notes
- **Bypass:** `app/api/invoices/refund/route.js`, `app/api/invoices/[id]/delete/route.js`, `lib/invoiceDeleteService.js` — direct Transaction writers

### POS
- Sale create → same sale helpers + `autoPostTaxEntry`
- `lib/posCashDayService.js` — **balance-only** deposits (no journal); cron `app/api/cron/pos-cash-day`

### Payments / Banking moves
- `lib/paymentGlPosting.js` — transfer / adjustment → `postGlEntry`
- `app/api/payments/route.js` — often swallows GL errors

### Purchases / Payables
- `lib/purchaseAccounting.js` — GR **JE-only**; supplier payment **dual T+J without balances**; slice reversal
- `lib/supplierBillExpenseFinalize.js` / bills route inventory finalize → `postGlEntry`
- `app/api/purchases/payments/route.js` — dual payment + **1-line unbalanced tax Transaction**
- Cron: `app/api/cron/apply-deferred-goods-receipts` → GR JE

### Expenses
- `createExpenseJournalEntry` / `postApprovedExpenseJournalIfMissing` → engine
- Partial payment path can re-debit expense (Phase 1 CRITICAL)
- Recurring expense generates Pending only (correct — no GL until instance)

### Payroll
- `app/api/payroll/enhanced/route.js` → `postGlEntry` per employee
- `app/api/payroll/[id]/process` → expense journal (second economic effect risk)
- Salary advances → `postGlEntry`
- Reversals via `transactionReversalService` (mixed)

### Inventory
- Write-offs → `inventoryWriteOffJournal` → engine
- Opening stock → `postOpeningBalance`
- `lib/cogsIntegration.js` + `/api/cogs/*` — **parallel** to POS COGS

### Fixed assets
- `app/api/assets/route.js` — direct Transaction, **no balance update**, no sourceId
- Depreciation route — schedule only, **no GL**

### Loans / Liabilities
- Opening → `postGlEntry` (errors may be logged only)
- Payments → JE + empty Transaction + `accountBalance.decrement` (**highest risk**)

### Tax
- `taxCalculationService.autoPostTaxEntry` / settle / WHT offset → engine
- Risk of double-count when modules also post tax lines

### Equity
- Capital account contributions / initial capital → engine
- `processCapitalTransfer` in `lib/core.js` — dead, balance-only if ever wired

### Imports
- Historical sales/expenses batch upload → legacy helpers (not Posting Engine)

### Webhooks
- **None** currently create journals or balances (design required before any provider cutover)

### Manual / Opening / V2
- Manual journals, opening balances, reversals, historical repair → V2 engine (already Phase 4–6)

---

## Engine-bypass register (must shut down or guard)

1. `lib/purchaseAccounting.js` (GR JE, supplier payment dual, slice reversal)
2. `app/api/assets/route.js` (`createTransactionWithEntries`)
3. `app/api/invoices/refund/route.js`
4. `app/api/invoices/[id]/delete` + `invoiceDeleteService`
5. `app/api/liabilities/[id]/payments/route.js`
6. `app/api/purchases/payments/route.js` (tax 1-liner)
7. `lib/transactionReversalService.js` (direct-create branches)
8. `lib/posCashDayService.js` (AB only)
9. `lib/core.js` (`updateAccountBalance`, dead `processCapitalTransfer`)
10. `lib/supplierBillCancelPayments.js` (AB restore)
11. `lib/journalService.js` — keep for manual JE until fully V2; already guarded

---

## Period / tenant notes

- Most `postGlEntry` paths soft-check periods (Phase 1: fail-open warnings historically; Phase 8 V2 resolver is deny-by-default when flags on).
- Direct writers have inconsistent period checks.
- All paths must become: Accounting Context → period resolution → mapping → `executePosting`.
